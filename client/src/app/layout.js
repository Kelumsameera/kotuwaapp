import { Noto_Sans, Noto_Sans_Sinhala, Noto_Sans_Tamil } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getTranslations } from "next-intl/server";
import { AuthProvider } from "@/context/AuthContext";
import { CartProvider } from "@/context/CartContext";
import Header from "@/components/layout/Header";
import "./globals.css";

const notoSans = Noto_Sans({ variable: "--font-noto-sans", subsets: ["latin"] });
const notoSinhala = Noto_Sans_Sinhala({ variable: "--font-noto-sinhala", subsets: ["sinhala"] });
const notoTamil = Noto_Sans_Tamil({ variable: "--font-noto-tamil", subsets: ["tamil"] });

// Page title and description, in the visitor's language.
export async function generateMetadata() {
  const t = await getTranslations("common");
  return { title: { default: t("appName"), template: `%s | ${t("appName")}` }, description: t("tagline") };
}

// The shell around every page: fonts, translations, auth state and the header.
export default async function RootLayout({ children }) {
  const locale = await getLocale();

  return (
    // suppressHydrationWarning: browser extensions often add attributes to <html>; this only
    // ignores attribute differences on this one tag, not on the rest of the page.
    <html
      lang={locale}
      className={`${notoSans.variable} ${notoSinhala.variable} ${notoTamil.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="flex min-h-full flex-col">
        <NextIntlClientProvider>
          <AuthProvider>
            <CartProvider>
              <Header />
              <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">{children}</main>
            </CartProvider>
          </AuthProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
