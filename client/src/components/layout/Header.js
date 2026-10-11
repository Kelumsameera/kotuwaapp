"use client";

import Link from "next/link";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { useAuth } from "@/context/AuthContext";
import { canOpenArea } from "@/lib/roleAreas";
import { useCart } from "@/context/CartContext";
import LanguageSwitcher from "./LanguageSwitcher";
import SearchBox from "./SearchBox";

// Links to the role areas. Each only shows for roles that can open it (UX only).
const AREA_LINKS = [
  { area: "admin", href: "/admin", labelKey: "admin" },
  { area: "seller", href: "/seller", labelKey: "seller" },
  { area: "pos", href: "/pos", labelKey: "pos" },
  { area: "rider", href: "/rider", labelKey: "rider" },
  { area: "shopping", href: "/orders", labelKey: "orders" },
  { area: "shopping", href: "/wishlist", labelKey: "wishlist" },
];

// The top bar: logo, role links, language switcher and login/account buttons.
export default function Header() {
  const t = useTranslations("nav");
  const tCommon = useTranslations("common");
  const { user, isLoading, logout } = useAuth();
  const { cart, canShop } = useCart();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const visibleAreaLinks = AREA_LINKS.filter((link) => canOpenArea(user?.role, link.area));
  const linkClass = "rounded-md px-3 py-2 text-sm text-ink hover:bg-muted";

  const userLinks = user ? (
    <>
      {visibleAreaLinks.map((link) => (
        <Link key={link.href} href={link.href} className={linkClass} onClick={() => setIsMenuOpen(false)}>
          {t(link.labelKey)}
        </Link>
      ))}
      <Link href="/account" className={linkClass} onClick={() => setIsMenuOpen(false)}>
        {t("account")}
      </Link>
      <button type="button" onClick={logout} className={`${linkClass} text-left`}>
        {t("logout")}
      </button>
    </>
  ) : (
    <>
      <Link href="/login" className={linkClass} onClick={() => setIsMenuOpen(false)}>
        {t("login")}
      </Link>
      <Link
        href="/register"
        className="rounded-md bg-brand px-3 py-2 text-sm font-medium text-white hover:bg-brand-dark"
        onClick={() => setIsMenuOpen(false)}
      >
        {t("register")}
      </Link>
    </>
  );

  return (
    <header className="border-b border-line bg-surface">
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
        <Link href="/" className="text-xl font-bold text-brand">
          {tCommon("appName")}
        </Link>

        <div className="hidden flex-1 md:block">
          <SearchBox />
        </div>

        <div className="ml-auto flex items-center gap-2">
          <LanguageSwitcher />
          {canShop && (
            <Link href="/cart" className="relative rounded-md px-3 py-2 text-sm text-ink hover:bg-muted" aria-label={t("cart")}>
              🛒
              <span className="ml-1">{t("cart")}</span>
              {cart.itemCount > 0 && (
                <span className="ml-1 rounded-full bg-brand px-1.5 text-xs font-semibold text-white">{cart.itemCount}</span>
              )}
            </Link>
          )}
          <nav className="hidden items-center gap-1 md:flex">{!isLoading && userLinks}</nav>
          <button
            type="button"
            className="rounded-md border border-line px-3 py-2 text-sm text-ink md:hidden"
            aria-expanded={isMenuOpen}
            onClick={() => setIsMenuOpen((open) => !open)}
          >
            {t("menu")}
          </button>
        </div>
      </div>

      <div className="px-4 pb-3 md:hidden">
        <SearchBox />
      </div>

      {isMenuOpen && !isLoading && (
        <nav className="flex flex-col gap-1 border-t border-line px-4 py-2 md:hidden">{userLinks}</nav>
      )}
    </header>
  );
}
