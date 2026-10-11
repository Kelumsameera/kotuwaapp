import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { serverApi } from "@/lib/serverApi";
import { pickText } from "@/lib/pickText";
import { districtName } from "@/lib/districtName";
import ProductGallery from "@/components/store/ProductGallery";
import AddToCart from "@/components/store/AddToCart";
import ShopCard from "@/components/store/ShopCard";
import RatingStars from "@/components/store/RatingStars";

// Loads one product (null if it does not exist or is not for sale).
async function loadProduct(slug) {
  const data = await serverApi(`/catalog/products/${encodeURIComponent(slug)}`).catch(() => null);
  return data?.product || null;
}

// The browser tab title is the product name in the visitor's language.
export async function generateMetadata({ params }) {
  const { slug } = await params;
  const product = await loadProduct(slug);
  if (!product) return {};
  const locale = await getLocale();
  return { title: pickText(product.name, locale), description: pickText(product.description, locale).slice(0, 160) };
}

// /products/:slug — the product page.
export default async function ProductPage({ params }) {
  const { slug } = await params;
  const product = await loadProduct(slug);
  if (!product) notFound();

  const t = await getTranslations("store");
  const locale = await getLocale();
  const locations = await serverApi("/locations/districts").catch(() => null);
  const name = pickText(product.name, locale);
  const description = pickText(product.description, locale);

  return (
    <div className="space-y-8">
      <nav className="text-sm text-subtle">
        <Link href="/products" className="hover:underline">
          {t("allProducts")}
        </Link>
        {product.category && (
          <>
            {" › "}
            <Link href={`/products?category=${product.category.slug}`} className="hover:underline">
              {pickText(product.category.name, locale)}
            </Link>
          </>
        )}
      </nav>

      <div className="grid gap-8 md:grid-cols-2">
        <ProductGallery images={product.images} alt={name} />
        <div className="space-y-5">
          <div>
            <h1 className="text-2xl font-semibold text-ink">{name}</h1>
            <div className="mt-1">
              <RatingStars average={product.ratingAverage} count={product.ratingCount} />
            </div>
          </div>
          <AddToCart product={product} />
          {product.shop && <ShopCard shop={product.shop} districtName={districtName(locations?.districts, product.shop.district, locale)} />}
        </div>
      </div>

      {description && (
        <section>
          <h2 className="mb-2 text-lg font-semibold text-ink">{t("description")}</h2>
          <p className="whitespace-pre-line text-ink">{description}</p>
        </section>
      )}

      <section>
        <h2 className="mb-2 text-lg font-semibold text-ink">{t("reviews")}</h2>
        <p className="text-sm text-subtle">{product.ratingCount > 0 ? t("reviewsSoon") : t("noReviews")}</p>
      </section>
    </div>
  );
}
