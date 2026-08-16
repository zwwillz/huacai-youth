import type { SnookerDashboardSnapshot, SnookerFrame, SnookerMatchStatus } from "./domain";
import { allEventMatches, dashboardSnapshot, getPlayer } from "./foundation";
import { parseSnookerOrgEvent, snookerOrgText } from "./snooker-org";

const CHINA_OPEN_SOURCE = "https://www.snooker.org/res/index.asp?event=2755";

export type SnookerSourceHealth = {
  online: boolean;
  accepted: boolean;
  source: "snooker.org";
  fetchedAt: string;
  latencyMs: number;
  parsedRoundCount: number;
  parsedMatchCount: number;
  overlayCount: number;
  message: string;
};

function key(roundKey: string, a: string, b: string) {
  const names = [a.toLowerCase().replace(/\s+/g, " ").trim(), b.toLowerCase().replace(/\s+/g, " ").trim()].sort();
  return `${roundKey}|${names[0]}|${names[1]}`;
}

function parseFrame(value: string, frameNo: number): SnookerFrame | null {
  const score = value.match(/(\d{1,3})\s*[–-]\s*(\d{1,3})/);
  if (!score) return null;
  const note = value.replace(score[0], "").trim().replace(/^\(|\)$/g, "").trim();
  return { frameNo, score1: Number(score[1]), score2: Number(score[2]), ...(note ? { note } : {}) };
}

export async function getDashboardWithLiveOverlay(): Promise<{ snapshot: SnookerDashboardSnapshot; sourceHealth: SnookerSourceHealth }> {
  const startedAt = Date.now();
  const fetchedAt = new Date().toISOString();

  try {
    const response = await fetch(CHINA_OPEN_SOURCE, {
      headers: {
        "user-agent": "Mozilla/5.0 (compatible; WorldSnookerDataCenterPOC/0.3)",
        accept: "text/html,application/xhtml+xml",
      },
      next: { revalidate: 20 },
      signal: AbortSignal.timeout(6500),
    });

    if (!response.ok) throw new Error(`HTTP_${response.status}`);
    const html = await response.text();
    const parsed = parseSnookerOrgEvent(html);
    const accepted = parsed.eventDetected && parsed.rounds.length >= 6 && parsed.matches.length >= 30;

    if (!accepted) {
      return {
        snapshot: dashboardSnapshot,
        sourceHealth: {
          online: true,
          accepted: false,
          source: "snooker.org",
          fetchedAt,
          latencyMs: Date.now() - startedAt,
          parsedRoundCount: parsed.rounds.length,
          parsedMatchCount: parsed.matches.length,
          overlayCount: 0,
          message: "实时源已连接，但完整性校验未通过，继续使用已验证快照。",
        },
      };
    }

    const snapshot = structuredClone(dashboardSnapshot);
    const bundled = new Map(
      allEventMatches(snapshot.event).map((match) => [
        key(match.roundKey, getPlayer(match.player1Id).nameEn, getPlayer(match.player2Id).nameEn),
        match,
      ]),
    );
    const sourceText = snookerOrgText(html);
    let overlayCount = 0;

    for (const sourceMatch of parsed.matches) {
      const target = bundled.get(key(sourceMatch.roundKey, sourceMatch.player1.nameEn, sourceMatch.player2.nameEn));
      if (!target) continue;
      target.score1 = sourceMatch.score1;
      target.score2 = sourceMatch.score2;

      let status: SnookerMatchStatus = sourceMatch.status;
      if (sourceMatch.roundKey === "final" && sourceMatch.status === "live" && /Match will resume later/i.test(sourceText)) status = "session-break";
      target.status = status;
      target.statusLabelZh = status === "session-break" ? "阶段结束 · 稍后继续" : status === "live" ? "进行中" : status === "walkover" ? "退赛晋级" : "已结束";
      if (sourceMatch.frames.length) {
        const parsedFrames = sourceMatch.frames.map((value, index) => parseFrame(value, index + 1)).filter((item): item is SnookerFrame => Boolean(item));
        if (parsedFrames.length) target.frames = parsedFrames;
      }
      if ((status === "completed" || status === "walkover") && sourceMatch.score1 !== null && sourceMatch.score2 !== null) {
        target.winnerId = sourceMatch.score1 > sourceMatch.score2 ? target.player1Id : target.player2Id;
      }
      overlayCount += 1;
    }

    snapshot.event.snapshotAt = fetchedAt;
    snapshot.builtAt = fetchedAt;
    return {
      snapshot,
      sourceHealth: {
        online: true,
        accepted: true,
        source: "snooker.org",
        fetchedAt,
        latencyMs: Date.now() - startedAt,
        parsedRoundCount: parsed.rounds.length,
        parsedMatchCount: parsed.matches.length,
        overlayCount,
        message: "完整性校验通过，已用实时源覆盖已验证赛事快照。",
      },
    };
  } catch (error) {
    return {
      snapshot: dashboardSnapshot,
      sourceHealth: {
        online: false,
        accepted: false,
        source: "snooker.org",
        fetchedAt,
        latencyMs: Date.now() - startedAt,
        parsedRoundCount: 0,
        parsedMatchCount: 0,
        overlayCount: 0,
        message: `实时源暂不可用，页面使用已验证快照。${error instanceof Error ? ` ${error.message}` : ""}`,
      },
    };
  }
}
