import SellerOrderDetail from "@/components/seller/SellerOrderDetail";

// /seller/orders/:subOrderNumber
export default async function SellerOrderPage({ params }) {
  const { subOrderNumber } = await params;
  return <SellerOrderDetail subOrderNumber={subOrderNumber} />;
}
