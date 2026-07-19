import { Suspense } from "react";
import type { Metadata, Viewport } from "next";
import { Poppins, Fira_Code, Hind_Siliguri } from "next/font/google";
import { Providers } from "@/components/shared/Providers";
import "./globals.css";

const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
});

const firaCode = Fira_Code({
  variable: "--font-fira-code",
  subsets: ["latin"],
  display: "swap",
});

const hindSiliguri = Hind_Siliguri({
  variable: "--font-bengali",
  subsets: ["bengali"],
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Chowdhury Agro ERP",
    template: "%s | Chowdhury Agro",
  },
  description: "Professional Agro Business ERP — Cattle Fattening Management System for Bangladesh.",
  applicationName: "Chowdhury Agro ERP",
  keywords: ["cattle ERP", "agro ERP", "গরু ফার্ম", "cattle fattening", "farm management", "Bangladesh agro"],
  authors: [{ name: "Chowdhury Agro" }],
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Agro",
  },
  formatDetection: { telephone: false },
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "https://caagro.netlify.app"),
  openGraph: {
    title: "Chowdhury Agro ERP",
    description: "Professional cattle fattening management — track weights, feed, health, and profit.",
    url: process.env.NEXT_PUBLIC_APP_URL ?? "https://caagro.netlify.app",
    siteName: "Chowdhury Agro ERP",
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "Chowdhury Agro ERP",
    description: "Cattle fattening management system — weights, feed, health, profit.",
  },
  robots: {
    index: false,    // Private business ERP — do not index
    follow: false,
  },
};

export const viewport: Viewport = {
  themeColor: "#3aaa6a",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

import { I18nProvider } from "@/i18n/I18nProvider";
import { getDictionary } from "@/i18n/getDictionary";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const locale = (cookieStore.get("NEXT_LOCALE")?.value === "bn" ? "bn" : "en");
  const dictionary = await getDictionary(locale as "en" | "bn");

  return (
    <html
      lang={locale}
      className={`${poppins.variable} ${firaCode.variable} ${hindSiliguri.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="bg-mesh-light dark:bg-mesh-dark min-h-full flex flex-col">
        <I18nProvider dictionary={dictionary} locale={locale as "en" | "bn"}>
          <Providers>{children}</Providers>
        </I18nProvider>
      </body>
    </html>
  );
}
