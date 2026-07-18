type DirectorPayload = {
  round?: unknown;
  score?: unknown;
  peak?: unknown;
  boss?: unknown;
};

const FALLBACKS = [
  {
    reaction: "いい声だ！沈黙の壁が崩れた！",
    nextCall: "次は、光る論点をみんなで選べ！",
    insight: "最初の一声をゲームにすると、発言の心理的ハードルが下がります。",
  },
  {
    reaction: "意見がひとつに集まった！脱線ルート封鎖！",
    nextCall: "ラストは『決めて、動こう！』だ！",
    insight: "選択肢を可視化すると、論点整理と合意形成が同時に進みます。",
  },
  {
    reaction: "60人の熱量が、会議を前に進めた！",
    nextCall: "会議の主役は、全員だ。",
    insight: "参加のきっかけを可視化し、沈黙を次の行動へ変えました。",
  },
] as const;

function fallback(round: number) {
  return { ...FALLBACKS[round], mode: "demo" as const };
}

function extractOutputText(response: unknown): string | null {
  if (!response || typeof response !== "object") return null;
  const record = response as { output_text?: unknown; output?: unknown };
  if (typeof record.output_text === "string") return record.output_text;
  if (!Array.isArray(record.output)) return null;
  for (const item of record.output) {
    if (!item || typeof item !== "object") continue;
    const content = (item as { content?: unknown }).content;
    if (!Array.isArray(content)) continue;
    for (const part of content) {
      if (!part || typeof part !== "object") continue;
      const text = (part as { text?: unknown }).text;
      if (typeof text === "string") return text;
    }
  }
  return null;
}

export async function POST(request: Request) {
  let body: DirectorPayload;
  try {
    body = (await request.json()) as DirectorPayload;
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const round = Math.max(0, Math.min(2, Number(body.round) || 0));
  const score = Math.max(0, Math.min(999999, Number(body.score) || 0));
  const peak = Math.max(0, Math.min(100, Number(body.peak) || 0));
  const boss = typeof body.boss === "string" ? body.boss.slice(0, 40) : "会議ボス";
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) return Response.json(fallback(round));

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-5.6-terra",
        reasoning: { effort: "low" },
        store: false,
        safety_identifier: "room_raid_60_facilitator",
        max_output_tokens: 220,
        instructions:
          "あなたは大人数会議を盛り上げるゲームディレクター。短く、力強く、子どもでも分かる日本語を使う。参加者を責めず、会議改善の学びを1つだけ伝える。指定JSON以外は出力しない。",
        input: `ラウンド${round + 1}で「${boss}」を撃破。チームスコア${score}、会場ピーク熱量${peak}%。この場だけの撃破コメント、次の掛け声、会議改善の一言を作る。`,
        text: {
          format: {
            type: "json_schema",
            name: "room_raid_director",
            strict: true,
            schema: {
              type: "object",
              properties: {
                reaction: { type: "string", maxLength: 44 },
                nextCall: { type: "string", maxLength: 30 },
                insight: { type: "string", maxLength: 80 },
              },
              required: ["reaction", "nextCall", "insight"],
              additionalProperties: false,
            },
          },
        },
      }),
      signal: AbortSignal.timeout(6000),
    });

    if (!response.ok) throw new Error(`OpenAI API ${response.status}`);
    const data = (await response.json()) as unknown;
    const output = extractOutputText(data);
    if (!output) throw new Error("Missing output text");
    const parsed = JSON.parse(output) as Record<string, unknown>;
    if (
      typeof parsed.reaction !== "string" ||
      typeof parsed.nextCall !== "string" ||
      typeof parsed.insight !== "string"
    ) {
      throw new Error("Invalid director schema");
    }
    return Response.json({
      reaction: parsed.reaction.slice(0, 44),
      nextCall: parsed.nextCall.slice(0, 30),
      insight: parsed.insight.slice(0, 80),
      mode: "live" as const,
    });
  } catch {
    return Response.json(fallback(round));
  }
}
