"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Phase = "ready" | "playing" | "result";
type CameraState = "idle" | "loading" | "ready" | "error";
type Kid = { id: number; lane: number; x: number; y: number; speed: number; skin: string; shirt: string; hair: string; phase: "approach" | "return"; bob: number; snack: boolean };
type Spark = { x: number; y: number; vx: number; vy: number; life: number; color: string; text?: string };
type ToyKind = "normal" | "strong";
type Pulse = { x: number; y: number; age: number; ttl: number; used: boolean; kind: ToyKind; hits: number };
type Placement = { x: number; y: number; lane: number };

const W = 960;
const H = 600;
const LANES = [170, 325, 480, 635, 790];
const colors = ["#f0786c", "#f3b64e", "#5bb6c9", "#8e76c7", "#67aa61"];
const skins = ["#f1bd8a", "#d99865", "#f6cda2", "#b97952"];
const PLACEMENT_TOP = 105;
const PLACEMENT_BOTTOM = 425;

function snapPlacement(x: number, y: number): Placement {
  let lane = 0;
  for (let i = 1; i < LANES.length; i++) {
    if (Math.abs(LANES[i] - x) < Math.abs(LANES[lane] - x)) lane = i;
  }
  return { x: LANES[lane], y: Math.max(PLACEMENT_TOP, Math.min(PLACEMENT_BOTTOM, y)), lane };
}

function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number, fill: string, stroke?: string, lw = 3) {
  ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.fillStyle = fill; ctx.fill();
  if (stroke) { ctx.lineWidth = lw; ctx.strokeStyle = stroke; ctx.stroke(); }
}

function pixelText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, fill = "#3c2a2b", align: CanvasTextAlign = "center") {
  ctx.save(); ctx.font = `900 ${size}px "Yu Gothic", sans-serif`; ctx.textAlign = align; ctx.textBaseline = "middle";
  ctx.lineWidth = Math.max(2, size / 7); ctx.strokeStyle = "rgba(255,248,218,.9)"; ctx.strokeText(text, x, y); ctx.fillStyle = fill; ctx.fillText(text, x, y); ctx.restore();
}

function drawKid(ctx: CanvasRenderingContext2D, kid: Kid, now: number, atlas?: HTMLImageElement | null) {
  const bob = Math.sin(now * .008 + kid.bob) * 3;
  const dir = kid.phase === "return" ? -1 : 1;
  const x = kid.x, y = kid.y + bob;
  ctx.save(); ctx.translate(x, y); if (kid.phase === "return") ctx.scale(-1, 1);
  ctx.fillStyle = "rgba(52,77,42,.18)"; ctx.fillRect(-23, 29, 46, 9);
  if (atlas?.complete && atlas.naturalWidth > 0) {
    const cellW = atlas.naturalWidth / 2; const cellH = atlas.naturalHeight / 2; const index = kid.id % 4;
    ctx.drawImage(atlas, (index % 2) * cellW, Math.floor(index / 2) * cellH, cellW, cellH, -43, -52, 86, 86);
    if (kid.snack) { ctx.fillStyle = "#b96633"; ctx.beginPath(); ctx.arc(29, 2, 8, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = "#6b3928"; ctx.fillRect(27, -1, 3, 3); ctx.fillRect(31, 3, 3, 3); }
    ctx.restore(); return;
  }
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

function drawPlacementPreview(ctx: CanvasRenderingContext2D, rawX: number, rawY: number, kind: ToyKind) {
  const spot = snapPlacement(rawX, rawY);
  const strong = kind === "strong";
  ctx.save();
  ctx.fillStyle = strong ? "rgba(101,91,213,.13)" : "rgba(255,216,90,.16)";
  ctx.fillRect(spot.x - 44, 34, 88, 420);
  if (Math.abs(rawX - spot.x) > 8) {
    ctx.beginPath(); ctx.moveTo(rawX, rawY); ctx.lineTo(spot.x, spot.y);
    ctx.strokeStyle = strong ? "rgba(81,72,163,.72)" : "rgba(117,80,57,.72)";
    ctx.lineWidth = 3; ctx.setLineDash([7, 7]); ctx.stroke(); ctx.setLineDash([]);
  }
  ctx.translate(spot.x, spot.y);
  ctx.globalAlpha = .72;
  ctx.beginPath(); ctx.arc(0, 0, strong ? 62 : 55, 0, Math.PI * 2);
  ctx.fillStyle = strong ? "rgba(184,245,255,.55)" : "rgba(255,242,165,.62)"; ctx.fill();
  ctx.strokeStyle = strong ? "#5148a3" : "#d36a62"; ctx.lineWidth = 5; ctx.setLineDash([10, 7]); ctx.stroke(); ctx.setLineDash([]);
  if (strong) {
    rr(ctx, -22, -19, 44, 42, 8, "#7bb1ea", "#383372", 4);
    rr(ctx, -18, -44, 36, 27, 7, "#a9e7f4", "#383372", 4);
    ctx.fillStyle = "#383372"; ctx.beginPath(); ctx.arc(-8, -31, 3, 0, Math.PI * 2); ctx.arc(8, -31, 3, 0, Math.PI * 2); ctx.fill();
  } else {
    ctx.fillStyle = "#d99a58"; ctx.strokeStyle = "#6b4534"; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(-17, -20, 8, 0, Math.PI * 2); ctx.arc(17, -20, 8, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.arc(0, -2, 23, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = "#3c2a2b"; ctx.beginPath(); ctx.arc(-7, -5, 3, 0, Math.PI * 2); ctx.arc(7, -5, 3, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;
  pixelText(ctx, `レーン ${spot.lane + 1}・ここに置く`, 0, 76, 15, strong ? "#5148a3" : "#755039");
  ctx.restore();
}

export default function SnackGuardGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const kidAtlasRef = useRef<HTMLImageElement | null>(null);
  const nurseryBgRef = useRef<HTMLImageElement | null>(null);
  const snackBasketRef = useRef<HTMLImageElement | null>(null);
  const phaseRef = useRef<Phase>("ready");
  const cameraRef = useRef<CameraState>("idle");
  const handRef = useRef({ x: W / 2, y: H / 2, active: false, pinched: false, vSigned: false, previewKind: "normal" as ToyKind });
  const worldRef = useRef({ kids: [] as Kid[], sparks: [] as Spark[], pulses: [] as Pulse[], score: 0, snacks: 5, time: 60, combo: 0, best: 0, lastSpawn: 0, lastFrame: 0, started: 0, kidId: 0, lastPulse: 0 });
  const [phase, setPhase] = useState<Phase>("ready");
  const [camera, setCamera] = useState<CameraState>("idle");
  const [hud, setHud] = useState({ score: 0, snacks: 5, time: 60, combo: 0, best: 0 });
  const [gesture, setGesture] = useState("マウスでも遊べます");

  useEffect(() => {
    const atlas = new Image(); atlas.src = "/kids-atlas.png"; kidAtlasRef.current = atlas;
    const nursery = new Image(); nursery.src = "/nursery-bg.png"; nurseryBgRef.current = nursery;
    const snacks = new Image(); snacks.src = "/snack-basket.png"; snackBasketRef.current = snacks;
    return () => { kidAtlasRef.current = null; nurseryBgRef.current = null; snackBasketRef.current = null; };
  }, []);

  const tone = useCallback((freq = 520, duration = .08) => {
    try {
      const AudioCtx = window.AudioContext || (window as typeof window & { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ac = new AudioCtx(); const osc = ac.createOscillator(); const gain = ac.createGain();
      osc.type = "square"; osc.frequency.value = freq; gain.gain.setValueAtTime(.035, ac.currentTime); gain.gain.exponentialRampToValueAtTime(.001, ac.currentTime + duration);
      osc.connect(gain).connect(ac.destination); osc.start(); osc.stop(ac.currentTime + duration); osc.onended = () => ac.close();
    } catch { /* sound is optional */ }
  }, []);

  const makePulse = useCallback((x: number, y: number, kind: ToyKind = "normal") => {
    const world = worldRef.current; const now = performance.now();
    if (now - world.lastPulse < 650 || phaseRef.current !== "playing") return;
    const spot = snapPlacement(x, y); x = spot.x; y = spot.y;
    world.lastPulse = now;
    const limit = kind === "strong" ? 3 : 5;
    const sameKind = world.pulses.filter(p => p.kind === kind);
    if (sameKind.length >= limit) {
      const oldest = sameKind.reduce((a, b) => a.age > b.age ? a : b);
      world.pulses = world.pulses.filter(p => p !== oldest);
    }
    const strong = kind === "strong";
    world.pulses.push({ x, y, age: 0, ttl: strong ? 12 : 4.5, used: false, kind, hits: strong ? 3 : 1 });
    tone(strong ? 820 : 680, strong ? .18 : .12);
    for (let i = 0; i < 12; i++) world.sparks.push({ x, y, vx: Math.cos(i / 12 * Math.PI * 2) * (strong ? 130 : 100), vy: Math.sin(i / 12 * Math.PI * 2) * (strong ? 130 : 100), life: .55, color: strong ? (i % 2 ? "#b8f5ff" : "#7d73e6") : (i % 2 ? "#fff2a5" : "#f58a72") });
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
            const fingerUp = (tip: number, pip: number) => marks[tip].y < marks[pip].y - .025;
            const vSign = fingerUp(8, 6) && fingerUp(12, 10) && !fingerUp(16, 14) && !fingerUp(20, 18)
              && Math.hypot(marks[8].x - marks[12].x, marks[8].y - marks[12].y) > .075;
            const x = (1 - palm.x) * W; const y = (.06 + palm.y * .88) * H;
            handRef.current.x += (x - handRef.current.x) * .36; handRef.current.y += (y - handRef.current.y) * .36; handRef.current.active = true;
            handRef.current.previewKind = vSign ? "strong" : "normal";
            if (vSign && !handRef.current.vSigned) makePulse(handRef.current.x, handRef.current.y, "strong");
            else if (pinch && !handRef.current.pinched && !vSign) makePulse(handRef.current.x, handRef.current.y, "normal");
            handRef.current.pinched = pinch; handRef.current.vSigned = vSign;
            setGesture(vSign ? "Vサイン！ つよいおもちゃを設置" : pinch ? "おもちゃを置いたよ！" : "つまむ＝通常 ／ Vサイン＝つよい");
          } else { handRef.current.active = false; handRef.current.pinched = false; handRef.current.vSigned = false; handRef.current.previewKind = "normal"; setGesture("手を見せてね"); }
        }
        requestAnimationFrame(detect);
      };
      detect();
      return () => { stopped = true; tracker.close(); };
    } catch {
      cameraRef.current = "error"; setCamera("error"); setGesture("マウス操作に切替えました"); handRef.current.active = true;
    }
  }, [makePulse]);

  const start = (withCamera: boolean) => { resetGame(); if (withCamera) void startCamera(); else { cameraRef.current = "idle"; setCamera("idle"); setGesture("クリック＝通常 ／ Shift＋クリック＝つよい"); handRef.current.active = true; } };

  const defendKid = useCallback((kid: Kid) => {
    if (kid.phase === "return") return;
    kid.phase = "return"; const world = worldRef.current; world.combo++; world.score += 100 + Math.min(world.combo, 10) * 15;
    const phrases = ["ありがとう！", "ねんねするね", "またね！", "おうちへ帰るね", "ばいばーい！"];
    world.sparks.push({ x: kid.x, y: kid.y - 58, vx: 0, vy: -10, life: 1.65, color: "#fff", text: phrases[kid.id % phrases.length] });
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
        for (const kid of world.kids) {
          if (kid.phase === "approach") {
            kid.y += kid.speed * dt;
            for (const p of world.pulses) {
              const reach = p.kind === "strong" ? 62 : 54;
              if (!p.used && Math.hypot(kid.x - p.x, kid.y - p.y) < reach) {
                p.hits--;
                p.used = p.hits <= 0;
                defendKid(kid);
                if (p.kind === "strong" && p.hits > 0) {
                  world.sparks.push({ x: p.x, y: p.y - 58, vx: 0, vy: -8, life: .8, color: "#fff", text: `あと${p.hits}回` });
                }
                break;
              }
            }
            if (kid.y > 505 && kid.phase === "approach") { kid.phase = "return"; kid.snack = true; world.snacks--; world.combo = 0; tone(170, .18); world.sparks.push({ x: kid.x, y: 478, vx: 0, vy: -20, life: 1, color: "#fff", text: "ひとつ もらった！" }); }
          } else { kid.y -= (kid.speed * 1.35) * dt; kid.x += (LANES[kid.lane] - kid.x) * dt; }
        }
        world.kids = world.kids.filter(k => k.y > -80);
        world.pulses.forEach(p => p.age += dt); world.pulses = world.pulses.filter(p => !p.used && p.age < p.ttl);
        world.sparks.forEach(s => { s.x += s.vx * dt; s.y += s.vy * dt; s.vy += 75 * dt; s.life -= dt; }); world.sparks = world.sparks.filter(s => s.life > 0);
        if (world.time <= 0 || world.snacks <= 0) {
          phaseRef.current = "result"; setPhase("result"); world.best = Math.max(world.best, world.score); localStorage.setItem("snack-guard-best", String(world.best)); tone(world.snacks > 0 ? 780 : 220, .3);
        }
        if (now - lastHud > 120) { lastHud = now; setHud({ score: world.score, snacks: world.snacks, time: Math.ceil(world.time), combo: world.combo, best: world.best }); }
      }

      ctx.clearRect(0, 0, W, H); ctx.imageSmoothingEnabled = true;
      const nursery = nurseryBgRef.current;
      if (nursery?.complete && nursery.naturalWidth > 0) ctx.drawImage(nursery, 0, 0, W, H);
      else {
        ctx.fillStyle = "#8bd16e"; ctx.fillRect(0, 0, W, H);
        for (let yy = 0; yy < H; yy += 32) for (let xx = 0; xx < W; xx += 32) { ctx.fillStyle = (xx / 32 + yy / 32) % 2 ? "rgba(74,146,75,.09)" : "rgba(255,255,210,.08)"; ctx.fillRect(xx, yy, 32, 32); }
      }
      for (const x of LANES) { ctx.fillStyle = "#d7c88f"; ctx.fillRect(x - 44, 0, 88, H); ctx.fillStyle = "rgba(255,250,210,.28)"; ctx.fillRect(x - 36, 0, 9, H); }
      ctx.fillStyle = "#6da95a"; ctx.fillRect(0, 0, W, 34); for (let x = 0; x < W; x += 45) { ctx.fillStyle = x % 90 ? "#f7e66c" : "#fff6d2"; ctx.fillRect(x + 8, 12, 6, 6); }
      drawTower(ctx, 76, 300, "ガラガラ", "#eaa65f"); drawTower(ctx, 884, 300, "えほん", "#71b5ca");
      const snackBasket = snackBasketRef.current;
      if (snackBasket?.complete && snackBasket.naturalWidth > 0) ctx.drawImage(snackBasket, 382, 438, 196, 160);
      else { rr(ctx, 382, 510, 196, 74, 8, "#c56d42", "#3c2a2b", 5); ctx.fillStyle = "#f1c55e"; ctx.fillRect(399, 526, 162, 12); ctx.fillStyle = "#fff0a0"; ctx.fillRect(415, 500, 30, 33); ctx.fillRect(465, 495, 30, 38); ctx.fillRect(515, 501, 27, 32); pixelText(ctx, "おやつ", 480, 563, 22, "#fff4c5"); }
      for (const kid of world.kids) drawKid(ctx, kid, now, kidAtlasRef.current);
      for (const p of world.pulses) {
        const fade = Math.min(1, (p.ttl - p.age) * 2.5);
        ctx.save(); ctx.globalAlpha = fade; ctx.translate(p.x, p.y);
        if (p.kind === "strong") {
          // The blue wind-up robot is larger and visually distinct from the one-use bear.
          ctx.beginPath(); ctx.ellipse(0, 17, 56, 28, 0, 0, Math.PI * 2); ctx.fillStyle = "#c8efff"; ctx.fill(); ctx.lineWidth = 5; ctx.strokeStyle = "#5650a8"; ctx.stroke();
          rr(ctx, -28, -18, 56, 51, 10, "#6f9fe8", "#383372", 5);
          rr(ctx, -23, -49, 46, 35, 9, "#9adcf2", "#383372", 5);
          ctx.fillStyle = "#383372"; ctx.beginPath(); ctx.arc(-10, -33, 4, 0, Math.PI * 2); ctx.arc(10, -33, 4, 0, Math.PI * 2); ctx.fill();
          ctx.strokeStyle = "#383372"; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(0, -49); ctx.lineTo(0, -59); ctx.stroke(); ctx.beginPath(); ctx.arc(0, -62, 5, 0, Math.PI * 2); ctx.fillStyle = "#ffcc58"; ctx.fill(); ctx.stroke();
          ctx.fillStyle = "#fff"; ctx.font = '900 16px "Yu Gothic", sans-serif'; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(`♥ ${p.hits}`, 0, 7);
          pixelText(ctx, `耐久 ${p.hits}/3`, 0, -78, 14, "#5148a3");
        } else {
          ctx.beginPath(); ctx.ellipse(0, 15, 48, 25, 0, 0, Math.PI * 2); ctx.fillStyle = "#fff2a8"; ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = "#d36a62"; ctx.stroke();
          ctx.beginPath(); ctx.arc(0, -2, 25, 0, Math.PI * 2); ctx.fillStyle = "#d99a58"; ctx.fill(); ctx.strokeStyle = "#6b4534"; ctx.stroke();
          ctx.beginPath(); ctx.arc(-20, -22, 9, 0, Math.PI * 2); ctx.arc(20, -22, 9, 0, Math.PI * 2); ctx.fillStyle = "#d99a58"; ctx.fill(); ctx.stroke();
          ctx.fillStyle = "#3c2a2b"; ctx.beginPath(); ctx.arc(-8, -5, 3, 0, Math.PI * 2); ctx.arc(8, -5, 3, 0, Math.PI * 2); ctx.fill();
          ctx.beginPath(); ctx.arc(0, 4, 5, 0, Math.PI * 2); ctx.fillStyle = "#6b4534"; ctx.fill();
        }
        if (p.age < .3) { ctx.beginPath(); ctx.arc(0, 0, 54 + p.age * 45, 0, Math.PI * 2); ctx.strokeStyle = `rgba(255,255,255,${1 - p.age / .3})`; ctx.lineWidth = 7; ctx.stroke(); }
        ctx.restore();
      }
      if (handRef.current.active && phaseRef.current === "playing") {
        const h = handRef.current;
        drawPlacementPreview(ctx, h.x, h.y, h.previewKind);
      }
      if (phaseRef.current === "playing") {
        const normalCount = world.pulses.filter(p => p.kind === "normal").length;
        const strongCount = world.pulses.filter(p => p.kind === "strong").length;
        pixelText(ctx, `くま ${normalCount}/5`, W - 86, 57, 15, "#755039");
        pixelText(ctx, `ロボ ${strongCount}/3`, W - 86, 80, 15, "#5148a3");
      }
      for (const s of world.sparks) {
        if (s.text) {
          ctx.save(); ctx.font = '900 17px "Yu Gothic", sans-serif'; const bubbleW = Math.max(104, ctx.measureText(s.text).width + 30); const bubbleX = Math.max(8, Math.min(W - bubbleW - 8, s.x - bubbleW / 2)); const bubbleY = Math.max(42, s.y - 25);
          rr(ctx, bubbleX, bubbleY, bubbleW, 42, 18, "rgba(255,255,255,.96)", "#6b4534", 3);
          ctx.beginPath(); ctx.moveTo(s.x - 8, bubbleY + 40); ctx.lineTo(s.x, bubbleY + 52); ctx.lineTo(s.x + 8, bubbleY + 40); ctx.fillStyle = "#fff"; ctx.fill(); ctx.strokeStyle = "#6b4534"; ctx.lineWidth = 3; ctx.stroke();
          pixelText(ctx, s.text, bubbleX + bubbleW / 2, bubbleY + 21, 17, "#d34d50"); ctx.restore();
        } else { ctx.fillStyle = s.color; ctx.fillRect(s.x - 4, s.y - 4, 8, 8); }
      }
      if (handRef.current.active && phaseRef.current === "playing") { const h = handRef.current; ctx.beginPath(); ctx.arc(h.x, h.y, 22, 0, Math.PI * 2); ctx.fillStyle = h.vSigned ? "rgba(105,213,255,.32)" : "rgba(255,241,111,.28)"; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = h.vSigned ? "#655bd5" : h.pinched ? "#f26367" : "#fff"; ctx.stroke(); pixelText(ctx, h.vSigned ? "V" : "+", h.x, h.y, 18, h.vSigned ? "#5148a3" : h.pinched ? "#f26367" : "#755039"); }
      if (phaseRef.current === "playing" && world.combo >= 3) pixelText(ctx, `${world.combo} コンボ！`, W / 2, 60, 27, "#e85e50");
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop); return () => cancelAnimationFrame(raf);
  }, [defendKid, tone]);

  const pointFromEvent = (clientX: number, clientY: number, kind: ToyKind = "normal") => {
    const rect = canvasRef.current?.getBoundingClientRect(); if (!rect) return;
    handRef.current.x = (clientX - rect.left) / rect.width * W; handRef.current.y = (clientY - rect.top) / rect.height * H; handRef.current.active = true; handRef.current.previewKind = kind;
  };
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.code === "Space") { e.preventDefault(); handRef.current.previewKind = "normal"; makePulse(handRef.current.x, handRef.current.y, "normal"); }
      if (e.code === "KeyS" && !e.repeat) { e.preventDefault(); handRef.current.previewKind = "strong"; makePulse(handRef.current.x, handRef.current.y, "strong"); }
    };
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
            <canvas ref={canvasRef} className="game-canvas" width={W} height={H} aria-label="おやつを守るゲーム画面" onPointerMove={e => pointFromEvent(e.clientX, e.clientY, e.shiftKey ? "strong" : "normal")} onPointerDown={e => { const kind = e.shiftKey ? "strong" : "normal"; pointFromEvent(e.clientX, e.clientY, kind); makePulse(handRef.current.x, handRef.current.y, kind); }} />
            <video ref={videoRef} className="camera-pip" muted playsInline hidden={camera !== "ready"} aria-label="手の認識用カメラ映像" />
            {camera === "ready" && <span className="camera-dot" aria-hidden="true" />}
            {phase === "playing" && <div className="gesture-toast">{gesture}</div>}
            {phase !== "playing" && (
              <div className="screen-overlay">
                <div className="start-card">
                  {phase === "ready" ? <><p className="tiny">60秒のやさしい防衛ミッション</p><h2>今日のおやつを<br />守りきろう！</h2><p>2種類のおもちゃを置こう。ちびっこがおもちゃに触れると、にこにこでおうちへ帰るよ。</p><div className="howto"><div><b>🤏</b>つまむ<br />くま（1回・最大5）</div><div><b>✌️</b>Vサイン<br />ロボ（3回・最大3）</div></div></> : <><p className="tiny">MISSION COMPLETE</p><h2>{resultTitle}</h2><p>スコア <strong>{hud.score.toLocaleString()}</strong> ／ ベスト <strong>{Math.max(hud.best, hud.score).toLocaleString()}</strong><br />守ったおやつは {Math.max(0, hud.snacks)} こでした。</p></>}
                  <div className="start-actions"><button className="pixel-button" onClick={() => start(true)}>📷 カメラでスタート</button><button className="pixel-button secondary" onClick={() => start(false)}>🖱️ マウスで遊ぶ</button></div>
                </div>
              </div>
            )}
          </div>
          <aside className="side-panel">
            <section className="info-card"><h2>📡 ジェスチャー</h2><div className="status-line"><span className={`status-light ${camera}`} />{camLabel}</div></section>
            <section className="info-card controls"><h2>🎮 あそびかた</h2><ul className="control-list"><li><span className="key">↔</span><span>手を動かす：光るレーンへ自動吸着</span></li><li><span className="key">🤏</span><span>つまむ：くま（1回・最大5個）</span></li><li><span className="key">✌️</span><span>Vサイン：つよいロボ（3回・最大3個）</span></li><li><span className="key">↖</span><span>クリック：くま／Shift＋クリック：ロボ</span></li><li><span className="key">空/S</span><span>Space：くま／S：ロボ</span></li></ul></section>
            <section className="info-card mission"><h2>🏡 今日のミッション</h2><p>ちびっこは敵じゃないよ。置いたおもちゃに触れると、お礼を言って画面の外へ帰ります。</p></section>
          </aside>
        </div>
        <div className="footer-note">カメラ映像は端末内のジェスチャー認識だけに使い、保存・送信しません。</div>
      </section>
    </main>
  );
}
