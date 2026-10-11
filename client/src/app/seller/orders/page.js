import SellerOrdersList from "@/components/seller/SellerOrdersList";

// /seller/orders?status=placed
export default async function SellerOrdersPage({ searchParams }) {
  const { status } = await searchParams;
  return <SellerOrdersList initialStatus={typeof status === "string" ? status : ""} />;
}
