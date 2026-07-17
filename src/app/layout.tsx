import type { Metadata } from "next";
import { EB_Garamond, Inter, Fira_Code } from "next/font/google";
import { DuckDBProvider } from "@/lib/duckdb/context";

import "./globals.css";
import { SpeedInsights } from "@vercel/speed-insights/next"
import { Analytics } from "@vercel/analytics/next"

const ebGaramond = EB_Garamond({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
  variable: "--font-eb-garamond",
});

const inter = Inter({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
  variable: "--font-inter",
});

const firaCode = Fira_Code({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
  variable: "--font-fira-code",
});

export const metadata: Metadata = {
  title: {
    default: "SpicyRegs",
    template: "%s | SpicyRegs",
  },
  description: "spicy regs is an open source civic tech project that creates a platform using regulations.gov data for consumers to extend",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${ebGaramond.variable} ${inter.variable} ${firaCode.variable}`}>
      <body className={"antialiased"}>
        {/* Warm the two cross-origins every data route depends on: the
            DuckDB-WASM bundle (jsDelivr) and the R2 parquet corpus. Both are
            fetched anonymously under COEP: credentialless, so the preconnect
            must be crossOrigin="anonymous" to reuse the connection. */}
        <link rel="preconnect" href="https://cdn.jsdelivr.net" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://r2.spicy-regs.dev" crossOrigin="anonymous" />
        <DuckDBProvider>
          {children}
        </DuckDBProvider>
        <SpeedInsights />
        <Analytics />
      </body>
    </html>
  );
}
