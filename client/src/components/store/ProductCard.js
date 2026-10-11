import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { formatMoney } from "@/lib/money";
import { pickText } from "@/lib/pickText";
import ProductImage from "./ProductImage";
import RatingStars from "./RatingStars";

// One product tile in a grid: photo, name, price, shop and rating.
export default function ProductCard({ product }) {
  const t = useTranslations("store");
  const locale = useLocale();
  const name = pickText(product.name, locale);
  const hasManyPrices = new Set(product.variants.map((variant) => variant.price)).size > 1;
  const isSoldOut = product.variants.every((variant) => variant.stock === 0);
  const wasPrice = product.variants.find((variant) => variant.price === product.minPrice)?.compareAtPrice;

  return (
    <Link href={`/products/${product.slug}`} className="group flex flex-col overflow-hidden rounded-lg border border-line bg-surface hover:shadow-md">
      <ProductImage image={product.images[0]} alt={name} sizes="(max-width: 640px) 50vw, 240px" className="aspect-square" />
      <div className="flex flex-1 flex-col gap-1 p-3">
        <span className="line-clamp-2 text-sm text-ink group-hover:text-brand">{name}</span>
        <span className="mt-auto font-semibold text-ink">
          {hasManyPrices && <span className="text-xs font-normal text-subtle">{t("from")} </span>}
          {formatMoney(product.minPrice)}
          {wasPrice > product.minPrice && <span className="ml-2 text-xs font-normal text-subtle line-through">{formatMoney(wasPrice)}</span>}
        </span>
        <RatingStars average={product.ratingAverage} count={product.ratingCount} />
        {product.shop && <span className="truncate text-xs text-subtle">{product.shop.name}</span>}
        {isSoldOut && <span className="text-xs font-medium text-red-600">{t("soldOut")}</span>}
      </div>
    </Link>
  );
}
