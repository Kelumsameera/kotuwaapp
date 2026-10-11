import ResetPasswordForm from "@/components/auth/ResetPasswordForm";

// /reset-password?token=... (the link in the reset email)
export default async function ResetPasswordPage({ searchParams }) {
  const { token } = await searchParams;
  return <ResetPasswordForm token={typeof token === "string" ? token : ""} />;
}
