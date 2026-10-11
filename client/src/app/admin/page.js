import UsersTable from "@/components/admin/UsersTable";
import CreateRiderForm from "@/components/admin/CreateRiderForm";

// /admin (super_admin only; see proxy.js)
export default function AdminHomePage() {
  return (
    <div className="space-y-6">
      <CreateRiderForm />
      <UsersTable />
    </div>
  );
}
