"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import Card from "@/components/ui/Card";
import ProductForm from "@/components/seller/ProductForm";

// /seller/products/new — after saving, go to the edit page to submit it for review.
export default function NewProductPage() {
  const t = useTranslations("product");
  const router = useRouter();

  return (
    <Card title={t("add")}>
      <ProductForm product={null} onSaved={(product) => router.push(`/seller/products/${product.id}`)} />
    </Card>
  );
}
