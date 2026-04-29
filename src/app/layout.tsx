import type { Metadata, Viewport } from "next";
import { Roboto, Baskervville, Inter, Cormorant_Garamond, JetBrains_Mono } from "next/font/google";
import { ServiceWorkerRegistrar } from "@/components/shared/ServiceWorkerRegistrar";
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
  title: "Press Farm",
  description: "Farm-to-kitchen ordering and availability management for Press Farm",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Press Farm",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
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
        {children}
        <ServiceWorkerRegistrar />
      </body>
    </html>
  );
}
