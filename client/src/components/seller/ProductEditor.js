"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { api, errorMessage } from "@/lib/apiClient";
import { pickText } from "@/lib/pickText";
import Alert from "@/components/ui/Alert";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import StatusBadge from "@/components/ui/StatusBadge";
import ProductForm from "./ProductForm";
import StockPanel from "./StockPanel";

// Status, "submit for review", show/hide and delete buttons for one product.
function ProductActions({ product, onChanged }) {
  const t = useTranslations();
  const router = useRouter();
  const [error, setError] = useState(null);
  const [busyAction, setBusyAction] = useState("");

  // Runs one action and shows any error.
  async function run(action, request) {
    setError(null);
    setBusyAction(action);
    try {
      const data = await request();
      if (data?.product) onChanged(data.product);
    } catch (actionError) {
      setError(actionError);
    } finally {
      setBusyAction("");
    }
  }

  // Archives the product after a confirmation.
  function archive() {
    if (!window.confirm(t("product.confirmDelete"))) return;
    run("archive", async () => {
      await api(`/seller/products/${product.id}`, { method: "DELETE" });
      router.push("/seller/products");
    });
  }

  const canSubmit = product.status === "draft" || product.status === "rejected";

  return (
    <Card>
      <div className="flex flex-wrap items-center gap-3">
        <StatusBadge status={product.status} />
        {!product.isActive && <span className="text-sm text-subtle">{t("product.hidden")}</span>}
      </div>
      <p className="mt-2 text-sm text-subtle">{t(`product.statusHelp.${product.status}`)}</p>
      {product.statusReason && <p className="mt-1 text-sm text-red-600">{t("seller.reason", { reason: product.statusReason })}</p>}
      {error && <div className="mt-3"><Alert type="error">{errorMessage(error, t)}</Alert></div>}

      <div className="mt-4 flex flex-wrap gap-2">
        {canSubmit && (
          <Button
            isBusy={busyAction === "submit"}
            onClick={() => run("submit", () => api(`/seller/products/${product.id}/submit`, { method: "POST" }))}
          >
            {t("product.submit")}
          </Button>
        )}
        <Button
          variant="secondary"
          isBusy={busyAction === "visibility"}
          onClick={() =>
            run("visibility", () =>
              api(`/seller/products/${product.id}/visibility`, { method: "PATCH", body: { isActive: !product.isActive } })
            )
          }
        >
          {product.isActive ? t("product.hide") : t("product.show")}
        </Button>
        <Button variant="danger" isBusy={busyAction === "archive"} onClick={archive}>
          {t("product.delete")}
        </Button>
      </div>
    </Card>
  );
}

// The edit page for one product: actions, the form, and stock controls.
export default function ProductEditor({ productId }) {
  const t = useTranslations();
  const locale = useLocale();
  const [product, setProduct] = useState(null);
  const [error, setError] = useState(null);
  // Bumped after each save so the form starts again from the saved values.
  const [formVersion, setFormVersion] = useState(0);

  useEffect(() => {
    let isCancelled = false;
    api(`/seller/products/${productId}`)
      .then((data) => {
        if (!isCancelled) setProduct(data.product);
      })
      .catch((loadError) => {
        if (!isCancelled) setError(loadError);
      });
    return () => {
      isCancelled = true;
    };
  }, [productId]);

  // Keeps the page in sync after a save.
  function handleSaved(savedProduct) {
    setProduct(savedProduct);
    setFormVersion((version) => version + 1);
  }

  // Shows a new stock number without reloading the whole product.
  function handleStockChanged(variantId, stock) {
    setProduct((current) => ({
      ...current,
      variants: current.variants.map((variant) => (variant.id === variantId ? { ...variant, stock } : variant)),
    }));
  }

  if (error) return <Alert type="error">{errorMessage(error, t)}</Alert>;
  if (!product) return <p className="text-subtle">{t("common.loading")}</p>;

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold text-ink">{pickText(product.name, locale)}</h2>
      <ProductActions product={product} onChanged={setProduct} />
      <Card title={t("product.details")}>
        <ProductForm key={formVersion} product={product} onSaved={handleSaved} />
      </Card>
      <StockPanel product={product} onStockChanged={handleStockChanged} />
    </div>
  );
}
