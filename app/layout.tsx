import type { Metadata } from "next";
import { headers } from "next/headers";
import { BASE_PATH } from "./base-path";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("host") || "localhost:3000";
  const protocol =
    requestHeaders.get("x-forwarded-proto") ||
    (host.startsWith("localhost") ? "http" : "https");
  const previewImage = `${protocol}://${host}${BASE_PATH}/og.png`;
  const description = "保存在电脑本地的日程、项目、广播音乐与灵感资料库。";

  return {
    title: "我的日程台",
    description,
    openGraph: {
      title: "我的日程台",
      description,
      images: [{ url: previewImage, width: 1536, height: 1024 }],
    },
    twitter: {
      card: "summary_large_image",
      title: "我的日程台",
      description,
      images: [previewImage],
    },
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
