import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(
    new Request("http://localhost/", { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("server-renders the snack guard game", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
  const html = await response.text();
  assert.match(html, /<html lang="ja">/i);
  assert.match(html, /<title>おやつ防衛隊！/i);
  assert.match(html, /今日のおやつを/);
  assert.match(html, /カメラでスタート/);
  assert.match(html, /マウスで遊ぶ/);
  assert.match(html, /置こう|置いた|設置/);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape|ROOM RAID/i);
});

test("supports deliberate item placement and gentle illustrated returns", async () => {
  const [game, layout, packageJson, css] = await Promise.all([
    readFile(new URL("../app/SnackGuardGame.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);
  assert.match(game, /getUserMedia/);
  assert.match(game, /HandLandmarker/);
  assert.match(game, /Shift＋クリック/);
  assert.match(game, /Space：くま/);
  assert.match(game, /ありがとう/);
  assert.match(game, /ねんね/);
  assert.match(game, /drawImage/);
  assert.match(game, /type ToyKind = "normal" \| "strong"/);
  assert.match(game, /hits: strong \? 3 : 1/);
  assert.match(game, /kind === "strong" \? 3 : 5/);
  assert.match(game, /vSign/);
  assert.match(game, /KeyS/);
  assert.match(game, /shiftKey/);
  assert.match(game, /snapPlacement/);
  assert.match(game, /drawPlacementPreview/);
  assert.match(game, /レーン \$\{spot\.lane \+ 1\}・ここに置く/);
  assert.match(game, /光るレーンへ自動吸着/);
  assert.match(game, /タッチ用おもちゃ選択/);
  assert.match(game, /pointerType === "mouse"/);
  assert.match(css, /\.screen-overlay \{ position:fixed/);
  assert.match(css, /\.mobile-toy-bar \{ display:grid/);
  assert.match(css, /orientation:landscape/);
  assert.match(game, /nursery-bg\.png/);
  assert.match(game, /snack-basket\.png/);
  assert.match(game, /保存・送信しません/);
  assert.match(layout, /おやつ防衛隊！/);
  assert.match(packageJson, /@mediapipe\/tasks-vision/);
  await assert.rejects(access(new URL("../app/_sites-preview", import.meta.url)));
  await access(new URL("../public/kids-atlas.png", import.meta.url));
  await access(new URL("../public/nursery-bg.png", import.meta.url));
  await access(new URL("../public/snack-basket.png", import.meta.url));
});
