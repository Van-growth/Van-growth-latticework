import type { Metadata } from "next";
import { Geist_Mono } from "next/font/google";
import "./globals.css";
import { AnalysisProvider } from "./context/AnalysisContext";
import { AuthProvider } from "./context/AuthContext";
import AppShell from "./components/AppShell";

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Latticework — AI 기업 분석",
  description: "Claude AI + Web Search 기반 기업 심층 분석 플랫폼",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistMono.variable} antialiased`}>
        <AuthProvider>
          <AnalysisProvider>
            <AppShell>
              {children}
            </AppShell>
          </AnalysisProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
