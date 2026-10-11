import LoginForm from "@/components/auth/LoginForm";

// /login?next=/somewhere
export default async function LoginPage({ searchParams }) {
  const { next } = await searchParams;
  return <LoginForm next={typeof next === "string" ? next : null} />;
}
