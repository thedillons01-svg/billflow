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
    default: 'Purchasomatic: Vendor Invoice & Purchase Order Capture for QuickBooks',
    template: '%s | Purchasomatic',
  },
  description: 'Forward vendor invoices and POs by email. Purchasomatic reads every line item, matches jobs and GL accounts, and posts to QuickBooks Online or Desktop.',
  openGraph: {
    siteName: 'Purchasomatic',
    locale: 'en_US',
    type: 'website',
    images: [{ url: '/logo-512.png', width: 512, height: 512, alt: 'Purchasomatic' }],
  },
  twitter: {
    card: 'summary',
    images: ['/logo-512.png'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, 'max-snippet': -1, 'max-image-preview': 'large', 'max-video-preview': -1 },
  },
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
