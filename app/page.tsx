import type { Metadata } from "next";
import SnackGuardGame from "./SnackGuardGame";

export const metadata: Metadata = {
  title: "おやつ防衛隊！ | ジェスチャーゲーム",
  description: "手のジェスチャーで、ちびっこたちから今日のおやつを守る60秒タワーディフェンス。",
};

export default function Home() {
  return <SnackGuardGame />;
}
