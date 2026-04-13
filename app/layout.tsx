import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
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
  title: "Academic Certificate Deployer | Smart Contract Deployment",
  description: "Deploy your university's soulbound NFT certificate contracts to Sepolia testnet",
  viewport: {
    width: "device-width",
    initialScale: 1,
    maximumScale: 1,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <body
        className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased text-slate-100`}
      >
        {children}
      </body>
    </html>
  );
}
