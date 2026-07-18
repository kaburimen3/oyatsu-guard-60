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
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape|ROOM RAID/i);
});

test("keeps camera privacy and fallback controls visible", async () => {
  const [game, layout, packageJson] = await Promise.all([
    readFile(new URL("../app/SnackGuardGame.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
  ]);
  assert.match(game, /getUserMedia/);
  assert.match(game, /HandLandmarker/);
  assert.match(game, /マウス移動＋クリック/);
  assert.match(game, /保存・送信しません/);
  assert.match(layout, /おやつ防衛隊！/);
  assert.match(packageJson, /@mediapipe\/tasks-vision/);
  await assert.rejects(access(new URL("../app/_sites-preview", import.meta.url)));
});
