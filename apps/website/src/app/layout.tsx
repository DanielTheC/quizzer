import type { Metadata } from "next";
import { Anton, Inter } from "next/font/google";
import "@/styles/globals.css";
import { Navbar } from "@/components/sections/Navbar";
import { Footer } from "@/components/sections/Footer";
import { getSiteSettings } from "@/sanity/lib/fetch";
import { buildMetadata } from "@/sanity/lib/metadata";

const anton = Anton({
  weight: "400",
  variable: "--font-anton",
  subsets: ["latin"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export async function generateMetadata(): Promise<Metadata> {
  const siteSettings = await getSiteSettings();
  return buildMetadata({
    siteSettings,
    template: "%s | Quizzer",
  });
}

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const siteSettings = await getSiteSettings();
  return (
    <html lang="en" className={`${anton.variable} ${inter.variable}`}>
      <body className="min-h-screen flex flex-col antialiased">
        <Navbar siteTitle={siteSettings?.siteTitle} />
        <main className="flex-1">{children}</main>
        <Footer siteSettings={siteSettings} />
      </body>
    </html>
  );
}
