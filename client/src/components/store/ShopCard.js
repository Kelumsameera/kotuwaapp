import Link from "next/link";
import { useTranslations } from "next-intl";
import ProductImage from "./ProductImage";
import RatingStars from "./RatingStars";

// "Sold by" box with the shop logo, name, district and rating.
export default function ShopCard({ shop, districtName }) {
  const t = useTranslations("store");
  return (
    <Link href={`/shops/${shop.slug}`} className="flex items-center gap-3 rounded-lg border border-line bg-surface p-3 hover:bg-muted">
      <ProductImage image={shop.logo} alt={shop.name} sizes="48px" className="h-12 w-12 shrink-0 rounded-full" />
      <div className="min-w-0">
        <div className="text-xs text-subtle">{t("soldBy")}</div>
        <div className="truncate font-medium text-ink">{shop.name}</div>
        <div className="flex flex-wrap items-center gap-2 text-xs text-subtle">
          {districtName && <span>{districtName}</span>}
          <RatingStars average={shop.ratingAverage} count={shop.ratingCount} />
        </div>
      </div>
    </Link>
  );
}
