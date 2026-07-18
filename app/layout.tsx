import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "おやつ防衛隊！",
  description: "手を動かしておやつを守る、やさしいピクセル・タワーディフェンス。",
  openGraph: {
    title: "おやつ防衛隊！",
    description: "カメラに手をかざして、ちびっこたちを楽しくおうちへ帰そう。",
    type: "website",
    images: [{ url: "/og.png", width: 1536, height: 1024, alt: "おやつ防衛隊！" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "おやつ防衛隊！",
    description: "手のジェスチャーで遊ぶ60秒タワーディフェンス",
    images: ["/og.png"],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ja"><body>{children}</body></html>;
}
