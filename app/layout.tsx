import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ROOM RAID 60 | 会議の沈黙を倒すAIゲーム",
  description:
    "60人の声・拍手・選択で会議ボスを倒す、GPT-5.6搭載の参加型ファシリテーションゲーム。",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
  openGraph: {
    title: "ROOM RAID 60",
    description: "60 VOICES. ONE DECISION. 会議の沈黙を、60秒で倒せ。",
    type: "website",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
