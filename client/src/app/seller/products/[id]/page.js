import ProductEditor from "@/components/seller/ProductEditor";

// /seller/products/:id
export default async function EditProductPage({ params }) {
  const { id } = await params;
  return <ProductEditor productId={id} />;
}
