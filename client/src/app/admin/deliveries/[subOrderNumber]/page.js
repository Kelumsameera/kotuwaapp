import AdminDeliveryDetail from "@/components/admin/AdminDeliveryDetail";

// /admin/deliveries/:subOrderNumber
export default async function AdminDeliveryPage({ params }) {
  const { subOrderNumber } = await params;
  return <AdminDeliveryDetail subOrderNumber={subOrderNumber} />;
}
