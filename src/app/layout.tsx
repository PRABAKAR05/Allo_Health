import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Allo Inventory — Real-time Stock Reservation Platform",
  description:
    "Multi-warehouse inventory management with concurrency-safe stock reservations for retail and D2C brands.",
  keywords: ["inventory", "reservation", "warehouse", "e-commerce", "stock management"],
};

import { ThemeProvider } from "@/components/ThemeProvider";
import { ThemeToggle } from "@/components/ThemeToggle";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.variable}>
        <ThemeProvider>
          <header className="header">
            <a href="/" className="header-logo">
              <div className="header-logo-icon">A</div>
              <span className="header-logo-text">Allo Inventory</span>
            </a>
            <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
              <span className="header-badge">Live Demo</span>
              <ThemeToggle />
            </div>
          </header>
          <main>{children}</main>
        </ThemeProvider>
      </body>
    </html>
  );
}
