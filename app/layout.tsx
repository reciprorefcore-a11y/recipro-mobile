import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "./providers";
import AuthGuard from "@/components/AuthGuard";
import BottomNavigation from "@/components/BottomNavigation";

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
  description: "Recipro App",
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
            {/* ボトムナビの高さ分だけコンテンツ下部に余白 */}
            <div style={{ paddingBottom: "calc(60px + env(safe-area-inset-bottom, 0px))" }}>
              {children}
            </div>
          </AuthGuard>
          <BottomNavigation />
        </AuthProvider>
      </body>
    </html>
  );
}
