import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "./providers";
import AuthGuard from "@/components/AuthGuard";
import BottomNavigation from "@/components/BottomNavigation";
import AddToHomeScreenPrompt from "@/components/AddToHomeScreenPrompt";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Recipro",
  description: "飲食店向け原価管理・粗利損失可視化アプリ",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Recipro",
  },
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: { url: "/apple-touch-icon.png", sizes: "180x180" },
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  themeColor: "#E85D2C",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="ja"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-bg">
        <AuthProvider>
          <AuthGuard>
            {/* ボトムナビ + safe-area 分の下部余白 */}
            <div style={{ paddingBottom: "calc(60px + env(safe-area-inset-bottom, 0px))" }}>
              {children}
            </div>
          </AuthGuard>
          <BottomNavigation />
          <AddToHomeScreenPrompt />
        </AuthProvider>
      </body>
    </html>
  );
}
