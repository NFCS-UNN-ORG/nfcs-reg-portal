import type { Metadata } from "next";
import Script from "next/script";
import { ToastProvider } from "@/components/ui/toast";
import "./globals.css";

export const metadata: Metadata = {
  title: "NFCS UNN Portal — Member Management & Dues",
  description: "Unified member portal for the Nigerian Federation of Catholic Students (NFCS), University of Nigeria, Nsukka Chapter. Register, claim accounts, track dues, and get event updates.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased text-text-primary bg-surface-page">
        <ToastProvider>
          {children}
        </ToastProvider>

        {/* Google Identity Services Script */}
        <Script
          src="https://accounts.google.com/gsi/client"
          strategy="afterInteractive"
        />
      </body>
    </html>
  );
}
