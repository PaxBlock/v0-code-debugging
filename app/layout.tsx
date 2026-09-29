import type { Metadata, Viewport } from "next";
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
  title: "PAX University Certificate System",
  description: "A clear, secure workspace for university teams to issue and verify academic certificates.",
  icons: {
    icon: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/Pax-7YjXsywyiRC99UEehcQt9aj3Nw1hQP.jpg",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="bg-white" data-scroll-behavior="smooth">
      <body
        className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased text-black bg-white`}
      >
        {children}
      </body>
    </html>
  );
}
