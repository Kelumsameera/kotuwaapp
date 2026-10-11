import { getLocale, getTranslations } from "next-intl/server";
import { serverApi } from "@/lib/serverApi";
import { pickText } from "@/lib/pickText";
import CategoryChips from "@/components/store/CategoryChips";
import ProductFilters from "@/components/store/ProductFilters";
import ProductGrid from "@/components/store/ProductGrid";
import PageLinks from "@/components/store/PageLinks";

const ALLOWED_PARAMS = ["search", "category", "shop", "minPrice", "maxPrice", "sort", "page"];

// Keeps only known, single-value URL settings.
function cleanQuery(searchParams) {
  const query = {};
  for (const key of ALLOWED_PARAMS) {
    const value = searchParams[key];
    if (typeof value === "string" && value !== "") query[key] = value;
  }
  return query;
}

// /products?search=..&category=..&minPrice=..&maxPrice=..&sort=..&page=..
export default async function ProductsPage({ searchParams }) {
  const t = await getTranslations("store");
  const locale = await getLocale();
  const query = cleanQuery(await searchParams);

  const [categoryData, productData] = await Promise.all([
    serverApi("/categories"),
    // A bad URL setting (e.g. letters in a price) shows an empty list instead of an error page.
    serverApi(`/catalog/products?${new URLSearchParams(query)}`).catch(() => null),
  ]);
  const categories = categoryData?.categories || [];
  const activeCategory = categories.find((category) => category.slug === query.category);
  const products = productData?.products || [];

  let title = t("allProducts");
  if (query.search) title = t("resultsFor", { search: query.search });
  else if (activeCategory) title = pickText(activeCategory.name, locale);

  const makeHref = (page) => `/products?${new URLSearchParams({ ...query, page: String(page) })}`;

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-semibold text-ink">{title}</h1>
      <CategoryChips categories={categories} locale={locale} activeSlug={query.category} allLabel={t("allProducts")} />
      <ProductFilters query={{ ...query, minPrice: query.minPrice ? Number(query.minPrice) : undefined, maxPrice: query.maxPrice ? Number(query.maxPrice) : undefined }} />
      {productData && <p className="text-sm text-subtle">{t("resultCount", { count: productData.total })}</p>}
      <ProductGrid products={products} />
      {productData && <PageLinks page={productData.page} total={productData.total} limit={productData.limit} makeHref={makeHref} />}
    </div>
  );
}
