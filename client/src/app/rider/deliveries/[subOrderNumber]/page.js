import RiderDeliveryDetail from "@/components/rider/RiderDeliveryDetail";

// /rider/deliveries/:subOrderNumber
export default async function RiderDeliveryPage({ params }) {
  const { subOrderNumber } = await params;
  return <RiderDeliveryDetail subOrderNumber={subOrderNumber} />;
}
