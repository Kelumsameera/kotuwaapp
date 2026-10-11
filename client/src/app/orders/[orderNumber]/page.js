import OrderDetail from "@/components/orders/OrderDetail";

// /orders/:orderNumber — ?placed=1 shows the thank-you message after checkout.
export default async function OrderPage({ params, searchParams }) {
  const { orderNumber } = await params;
  const { placed } = await searchParams;
  return <OrderDetail orderNumber={orderNumber} justPlaced={placed === "1"} />;
}
