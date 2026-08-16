import { NextResponse } from "next/server";

const SOURCE_URL = "https://www.snooker.org/res/index.asp?event=2755";

export const revalidate = 30;

function decodeEntities(value: string) {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&ndash;|&#8211;/gi, "–")
    .replace(/&mdash;|&#8212;/gi, "—")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCharCode(Number(code)));
}

function htmlToText(html: string) {
  return decodeEntities(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<br\s*\/?\s*>/gi, " ")
      .replace(/<[^>]+>/g, " ")
  ).replace(/\s+/g, " ").trim();
}

function parseChinaOpenFinal(text: string) {
  const exact = text.match(/Mark\s+Selby\s*\[9\]\s*(\d+)\s*-\s*(\d+)\s*Noppon\s+Saengkham\s*\[46\]/i);
  const relaxed = text.match(/Mark\s+Selby[\s\S]{0,90}?(\d+)\s*-\s*(\d+)[\s\S]{0,90}?Noppon\s+Saengkham/i);
  const score = exact ?? relaxed;
  if (!score) return null;

  const frameBlock = text.match(/Session\s*1:\s*([\s\S]{0,420}?)\s*Watch\s+on/i)?.[1] ?? "";
  const frames = frameBlock
    .split(",")
    .map((frame) => frame.trim())
    .filter(Boolean)
    .slice(0, 12);

  return {
    player1En: "Mark Selby",
    player1Zh: "马克·塞尔比",
    player1Rank: 9,
    player1Score: Number(score[1]),
    player2En: "Noppon Saengkham",
    player2Zh: "诺鹏·桑坎姆",
    player2Rank: 46,
    player2Score: Number(score[2]),
    frames,
  };
}

export async function GET() {
  const startedAt = Date.now();

  try {
    const response = await fetch(SOURCE_URL, {
      headers: {
        "user-agent": "Mozilla/5.0 (compatible; SnookerDataCenterPOC/0.1; +https://snooker.org)",
        accept: "text/html,application/xhtml+xml",
      },
      next: { revalidate: 30 },
    });

    if (!response.ok) {
      return NextResponse.json({
        ok: false,
        source: "snooker.org",
        eventId: "2755",
        status: response.status,
        fetchedAt: new Date().toISOString(),
        latencyMs: Date.now() - startedAt,
      });
    }

    const html = await response.text();
    const text = htmlToText(html);
    const liveMatch = parseChinaOpenFinal(text);

    return NextResponse.json({
      ok: true,
      source: "snooker.org",
      eventId: "2755",
      sourceUrl: SOURCE_URL,
      fetchedAt: new Date().toISOString(),
      latencyMs: Date.now() - startedAt,
      bytes: html.length,
      eventDetected: /China\s+Open/i.test(text),
      liveMatch,
    });
  } catch (error) {
    return NextResponse.json({
      ok: false,
      source: "snooker.org",
      eventId: "2755",
      fetchedAt: new Date().toISOString(),
      latencyMs: Date.now() - startedAt,
      error: error instanceof Error ? error.message : "Unknown source error",
    });
  }
}
