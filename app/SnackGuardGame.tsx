"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Phase = "ready" | "playing" | "result";
type CameraState = "idle" | "loading" | "ready" | "error";
type Kid = { id: number; lane: number; x: number; y: number; speed: number; skin: string; shirt: string; hair: string; phase: "approach" | "return"; bob: number; snack: boolean };
type Spark = { x: number; y: number; vx: number; vy: number; life: number; color: string; text?: string };
type Pulse = { x: number; y: number; age: number };

const W = 960;
const H = 600;
const LANES = [170, 325, 480, 635, 790];
const colors = ["#f0786c", "#f3b64e", "#5bb6c9", "#8e76c7", "#67aa61"];
const skins = ["#f1bd8a", "#d99865", "#f6cda2", "#b97952"];

function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number, fill: string, stroke?: string, lw = 3) {
  ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.fillStyle = fill; ctx.fill();
  if (stroke) { ctx.lineWidth = lw; ctx.strokeStyle = stroke; ctx.stroke(); }
}

function pixelText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, fill = "#3c2a2b", align: CanvasTextAlign = "center") {
  ctx.save(); ctx.font = `900 ${size}px "Yu Gothic", sans-serif`; ctx.textAlign = align; ctx.textBaseline = "middle";
  ctx.lineWidth = Math.max(2, size / 7); ctx.strokeStyle = "rgba(255,248,218,.9)"; ctx.strokeText(text, x, y); ctx.fillStyle = fill; ctx.fillText(text, x, y); ctx.restore();
}

function drawKid(ctx: CanvasRenderingContext2D, kid: Kid, now: number) {
  const bob = Math.sin(now * .008 + kid.bob) * 3;
  const dir = kid.phase === "return" ? -1 : 1;
  const x = kid.x, y = kid.y + bob;
  ctx.save(); ctx.translate(x, y); if (kid.phase === "return") ctx.scale(-1, 1);
  ctx.fillStyle = "rgba(52,77,42,.18)"; ctx.fillRect(-23, 29, 46, 9);
  ctx.fillStyle = "#3c2a2b"; ctx.fillRect(-18, 22, 13, 11); ctx.fillRect(5, 22, 13, 11);
  ctx.fillStyle = kid.shirt; ctx.fillRect(-23, -2, 46, 27); ctx.fillRect(-28, 3, 8, 17); ctx.fillRect(20, 3, 8, 17);
  ctx.fillStyle = kid.skin; ctx.fillRect(-26, -35, 52, 38); ctx.fillRect(-21, -41, 42, 10); ctx.fillRect(-31, -28, 7, 17); ctx.fillRect(24, -28, 7, 17);
  ctx.fillStyle = kid.hair; ctx.fillRect(-24, -40, 48, 10); ctx.fillRect(-26, -35, 8, 12); ctx.fillRect(17, -35, 9, 9);
  ctx.fillStyle = "#3c2a2b"; ctx.fillRect(-14, -22, 5, 6); ctx.fillRect(9, -22, 5, 6);
  if (kid.phase === "return") { ctx.fillStyle = "#e95c63"; ctx.fillRect(-5, -10, 10, 4); ctx.fillStyle = "#ffcfde"; ctx.fillRect(-20, -16, 5, 3); ctx.fillRect(15, -16, 5, 3); }
  else { ctx.fillStyle = "#3c2a2b"; ctx.fillRect(-4, -11, 8, 8); }
  if (kid.snack) { ctx.fillStyle = "#b96633"; ctx.fillRect(22 * dir, -2, 13, 13); ctx.fillStyle = "#6b3928"; ctx.fillRect(25 * dir, 1, 3, 3); }
  ctx.restore();
}

function drawTower(ctx: CanvasRenderingContext2D, x: number, y: number, label: string, color: string) {
  ctx.fillStyle = "rgba(46,68,38,.2)"; ctx.fillRect(x - 42, y + 27, 84, 11);
  rr(ctx, x - 38, y - 24, 76, 56, 5, color, "#3c2a2b", 4);
  ctx.fillStyle = "rgba(255,255,255,.35)"; ctx.fillRect(x - 28, y - 14, 56, 8);
  pixelText(ctx, label, x, y + 8, 19);
}

export default function SnackGuardGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const phaseRef = useRef<Phase>("ready");
  const cameraRef = useRef<CameraState>("idle");
  const handRef = useRef({ x: W / 2, y: H / 2, active: false, pinched: false });
  const worldRef = useRef({ kids: [] as Kid[], sparks: [] as Spark[], pulses: [] as Pulse[], score: 0, snacks: 5, time: 60, combo: 0, best: 0, lastSpawn: 0, lastFrame: 0, started: 0, kidId: 0, lastPulse: 0 });
  const [phase, setPhase] = useState<Phase>("ready");
  const [camera, setCamera] = useState<CameraState>("idle");
  const [hud, setHud] = useState({ score: 0, snacks: 5, time: 60, combo: 0, best: 0 });
  const [gesture, setGesture] = useState("マウスでも遊べます");

  const tone = useCallback((freq = 520, duration = .08) => {
    try {
      const AudioCtx = window.AudioContext || (window as typeof window & { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ac = new AudioCtx(); const osc = ac.createOscillator(); const gain = ac.createGain();
      osc.type = "square"; osc.frequency.value = freq; gain.gain.setValueAtTime(.035, ac.currentTime); gain.gain.exponentialRampToValueAtTime(.001, ac.currentTime + duration);
      osc.connect(gain).connect(ac.destination); osc.start(); osc.stop(ac.currentTime + duration); osc.onended = () => ac.close();
    } catch { /* sound is optional */ }
  }, []);

  const makePulse = useCallback((x: number, y: number) => {
    const world = worldRef.current; const now = performance.now();
    if (now - world.lastPulse < 450 || phaseRef.current !== "playing") return;
    world.lastPulse = now; world.pulses.push({ x, y, age: 0 }); tone(680, .12);
    for (let i = 0; i < 12; i++) world.sparks.push({ x, y, vx: Math.cos(i / 12 * Math.PI * 2) * 100, vy: Math.sin(i / 12 * Math.PI * 2) * 100, life: .55, color: i % 2 ? "#fff2a5" : "#f58a72" });
  }, [tone]);

  const resetGame = useCallback(() => {
    const best = Number(localStorage.getItem("snack-guard-best") || 0);
    worldRef.current = { kids: [], sparks: [], pulses: [], score: 0, snacks: 5, time: 60, combo: 0, best, lastSpawn: 0, lastFrame: performance.now(), started: performance.now(), kidId: 0, lastPulse: 0 };
    setHud({ score: 0, snacks: 5, time: 60, combo: 0, best }); phaseRef.current = "playing"; setPhase("playing"); tone(440, .08);
  }, [tone]);

  const startCamera = useCallback(async () => {
    if (cameraRef.current === "ready" || cameraRef.current === "loading") return;
    cameraRef.current = "loading"; setCamera("loading"); setGesture("カメラを準備中…");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } }, audio: false });
      const video = videoRef.current; if (!video) throw new Error("video unavailable");
      video.srcObject = stream; await video.play();
      const visionModule = await import("@mediapipe/tasks-vision");
      const vision = await visionModule.FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm");
      const tracker = await visionModule.HandLandmarker.createFromOptions(vision, { baseOptions: { modelAssetPath: "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task" }, runningMode: "VIDEO", numHands: 1, minHandDetectionConfidence: .45, minTrackingConfidence: .45 });
      cameraRef.current = "ready"; setCamera("ready"); setGesture("手を見せてね");
      let lastVideo = -1; let stopped = false;
      const detect = () => {
        if (stopped || cameraRef.current !== "ready") return;
        if (video.readyState >= 2 && video.currentTime !== lastVideo) {
          lastVideo = video.currentTime; const result = tracker.detectForVideo(video, performance.now()); const marks = result.landmarks[0];
          if (marks) {
            const palm = marks[9], thumb = marks[4], index = marks[8]; const pinch = Math.hypot(thumb.x - index.x, thumb.y - index.y) < .065;
            const x = (1 - palm.x) * W; const y = (.06 + palm.y * .88) * H;
            handRef.current.x += (x - handRef.current.x) * .36; handRef.current.y += (y - handRef.current.y) * .36; handRef.current.active = true;
            if (pinch && !handRef.current.pinched) makePulse(handRef.current.x, handRef.current.y);
            handRef.current.pinched = pinch; setGesture(pinch ? "つまんで バリア！" : "手を動かして ガード");
          } else { handRef.current.active = false; handRef.current.pinched = false; setGesture("手を見せてね"); }
        }
        requestAnimationFrame(detect);
      };
      detect();
      return () => { stopped = true; tracker.close(); };
    } catch {
      cameraRef.current = "error"; setCamera("error"); setGesture("マウス操作に切替えました"); handRef.current.active = true;
    }
  }, [makePulse]);

  const start = (withCamera: boolean) => { resetGame(); if (withCamera) void startCamera(); else { cameraRef.current = "idle"; setCamera("idle"); setGesture("動かす＋クリックでバリア"); handRef.current.active = true; } };

  const defendKid = useCallback((kid: Kid) => {
    if (kid.phase === "return") return;
    kid.phase = "return"; const world = worldRef.current; world.combo++; world.score += 100 + Math.min(world.combo, 10) * 15;
    const phrases = ["またね！", "おうちへGO", "にこにこ", "えらい！"];
    world.sparks.push({ x: kid.x, y: kid.y - 38, vx: 0, vy: -28, life: .9, color: "#fff", text: phrases[kid.id % phrases.length] });
    for (let i = 0; i < 5; i++) world.sparks.push({ x: kid.x, y: kid.y, vx: (Math.random() - .5) * 90, vy: -30 - Math.random() * 70, life: .65, color: colors[(kid.id + i) % colors.length] });
    tone(520 + Math.min(world.combo, 6) * 45, .06);
  }, [tone]);

  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return; const ctx = canvas.getContext("2d"); if (!ctx) return;
    let raf = 0; let lastHud = 0;
    const loop = (now: number) => {
      const world = worldRef.current; const dt = Math.min(.035, Math.max(.001, (now - (world.lastFrame || now)) / 1000)); world.lastFrame = now;
      if (phaseRef.current === "playing") {
        world.time = Math.max(0, 60 - (now - world.started) / 1000);
        const interval = Math.max(620, 1400 - (60 - world.time) * 12);
        if (now - world.lastSpawn > interval) {
          world.lastSpawn = now; const lane = Math.floor(Math.random() * LANES.length); const id = world.kidId++;
          world.kids.push({ id, lane, x: LANES[lane], y: -45, speed: 32 + Math.random() * 20 + (60 - world.time) * .42, skin: skins[id % skins.length], shirt: colors[id % colors.length], hair: ["#4c3028", "#7b4a2b", "#342927"][id % 3], phase: "approach", bob: Math.random() * 6, snack: false });
        }
        const hand = handRef.current;
        for (const kid of world.kids) {
          if (kid.phase === "approach") {
            kid.y += kid.speed * dt;
            if (hand.active && Math.hypot(kid.x - hand.x, kid.y - hand.y) < 62) defendKid(kid);
            for (const p of world.pulses) { const radius = p.age * 520; if (Math.abs(Math.hypot(kid.x - p.x, kid.y - p.y) - radius) < 45) defendKid(kid); }
            if (kid.y > 505 && kid.phase === "approach") { kid.phase = "return"; kid.snack = true; world.snacks--; world.combo = 0; tone(170, .18); world.sparks.push({ x: kid.x, y: 478, vx: 0, vy: -20, life: 1, color: "#fff", text: "ひとつ もらった！" }); }
          } else { kid.y -= (kid.speed * 1.35) * dt; kid.x += (LANES[kid.lane] - kid.x) * dt; }
        }
        world.kids = world.kids.filter(k => k.y > -80);
        world.pulses.forEach(p => p.age += dt); world.pulses = world.pulses.filter(p => p.age < .52);
        world.sparks.forEach(s => { s.x += s.vx * dt; s.y += s.vy * dt; s.vy += 75 * dt; s.life -= dt; }); world.sparks = world.sparks.filter(s => s.life > 0);
        if (world.time <= 0 || world.snacks <= 0) {
          phaseRef.current = "result"; setPhase("result"); world.best = Math.max(world.best, world.score); localStorage.setItem("snack-guard-best", String(world.best)); tone(world.snacks > 0 ? 780 : 220, .3);
        }
        if (now - lastHud > 120) { lastHud = now; setHud({ score: world.score, snacks: world.snacks, time: Math.ceil(world.time), combo: world.combo, best: world.best }); }
      }

      ctx.clearRect(0, 0, W, H); ctx.imageSmoothingEnabled = false;
      ctx.fillStyle = "#8bd16e"; ctx.fillRect(0, 0, W, H);
      for (let yy = 0; yy < H; yy += 32) for (let xx = 0; xx < W; xx += 32) { ctx.fillStyle = (xx / 32 + yy / 32) % 2 ? "rgba(74,146,75,.09)" : "rgba(255,255,210,.08)"; ctx.fillRect(xx, yy, 32, 32); }
      for (const x of LANES) { ctx.fillStyle = "#d7c88f"; ctx.fillRect(x - 44, 0, 88, H); ctx.fillStyle = "rgba(255,250,210,.28)"; ctx.fillRect(x - 36, 0, 9, H); }
      ctx.fillStyle = "#6da95a"; ctx.fillRect(0, 0, W, 34); for (let x = 0; x < W; x += 45) { ctx.fillStyle = x % 90 ? "#f7e66c" : "#fff6d2"; ctx.fillRect(x + 8, 12, 6, 6); }
      drawTower(ctx, 76, 300, "ガラガラ", "#eaa65f"); drawTower(ctx, 884, 300, "えほん", "#71b5ca");
      rr(ctx, 382, 510, 196, 74, 8, "#c56d42", "#3c2a2b", 5); ctx.fillStyle = "#f1c55e"; ctx.fillRect(399, 526, 162, 12); ctx.fillStyle = "#fff0a0"; ctx.fillRect(415, 500, 30, 33); ctx.fillRect(465, 495, 30, 38); ctx.fillRect(515, 501, 27, 32); pixelText(ctx, "おやつ", 480, 563, 22, "#fff4c5");
      for (const kid of world.kids) drawKid(ctx, kid, now);
      for (const p of world.pulses) { const r = p.age * 520; ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.strokeStyle = `rgba(255,244,125,${1 - p.age / .52})`; ctx.lineWidth = 18 - p.age * 20; ctx.stroke(); ctx.beginPath(); ctx.arc(p.x, p.y, r + 9, 0, Math.PI * 2); ctx.strokeStyle = `rgba(243,111,104,${.8 - p.age})`; ctx.lineWidth = 5; ctx.stroke(); }
      for (const s of world.sparks) { if (s.text) pixelText(ctx, s.text, s.x, s.y, 16, "#d34d50"); else { ctx.fillStyle = s.color; ctx.fillRect(s.x - 4, s.y - 4, 8, 8); } }
      if (handRef.current.active && phaseRef.current === "playing") { const h = handRef.current; ctx.beginPath(); ctx.arc(h.x, h.y, 48, 0, Math.PI * 2); ctx.fillStyle = "rgba(255,241,111,.22)"; ctx.fill(); ctx.lineWidth = 5; ctx.strokeStyle = h.pinched ? "#f26367" : "#fff07a"; ctx.stroke(); ctx.fillStyle = "#fff"; ctx.fillRect(h.x - 4, h.y - 16, 8, 32); ctx.fillRect(h.x - 16, h.y - 4, 32, 8); }
      if (phaseRef.current === "playing" && world.combo >= 3) pixelText(ctx, `${world.combo} コンボ！`, W / 2, 60, 27, "#e85e50");
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop); return () => cancelAnimationFrame(raf);
  }, [defendKid, tone]);

  const pointFromEvent = (clientX: number, clientY: number) => {
    const rect = canvasRef.current?.getBoundingClientRect(); if (!rect) return;
    handRef.current.x = (clientX - rect.left) / rect.width * W; handRef.current.y = (clientY - rect.top) / rect.height * H; handRef.current.active = true;
  };
  useEffect(() => {
    const key = (e: KeyboardEvent) => { if (e.code === "Space") { e.preventDefault(); makePulse(handRef.current.x, handRef.current.y); } };
    window.addEventListener("keydown", key); return () => window.removeEventListener("keydown", key);
  }, [makePulse]);

  const camLabel = camera === "ready" ? "カメラ認識 OK" : camera === "loading" ? "カメラ準備中" : camera === "error" ? "マウスでプレイ中" : "カメラ OFF";
  const resultTitle = hud.snacks > 0 ? "おやつを守った！" : "みんなでおやつタイム！";
  return (
    <main className="game-page">
      <section className="cabinet" aria-label="おやつ防衛隊ゲーム">
        <header className="topbar">
          <div className="brand"><div className="brand-mark" aria-hidden="true">🍪</div><div><div className="eyebrow">GESTURE TOWER DEFENSE</div><h1>おやつ防衛隊！</h1></div></div>
          <div className="hud" aria-live="polite">
            <div className="hud-chip"><span>のこり</span><strong>{hud.time}秒</strong></div>
            <div className={`hud-chip ${hud.snacks <= 2 ? "danger" : ""}`}><span>おやつ</span><strong>{"🍪".repeat(Math.max(0, hud.snacks)) || "0"}</strong></div>
            <div className="hud-chip"><span>スコア</span><strong>{hud.score.toLocaleString()}</strong></div>
          </div>
        </header>
        <div className="play-grid">
          <div className="screen-shell">
            <canvas ref={canvasRef} className="game-canvas" width={W} height={H} aria-label="おやつを守るゲーム画面" onPointerMove={e => pointFromEvent(e.clientX, e.clientY)} onPointerDown={e => { pointFromEvent(e.clientX, e.clientY); makePulse(handRef.current.x, handRef.current.y); }} />
            <video ref={videoRef} className="camera-pip" muted playsInline hidden={camera !== "ready"} aria-label="手の認識用カメラ映像" />
            {camera === "ready" && <span className="camera-dot" aria-hidden="true" />}
            {phase === "playing" && <div className="gesture-toast">{gesture}</div>}
            {phase !== "playing" && (
              <div className="screen-overlay">
                <div className="start-card">
                  {phase === "ready" ? <><p className="tiny">60秒のやさしい防衛ミッション</p><h2>今日のおやつを<br />守りきろう！</h2><p>カメラに手を映して、近づくちびっこをガード。びっくりさせず、にこにこでおうちへ帰してあげよう。</p><div className="howto"><div><b>🖐️</b>手を動かす<br />ガードを移動</div><div><b>🤏</b>指をつまむ<br />広がるバリア</div></div></> : <><p className="tiny">MISSION COMPLETE</p><h2>{resultTitle}</h2><p>スコア <strong>{hud.score.toLocaleString()}</strong> ／ ベスト <strong>{Math.max(hud.best, hud.score).toLocaleString()}</strong><br />守ったおやつは {Math.max(0, hud.snacks)} こでした。</p></>}
                  <div className="start-actions"><button className="pixel-button" onClick={() => start(true)}>📷 カメラでスタート</button><button className="pixel-button secondary" onClick={() => start(false)}>🖱️ マウスで遊ぶ</button></div>
                </div>
              </div>
            )}
          </div>
          <aside className="side-panel">
            <section className="info-card"><h2>📡 ジェスチャー</h2><div className="status-line"><span className={`status-light ${camera}`} />{camLabel}</div></section>
            <section className="info-card controls"><h2>🎮 あそびかた</h2><ul className="control-list"><li><span className="key">🖐️</span><span>手を左右・上下に動かしてガード</span></li><li><span className="key">🤏</span><span>親指と人差し指をつまんでバリア</span></li><li><span className="key">↖</span><span>マウス移動＋クリックでも操作OK</span></li><li><span className="key">空</span><span>スペースキーでもバリア発動</span></li></ul></section>
            <section className="info-card mission"><h2>🏡 今日のミッション</h2><p>ちびっこは敵じゃないよ。ガードに触れると、にこにこ笑って画面の外へ帰ります。</p></section>
          </aside>
        </div>
        <div className="footer-note">カメラ映像は端末内のジェスチャー認識だけに使い、保存・送信しません。</div>
      </section>
    </main>
  );
}
