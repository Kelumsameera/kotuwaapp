"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { api, errorMessage } from "@/lib/apiClient";
import { centsToInput, formatMoney, inputToCents } from "@/lib/money";
import { pickText } from "@/lib/pickText";
import { computeBill, lineTotal, linesForServer, linesFromHeldBill } from "@/lib/posBill";
import Alert from "@/components/ui/Alert";
import Button from "@/components/ui/Button";
import Dialog from "@/components/ui/Dialog";
import PayDialog from "./PayDialog";
import HeldBillsDialog from "./HeldBillsDialog";
import Receipt from "./Receipt";

// "Coconut Oil 1L (XL · Red)" in the screen language.
function itemTitle(item, locale) {
  const options = [item.options?.size, item.options?.color].filter(Boolean).join(" · ");
  return options ? `${pickText(item.name, locale)} (${options})` : pickText(item.name, locale);
}

// A money box typed in rupees, saved in cents when the cashier leaves the box.
function MoneyInput({ cents, onChange, label, className = "" }) {
  const [text, setText] = useState(cents ? centsToInput(cents) : "");
  return (
    <input
      aria-label={label}
      inputMode="decimal"
      value={text}
      placeholder="0"
      onChange={(e) => setText(e.target.value)}
      onBlur={() => {
        const value = inputToCents(text);
        onChange(Number.isFinite(value) ? value : 0);
      }}
      className={`min-h-10 rounded border border-line bg-surface px-2 text-right text-sm text-ink ${className}`}
    />
  );
}

// One line on the bill: name, price, quantity (− / +), line discount, line total, remove.
function BillLine({ line, onChange, onRemove, locale, t }) {
  return (
    <li className="grid grid-cols-[1fr_auto] gap-2 py-2 sm:grid-cols-[1fr_auto_auto_auto_auto]">
      <div className="min-w-0">
        <div className="truncate text-sm font-medium text-ink">{itemTitle(line, locale)}</div>
        <div className="text-xs text-subtle">
          {line.sku} · {formatMoney(line.price)}
          {line.stock !== null && line.quantity > line.stock && <span className="ml-1 text-red-600">{t("onlyInStock", { count: line.stock })}</span>}
        </div>
      </div>
      <div className="flex items-center gap-1">
        <button type="button" aria-label="−" onClick={() => onChange({ quantity: Math.max(1, line.quantity - 1) })} className="h-10 w-10 rounded border border-line text-lg text-ink">
          −
        </button>
        <input
          aria-label={t("quantity")}
          inputMode="numeric"
          value={line.quantity}
          onChange={(e) => {
            const quantity = Number.parseInt(e.target.value, 10);
            if (quantity >= 1 && quantity <= 999) onChange({ quantity });
          }}
          className="h-10 w-12 rounded border border-line bg-surface text-center text-ink"
        />
        <button type="button" aria-label="+" onClick={() => onChange({ quantity: Math.min(999, line.quantity + 1) })} className="h-10 w-10 rounded border border-line text-lg text-ink">
          +
        </button>
      </div>
      <MoneyInput key={`${line.variantId}-${line.itemDiscount}`} cents={line.itemDiscount} onChange={(itemDiscount) => onChange({ itemDiscount })} label={t("discount")} className="w-20" />
      <div className="w-24 self-center text-right text-sm font-semibold text-ink">{formatMoney(lineTotal(line))}</div>
      <button type="button" onClick={onRemove} aria-label={t("remove")} className="h-10 w-10 self-center rounded text-red-600 hover:bg-muted">
        ✕
      </button>
    </li>
  );
}

// The POS billing screen. Keyboard: F2 search · F7 held bills · F8 hold · F9 pay · Esc close.
// A barcode scanner types the code and presses Enter, which adds the item straight away.
export default function PosScreen({ session }) {
  const t = useTranslations("pos");
  const tAll = useTranslations();
  const locale = useLocale();
  const searchRef = useRef(null);

  const [lines, setLines] = useState([]);
  const [billDiscount, setBillDiscount] = useState(0);
  const [heldSaleId, setHeldSaleId] = useState(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [highlight, setHighlight] = useState(0);
  const [dialog, setDialog] = useState(null); // "pay" | "held" | "receipt" | null
  const [receipt, setReceipt] = useState(null);
  const [message, setMessage] = useState(null);
  const [payError, setPayError] = useState("");
  const [isBusy, setIsBusy] = useState(false);

  const bill = computeBill(lines, billDiscount);
  const isCashier = session.user.role === "seller_cashier";

  // Puts the cursor back in the search box (after every action, so the scanner always works).
  const focusSearch = useCallback(() => searchRef.current?.focus(), []);

  // Adds one of an item, or one more if it is already on the bill.
  const addItem = useCallback(
    (item) => {
      setLines((current) => {
        const existing = current.find((line) => line.variantId === item.variantId);
        if (existing) return current.map((line) => (line.variantId === item.variantId ? { ...line, quantity: line.quantity + 1, stock: item.stock } : line));
        return [...current, { ...item, quantity: 1, itemDiscount: 0 }];
      });
      setMessage(item.stock < 1 ? { type: "error", text: t("outOfStockWarning", { name: pickText(item.name, locale) }) } : null);
      setQuery("");
      setResults([]);
      focusSearch();
    },
    [focusSearch, locale, t]
  );

  // Name search while typing (waits a moment so it doesn't search on every key).
  useEffect(() => {
    const text = query.trim();
    if (text.length < 2) return undefined;
    const timer = setTimeout(() => {
      api(`/pos/search?q=${encodeURIComponent(text)}`)
        .then((data) => {
          setResults(data.items);
          setHighlight(0);
        })
        .catch(() => {});
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  // Enter in the search box: the highlighted result, or an exact barcode/SKU match.
  async function handleSearchKey(event) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setHighlight((index) => Math.min(index + 1, results.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlight((index) => Math.max(index - 1, 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      const code = query.trim();
      if (!code) return;
      try {
        addItem((await api(`/pos/lookup?code=${encodeURIComponent(code)}`)).item);
      } catch {
        if (results[highlight]) addItem(results[highlight]);
        else setMessage({ type: "error", text: t("notFound", { code }) });
      }
    } else if (event.key === "Escape") {
      setQuery("");
      setResults([]);
    }
  }

  // Changes one line (quantity or discount).
  function updateLine(variantId, changes) {
    setLines((current) => current.map((line) => (line.variantId === variantId ? { ...line, ...changes } : line)));
  }

  // Empties the screen for the next customer.
  const clearBill = useCallback(() => {
    setLines([]);
    setBillDiscount(0);
    setHeldSaleId(null);
    setMessage(null);
    focusSearch();
  }, [focusSearch]);

  // Re-reads the current prices of every line (after the server said a price changed).
  async function refreshPrices() {
    const fresh = await Promise.all(lines.map((line) => api(`/pos/lookup?code=${encodeURIComponent(line.sku)}`).then((data) => data.item).catch(() => null)));
    setLines((current) => current.map((line, index) => (fresh[index] ? { ...line, price: fresh[index].price, stock: fresh[index].stock } : line)));
  }

  // Sends the sale to the server; shows the receipt when it is done.
  async function completeSale(payment) {
    setPayError("");
    setIsBusy(true);
    try {
      const data = await api("/pos/sales", {
        method: "POST",
        body: { items: linesForServer(lines), billDiscount, expectedTotal: bill.total, payment, heldSaleId: heldSaleId || undefined },
      });
      setReceipt(data);
      setDialog("receipt");
      setLines([]);
      setBillDiscount(0);
      setHeldSaleId(null);
      setMessage(null);
    } catch (saleError) {
      if (saleError.code === "TOTAL_CHANGED") {
        await refreshPrices();
        setDialog(null);
        setMessage({ type: "error", text: t("pricesChanged") });
      } else {
        setPayError(errorMessage(saleError, tAll));
      }
    } finally {
      setIsBusy(false);
    }
  }

  // Parks the bill (optionally with a name) so the next customer can be served.
  const holdCurrentBill = useCallback(async () => {
    if (lines.length === 0) return;
    const label = window.prompt(t("holdPrompt")) ?? "";
    try {
      await api("/pos/held", { method: "POST", body: { items: linesForServer(lines), billDiscount, label: label || undefined } });
      if (heldSaleId) await api(`/pos/held/${heldSaleId}`, { method: "DELETE" }).catch(() => {});
      clearBill();
      setMessage({ type: "success", text: t("billHeld") });
    } catch (holdError) {
      setMessage({ type: "error", text: errorMessage(holdError, tAll) });
    }
  }, [lines, billDiscount, heldSaleId, clearBill, t, tAll]);

  // Loads a held bill into the screen.
  function resumeBill(heldBill) {
    if (lines.length > 0 && !window.confirm(t("replaceBillConfirm"))) return;
    setLines(linesFromHeldBill(heldBill));
    setBillDiscount(heldBill.billDiscount);
    setHeldSaleId(heldBill.id);
    setDialog(null);
    setMessage({ type: "info", text: t("billResumed", { label: heldBill.heldLabel || t("unnamedBill") }) });
    focusSearch();
  }

  // Keyboard shortcuts for the whole screen.
  useEffect(() => {
    function handleShortcut(event) {
      if (dialog === "receipt" && event.key === "Enter") {
        event.preventDefault();
        setDialog(null);
        focusSearch();
        return;
      }
      if (dialog) return;
      if (event.key === "F2") {
        event.preventDefault();
        focusSearch();
      } else if (event.key === "F7") {
        event.preventDefault();
        setDialog("held");
      } else if (event.key === "F8") {
        event.preventDefault();
        holdCurrentBill();
      } else if (event.key === "F9") {
        event.preventDefault();
        if (lines.length > 0) setDialog("pay");
      }
    }
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, [dialog, lines.length, holdCurrentBill, focusSearch]);

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
      {/* Left: search and the bill lines */}
      <section className="space-y-3">
        <div className="relative">
          <input
            ref={searchRef}
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleSearchKey}
            placeholder={t("searchPlaceholder")}
            aria-label={t("searchPlaceholder")}
            className="block min-h-12 w-full rounded-md border-2 border-brand bg-surface px-3 text-lg text-ink outline-none"
          />
          {results.length > 0 && query.trim().length >= 2 && (
            <ul className="absolute z-20 mt-1 max-h-80 w-full overflow-y-auto rounded-md border border-line bg-surface shadow-lg">
              {results.map((item, index) => (
                <li key={item.variantId}>
                  <button
                    type="button"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => addItem(item)}
                    className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm ${index === highlight ? "bg-muted" : ""}`}
                  >
                    <span className="truncate text-ink">
                      {itemTitle(item, locale)} <span className="text-subtle">· {item.sku}</span>
                    </span>
                    <span className="whitespace-nowrap text-ink">
                      {formatMoney(item.price)} <span className={item.stock > 0 ? "text-subtle" : "text-red-600"}>({item.stock})</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {message && <Alert type={message.type}>{message.text}</Alert>}

        <div className="rounded-lg border border-line bg-surface px-3">
          {lines.length === 0 ? (
            <p className="py-10 text-center text-subtle">{t("emptyBill")}</p>
          ) : (
            <ul className="divide-y divide-line">
              {lines.map((line) => (
                <BillLine
                  key={line.variantId}
                  line={line}
                  locale={locale}
                  t={t}
                  onChange={(changes) => updateLine(line.variantId, changes)}
                  onRemove={() => setLines((current) => current.filter((candidate) => candidate.variantId !== line.variantId))}
                />
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* Right: totals and actions */}
      <aside className="h-fit space-y-3 rounded-lg border border-line bg-surface p-4 lg:sticky lg:top-4">
        <dl className="space-y-1 text-sm">
          <div className="flex justify-between text-subtle">
            <dt>{t("subtotal")}</dt>
            <dd>{formatMoney(bill.subtotal)}</dd>
          </div>
          <div className="flex justify-between text-subtle">
            <dt>{t("itemDiscounts")}</dt>
            <dd>− {formatMoney(bill.itemDiscountTotal)}</dd>
          </div>
          <div className="flex items-center justify-between text-subtle">
            <dt>{t("billDiscount")}</dt>
            <dd>
              <MoneyInput key={`bill-${billDiscount}`} cents={billDiscount} onChange={setBillDiscount} label={t("billDiscount")} className="w-24" />
            </dd>
          </div>
        </dl>
        <div className="flex items-baseline justify-between border-t border-line pt-3">
          <span className="text-lg text-ink">{t("total")}</span>
          <span className="text-3xl font-bold text-ink">{formatMoney(bill.total)}</span>
        </div>
        {bill.total < 0 && <Alert type="error">{tAll("errors.DISCOUNT_TOO_BIG")}</Alert>}
        {isCashier && <p className="text-xs text-subtle">{t("discountLimit", { percent: session.shop.cashierMaxDiscountPercent })}</p>}

        <Button className="min-h-14 w-full text-lg" disabled={lines.length === 0 || bill.total < 0} onClick={() => setDialog("pay")}>
          {t("pay")} (F9)
        </Button>
        <div className="grid grid-cols-3 gap-2">
          <Button variant="secondary" disabled={lines.length === 0} onClick={holdCurrentBill}>
            {t("hold")} (F8)
          </Button>
          <Button variant="secondary" onClick={() => setDialog("held")}>
            {t("held")} (F7)
          </Button>
          <Button variant="secondary" disabled={lines.length === 0} onClick={() => window.confirm(t("clearConfirm")) && clearBill()}>
            {t("clear")}
          </Button>
        </div>
        <p className="text-xs text-subtle">
          {session.shop.name} · {session.user.name}
        </p>
      </aside>

      {dialog === "pay" && <PayDialog total={bill.total} onPay={completeSale} onClose={() => setDialog(null)} isBusy={isBusy} error={payError} />}
      {dialog === "held" && <HeldBillsDialog onResume={resumeBill} onClose={() => setDialog(null)} />}
      {dialog === "receipt" && receipt && (
        <Dialog
          title={t("saleDone", { number: receipt.sale.billNumber })}
          onClose={() => {
            setDialog(null);
            focusSearch();
          }}
        >
          <div className="mb-3 rounded-md border border-line">
            <Receipt sale={receipt.sale} shop={receipt.shop} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="secondary" onClick={() => window.print()}>
              🖨 {t("print")}
            </Button>
            <Button
              onClick={() => {
                setDialog(null);
                focusSearch();
              }}
            >
              {t("newSale")} (Enter)
            </Button>
          </div>
        </Dialog>
      )}
    </div>
  );
}
