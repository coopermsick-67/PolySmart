import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { SiteHeader } from "@/components/site-header";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Polymarket Smart Money Consensus",
  description:
    "Research and analytics dashboard aggregating open Polymarket wallet positions into weighted smart-money consensus ideas. Not financial advice.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} dark h-full antialiased`}
      // Browser extensions (Grammarly, dark-mode togglers, ad blockers,
      // etc.) commonly inject attributes into <html> before React
      // hydrates. That's a real DOM difference but not a bug in this app —
      // suppressHydrationWarning on this one element is the standard React
      // pattern for exactly this class of false positive.
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col bg-neutral-950 text-neutral-100">
        <SiteHeader />
        {children}
      </body>
    </html>
  );
}
