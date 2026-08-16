import { NextResponse } from "next/server";
import { parseSnookerOrgEvent } from "@/lib/snooker/snooker-org";

const SOURCE_URL = "https://www.snooker.org/res/index.asp?event=2755";

export const revalidate = 30;

function livePayload(match: ReturnType<typeof parseSnookerOrgEvent>["liveMatch"], sourceText: string) {
  if (!match) return null;
  return {
    player1En: match.player1.nameEn,
    player1Zh: match.player1.nameZh,
    player1Rank: match.player1.sourceRank ?? 0,
    player1Score: match.score1 ?? 0,
    player2En: match.player2.nameEn,
    player2Zh: match.player2.nameZh,
    player2Rank: match.player2.sourceRank ?? 0,
    player2Score: match.score2 ?? 0,
    frames: match.frames,
    round: `${match.roundLabelZh} · ${match.bestOf}局${Math.floor(match.bestOf / 2) + 1}胜`,
    status: /Match will resume later/i.test(sourceText) ? "第一阶段结束" : "进行中",
  };
}

export async function GET() {
  const startedAt = Date.now();

  try {
    const response = await fetch(SOURCE_URL, {
      headers: {
        "user-agent": "Mozilla/5.0 (compatible; SnookerDataCenterPOC/0.2)",
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
    const parsed = parseSnookerOrgEvent(html);
    const sourceText = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

    return NextResponse.json({
      ok: true,
      source: "snooker.org",
      eventId: "2755",
      sourceUrl: SOURCE_URL,
      fetchedAt: new Date().toISOString(),
      latencyMs: Date.now() - startedAt,
      bytes: html.length,
      eventDetected: parsed.eventDetected,
      summary: {
        roundCount: parsed.rounds.length,
        matchCount: parsed.matches.length,
        completedCount: parsed.matches.filter((match) => match.status === "completed" || match.status === "walkover").length,
        liveCount: parsed.matches.filter((match) => match.status === "live").length,
      },
      rounds: parsed.rounds,
      liveMatch: livePayload(parsed.liveMatch, sourceText),
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
