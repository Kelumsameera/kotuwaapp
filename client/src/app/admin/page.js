import UsersTable from "@/components/admin/UsersTable";

// /admin (super_admin only; see proxy.js)
export default function AdminHomePage() {
  return <UsersTable />;
}
