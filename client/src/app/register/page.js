import RegisterForm from "@/components/auth/RegisterForm";

// /register or /register?as=seller
export default async function RegisterPage({ searchParams }) {
  const { as } = await searchParams;
  return <RegisterForm initialRole={as === "seller" ? "seller" : "customer"} />;
}
