import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "RevenueScout",
  description:
    "B2B customer discovery, buying-signal intelligence, and revenue opportunity optimisation.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
