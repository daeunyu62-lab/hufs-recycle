import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host =
    requestHeaders.get("x-forwarded-host") ??
    requestHeaders.get("host") ??
    "localhost:3000";
  const protocol =
    requestHeaders.get("x-forwarded-proto") ??
    (host.includes("localhost") ? "http" : "https");
  const metadataBase = new URL(`${protocol}://${host}`);
  const description =
    "한국외국어대학교 글로벌캠퍼스 분리배출 마일리지 베타 프로토타입";

  return {
    metadataBase,
    title: {
      default: "HUFS ECO MILE",
      template: "%s | HUFS ECO MILE",
    },
    description,
    icons: {
      icon: "/favicon.svg",
      shortcut: "/favicon.svg",
    },
    openGraph: {
      title: "HUFS ECO MILE",
      description,
      type: "website",
      images: [{ url: "/og.png", width: 1734, height: 907, alt: "HUFS ECO MILE 분리배출 마일리지 베타" }],
    },
    twitter: {
      card: "summary_large_image",
      title: "HUFS ECO MILE",
      description,
      images: ["/og.png"],
    },
  };
}

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
