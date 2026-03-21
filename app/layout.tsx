import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "Ink — Smart Contract Risk Intelligence",
  description: "Analyze any Avalanche smart contract and get an instant, AI-powered risk report in plain language. Free. No wallet needed.",
  icons: {
    icon: "/ink_logo.svg",
  },
  openGraph: {
    title: "Ink — Smart Contract Risk Intelligence",
    description: "Analyze any Avalanche smart contract and get an instant, AI-powered risk report in plain language. Free. No wallet needed.",
    siteName: "Ink",
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary",
    title: "Ink — Smart Contract Risk Intelligence",
    description: "Analyze any Avalanche smart contract and get an instant, AI-powered risk report in plain language.",
  },
  keywords: ["smart contract", "risk analysis", "avalanche", "blockchain", "scam detector", "DeFi security", "crypto"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
