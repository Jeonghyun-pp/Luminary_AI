import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ToastProvider } from "@/components/toast-provider";
import { DataPreloader } from "@/components/data-preloader";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Luminary",
  description: "AI-powered inbox management with integrated calendar and task management",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className={inter.className}>
        <DataPreloader />
        {children}
        <ToastProvider />
      </body>
    </html>
  );
}

