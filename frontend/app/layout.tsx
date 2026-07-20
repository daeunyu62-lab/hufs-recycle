import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "HUFS Recycle",
  description: "HUFS campus recycling verification service",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}

