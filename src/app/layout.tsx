import type { Metadata } from "next";
import { Inter } from "next/font/google"; // 改用 Google 字型，自動下載
import "./globals.css";

// 設定 Google Inter 字型
const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Arin Slate 工具大全",
  description: "城市情報中心 - 您的地圖決策系統",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-TW">
      <body
        className={inter.className} // 套用 Google 字型
        suppressHydrationWarning={true} // 忽略外掛警告
      >
        {children}
      </body>
    </html>
  );
}