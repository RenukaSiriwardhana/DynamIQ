import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

// 1. Google Fonts setup (Next.js optimized)
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// 2. Metadata for SEO & PWA (Manifest linked here)
export const metadata: Metadata = {
  title: "DynamIQ Auto-Parts - Smart AI CRM",
  description: "AI-powered CRM for Sri Lankan Spare Parts Dealerships.",
  manifest: "/manifest.json",
  icons: {
    icon: "/favicon.ico",
    apple: "/icon-192x192.png", // For iOS Home Screen
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "DynamIQ",
  },
};

// 3. Viewport and Theme Color (Replaces the old themeColor property in Metadata)
export const viewport: Viewport = {
  themeColor: "#0d0f17",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

// 4. Main Root Layout Component
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <head>
        {/* -- Material Icons & Extra Fonts -- */}
        <link 
          rel="stylesheet" 
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" 
        />
        <link 
          rel="stylesheet" 
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" 
        />
      </head>
      <body className="min-h-[100dvh] flex flex-col bg-[#0d0f17] text-gray-100">
        {children}
      </body>
    </html>
  );
}