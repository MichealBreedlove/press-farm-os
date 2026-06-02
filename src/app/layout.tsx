import type { Metadata, Viewport } from "next";
import { Roboto, Baskervville, Inter, Cormorant_Garamond, JetBrains_Mono } from "next/font/google";
import { ServiceWorkerRegistrar } from "@/components/shared/ServiceWorkerRegistrar";
import { FloralCorners } from "@/components/shared/FloralCorners";
import "./globals.css";
import "./pressfarm-tokens.css";

// Existing fonts (kept for backward compatibility)
const roboto = Roboto({
  subsets: ["latin"],
  weight: ["300", "400", "500", "700"],
  variable: "--font-roboto",
  display: "swap",
});

const baskervville = Baskervville({
  subsets: ["latin"],
  weight: ["400"],
  style: ["normal", "italic"],
  variable: "--font-baskervville",
  display: "swap",
});

// PressFarm OS design system fonts
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
  variable: "--font-cormorant",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains",
  display: "swap",
});



export const metadata: Metadata = {
  metadataBase: new URL("https://pressfarm.io"),
  title: {
    default: "Press Farm",
    template: "%s · Press Farm",
  },
  description:
    "Press Farm — half an acre in Yountville, California, growing edible flowers, micro-greens, and seasonal produce for Napa Valley chefs. Cultivated with chefs.",
  applicationName: "Press Farm",
  authors: [{ name: "Press Farm" }],
  keywords: [
    "Press Farm",
    "edible flowers",
    "Yountville",
    "Napa Valley",
    "specialty farm",
    "chef-direct produce",
    "micro-greens",
  ],
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Press Farm",
  },
  openGraph: {
    title: "Press Farm — Cultivated with Chefs",
    description:
      "Half an acre in Yountville, California, growing edible flowers and seasonal produce in close partnership with Napa Valley kitchens.",
    url: "https://pressfarm.io",
    siteName: "Press Farm",
    locale: "en_US",
    type: "website",
    images: [
      {
        url: "/og-default.png",
        width: 1200,
        height: 630,
        alt: "Press Farm — Cultivated with Chefs",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Press Farm — Cultivated with Chefs",
    description:
      "Edible flowers + seasonal produce, cultivated with Napa Valley chefs. Yountville, California.",
    images: ["/og-default.png"],
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // No maximumScale — pinch-zoom must stay enabled (WCAG 2.1 SC 1.4.4).
  themeColor: "#00774A",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${roboto.variable} ${baskervville.variable} ${inter.variable} ${cormorant.variable} ${jetbrainsMono.variable}`}>
      <head>
        {/* Bank Gothic LT — local @font-face is preferred (see globals.css).
            CDN kept as fallback in case the licensed file isn't yet in /public/assets/fonts/ */}
        <link rel="stylesheet" href="https://fonts.cdnfonts.com/css/bank-gothic" />
        <link rel="icon" href="/favicon.ico" />
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16.png" />
        <link rel="apple-touch-icon" sizes="180x180" href="/icon-180.png" />
      </head>
      <body>
        <FloralCorners opacity={0.09} />
        {children}
        <ServiceWorkerRegistrar />
      </body>
    </html>
  );
}
