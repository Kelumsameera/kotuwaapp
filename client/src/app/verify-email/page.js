import VerifyEmail from "@/components/auth/VerifyEmail";

// /verify-email?token=... (the link in the verification email)
export default async function VerifyEmailPage({ searchParams }) {
  const { token } = await searchParams;
  return <VerifyEmail token={typeof token === "string" ? token : ""} />;
}
