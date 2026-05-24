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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.variable}>
        <header className="header">
          <a href="/" className="header-logo">
            <div className="header-logo-icon">A</div>
            <span className="header-logo-text">Allo Inventory</span>
          </a>
          <span className="header-badge">Live Demo</span>
        </header>
        <main>{children}</main>
      </body>
    </html>
  );
}
