import Image from "next/image";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { serverApi } from "@/lib/serverApi";
import { pickText } from "@/lib/pickText";
import { districtName } from "@/lib/districtName";
import ProductImage from "@/components/store/ProductImage";
import ProductGrid from "@/components/store/ProductGrid";
import PageLinks from "@/components/store/PageLinks";
import RatingStars from "@/components/store/RatingStars";

// Loads one approved shop (null if it does not exist or is not approved).
async function loadShop(slug) {
  const data = await serverApi(`/catalog/shops/${encodeURIComponent(slug)}`).catch(() => null);
  return data?.shop || null;
}

// The browser tab title is the shop name.
export async function generateMetadata({ params }) {
  const { slug } = await params;
  const shop = await loadShop(slug);
  return shop ? { title: shop.name } : {};
}

// /shops/:slug — a seller's shop page with all their products.
export default async function ShopPage({ params, searchParams }) {
  const { slug } = await params;
  const { page: pageParam } = await searchParams;
  const shop = await loadShop(slug);
  if (!shop) notFound();

  const t = await getTranslations("store");
  const locale = await getLocale();
  const page = /^\d+$/.test(pageParam || "") ? pageParam : "1";
  const [productData, locations] = await Promise.all([
    serverApi(`/catalog/products?shop=${encodeURIComponent(slug)}&page=${page}`).catch(() => null),
    serverApi("/locations/districts").catch(() => null),
  ]);
  const description = pickText(shop.description, locale);

  return (
    <div className="space-y-6">
      <div className="overflow-hidden rounded-lg border border-line bg-surface">
        <div className="relative h-32 bg-muted sm:h-48">
          {shop.banner && <Image src={shop.banner.url} alt="" fill sizes="100vw" className="object-cover" priority />}
        </div>
        <div className="flex items-center gap-4 p-4">
          <ProductImage image={shop.logo} alt={shop.name} sizes="64px" className="-mt-12 h-16 w-16 shrink-0 rounded-full border-4 border-surface" />
          <div className="min-w-0">
            <h1 className="truncate text-xl font-semibold text-ink">{shop.name}</h1>
            <div className="flex flex-wrap items-center gap-2 text-sm text-subtle">
              <span>{districtName(locations?.districts, shop.district, locale)}</span>
              <RatingStars average={shop.ratingAverage} count={shop.ratingCount} />
            </div>
          </div>
        </div>
        {description && <p className="whitespace-pre-line px-4 pb-4 text-sm text-ink">{description}</p>}
      </div>

      <h2 className="text-lg font-semibold text-ink">{t("shopProducts")}</h2>
      <ProductGrid products={productData?.products || []} />
      {productData && (
        <PageLinks page={productData.page} total={productData.total} limit={productData.limit} makeHref={(number) => `/shops/${slug}?page=${number}`} />
      )}
    </div>
  );
}
