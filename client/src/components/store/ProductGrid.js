import { useTranslations } from "next-intl";
import ProductCard from "./ProductCard";

// A responsive grid of product tiles, or a friendly message when empty.
export default function ProductGrid({ products }) {
  const t = useTranslations("store");
  if (products.length === 0) return <p className="py-12 text-center text-subtle">{t("noProducts")}</p>;

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {products.map((product) => (
        <ProductCard key={product.id} product={product} />
      ))}
    </div>
  );
}
