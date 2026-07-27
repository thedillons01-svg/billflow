import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { GoogleAnalytics } from "@next/third-parties/google";
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
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.purchasomatic.com'),
  title: {
    default: 'Purchasomatic — Automated PDF Purchase Order & Invoice Capture Synced to QuickBooks',
    template: '%s | Purchasomatic',
  },
  description: 'Automated PDF purchase order and invoice capture with class and job tracking, synced to QuickBooks.',
  verification: {
    google: 'FEUF-HMzREY1Akg2JOZkBVGW7GqRsMa9We1dnadNEMo',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
      {process.env.NODE_ENV === 'production' && <GoogleAnalytics gaId="G-BQDKB9J7SZ" />}
    </html>
  );
}
