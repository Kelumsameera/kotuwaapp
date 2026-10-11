import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { serverApi } from "@/lib/serverApi";
import CategoryChips from "@/components/store/CategoryChips";
import ProductGrid from "@/components/store/ProductGrid";

// The home page: welcome banner, categories and the newest products.
export default async function HomePage() {
  const t = await getTranslations("home");
  const locale = await getLocale();
  const [categoryData, productData] = await Promise.all([
    serverApi("/categories"),
    serverApi("/catalog/products?sort=newest&limit=12"),
  ]);

  return (
    <div className="space-y-8">
      <section className="rounded-lg bg-surface px-6 py-10 text-center sm:py-14">
        <h1 className="text-2xl font-bold text-ink sm:text-4xl">{t("title")}</h1>
        <p className="mx-auto mt-3 max-w-xl text-subtle">{t("subtitle")}</p>
        <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
          <Link href="/products" className="rounded-md bg-brand px-5 py-3 font-medium text-white hover:bg-brand-dark">
            {t("shopCta")}
          </Link>
          <Link href="/register?as=seller" className="rounded-md border border-line px-5 py-3 font-medium text-ink hover:bg-muted">
            {t("sellCta")}
          </Link>
        </div>
      </section>

      {categoryData?.categories.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-semibold text-ink">{t("categories")}</h2>
          <CategoryChips categories={categoryData.categories} locale={locale} />
        </section>
      )}

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-ink">{t("newArrivals")}</h2>
          <Link href="/products" className="text-sm text-brand hover:underline">
            {t("seeAll")}
          </Link>
        </div>
        <ProductGrid products={productData?.products || []} />
      </section>
    </div>
  );
}
