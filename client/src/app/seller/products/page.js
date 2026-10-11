import ProductList from "@/components/seller/ProductList";

// /seller/products?status=pending
export default async function SellerProductsPage({ searchParams }) {
  const { status } = await searchParams;
  return <ProductList initialStatus={typeof status === "string" ? status : ""} />;
}
