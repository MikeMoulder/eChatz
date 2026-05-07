import type { Metadata, Viewport } from "next";
import { Inter, Space_Grotesk, Instrument_Serif, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const grotesk = Space_Grotesk({ subsets: ["latin"], variable: "--font-grotesk", display: "swap" });
const serif = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  variable: "--font-serif",
  display: "swap",
});
const jetbrains = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono", display: "swap" });

export const metadata: Metadata = {
  title: "eChatz",
  description:
    "An end-to-end FHE-encrypted messenger and payments rail running entirely on smart contracts. No servers. No middleman. No data leak.",
  openGraph: {
    title: "echatz",
    description: "Message like no one is watching. Because no one can.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#0B0B0B",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${grotesk.variable} ${serif.variable} ${jetbrains.variable}`}
    >
      <body className="font-sans antialiased bg-bg-1 text-ink-1">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
