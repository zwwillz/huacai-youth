import type { SnookerDashboardSnapshot, SnookerFrame, SnookerMatchStatus } from "./domain";
import { allEventMatches, dashboardSnapshot, getPlayer } from "./foundation";
import { parseSnookerOrgEvent, snookerOrgText, type SnookerSourceMatch } from "./snooker-org";

const CHINA_OPEN_SOURCE = "https://www.snooker.org/res/index.asp?event=2755";
const LIVE_SCORE_SOURCE = "https://www.snooker.org/res/index.asp?template=21";

export type SnookerSourceHealth = {
  online: boolean;
  accepted: boolean;
  eventAccepted: boolean;
  liveAccepted: boolean;
  source: "snooker.org";
  fetchedAt: string;
  latencyMs: number;
  parsedRoundCount: number;
  parsedMatchCount: number;
  overlayCount: number;
  pollingSeconds: number;
  message: string;
};

function key(roundKey: string, a: string, b: string) {
  const names = [a.toLowerCase().replace(/\s+/g, " ").trim(), b.toLowerCase().replace(/\s+/g, " ").trim()].sort();
  return `${roundKey}|${names[0]}|${names[1]}`;
}

function surname(value: string) {
  return value.toLowerCase().replace(/[’']/g, "").trim().split(/\s+/).at(-1) ?? "";
}

function parseFrame(value: string, frameNo: number, p1Name: string, p2Name: string): SnookerFrame | null {
  const score = value.match(/(\d{1,3})\s*[–-]\s*(\d{1,3})/);
  if (!score) return null;
  const score1 = Number(score[1]);
  const score2 = Number(score[2]);
  const note = value.replace(score[0], "").trim().replace(/^\(|\)$/g, "").trim();
  const result: SnookerFrame = { frameNo, score1, score2 };
  const numbers = [...note.matchAll(/\b(\d{2,3})\b/g)].map((item) => Number(item[1])).filter((item) => item >= 50 && item <= 155);
  const p1Surname = surname(p1Name);
  const p2Surname = surname(p2Name);

  if (numbers.length) {
    const lower = note.toLowerCase();
    if (p1Surname && lower.includes(p1Surname)) {
      const namePattern = new RegExp(`${p1Surname}[^0-9]{0,8}(\\d{2,3})`, "i");
      const found = note.match(namePattern);
      if (found && Number(found[1]) >= 50) result.break1 = Number(found[1]);
    }
    if (p2Surname && lower.includes(p2Surname)) {
      const namePattern = new RegExp(`${p2Surname}[^0-9]{0,8}(\\d{2,3})`, "i");
      const found = note.match(namePattern);
      if (found && Number(found[1]) >= 50) result.break2 = Number(found[1]);
    }
    if (!result.break1 && !result.break2 && numbers.length === 1) {
      const only = numbers[0];
      if (score1 >= only && score1 > score2) result.break1 = only;
      else if (score2 >= only) result.break2 = only;
    }
  }
  if (note) result.note = note;
  return result;
}

async function fetchHtml(url: string) {
  const response = await fetch(url, {
    headers: {
      "user-agent": "Mozilla/5.0 (compatible; WorldSnookerDataCenterPOC/0.4)",
      accept: "text/html,application/xhtml+xml",
      "cache-control": "no-cache",
    },
    cache: "no-store",
    signal: AbortSignal.timeout(6500),
  });
  if (!response.ok) throw new Error(`HTTP_${response.status}`);
  return response.text();
}

function overlayMatches(snapshot: SnookerDashboardSnapshot, sourceMatches: SnookerSourceMatch[], sourceText: string) {
  const bundled = new Map(
    allEventMatches(snapshot.event).map((match) => [
      key(match.roundKey, getPlayer(match.player1Id).nameEn, getPlayer(match.player2Id).nameEn),
      match,
    ]),
  );
  let overlayCount = 0;

  for (const sourceMatch of sourceMatches) {
    const target = bundled.get(key(sourceMatch.roundKey, sourceMatch.player1.nameEn, sourceMatch.player2.nameEn));
    if (!target) continue;
    target.score1 = sourceMatch.score1;
    target.score2 = sourceMatch.score2;

    let status: SnookerMatchStatus = sourceMatch.status;
    const isFinalEightAll = sourceMatch.roundKey === "final" && sourceMatch.status === "live" && sourceMatch.score1 === 4 && sourceMatch.score2 === 4;
    if (isFinalEightAll && /Session\s*1\s*:/i.test(sourceText) && !/Session\s*2\s*:/i.test(sourceText)) status = "session-break";
    if (sourceMatch.roundKey === "final" && sourceMatch.status === "live" && /Match will resume later/i.test(sourceText)) status = "session-break";

    target.status = status;
    target.statusLabelZh = status === "session-break"
      ? "进行中 · 阶段休息"
      : status === "live"
        ? "进行中"
        : status === "walkover"
          ? "退赛晋级"
          : "已结束";

    if (sourceMatch.frames.length) {
      const parsedFrames = sourceMatch.frames
        .map((value, index) => parseFrame(value, index + 1, sourceMatch.player1.nameEn, sourceMatch.player2.nameEn))
        .filter((item): item is SnookerFrame => Boolean(item));
      if (parsedFrames.length) target.frames = parsedFrames;
    }

    if ((status === "completed" || status === "walkover") && sourceMatch.score1 !== null && sourceMatch.score2 !== null) {
      target.winnerId = sourceMatch.score1 > sourceMatch.score2 ? target.player1Id : target.player2Id;
    }
    overlayCount += 1;
  }

  return overlayCount;
}

export async function getDashboardWithLiveOverlay(): Promise<{ snapshot: SnookerDashboardSnapshot; sourceHealth: SnookerSourceHealth }> {
  const startedAt = Date.now();
  const fetchedAt = new Date().toISOString();
  const snapshot = structuredClone(dashboardSnapshot);
  let eventAccepted = false;
  let liveAccepted = false;
  let overlayCount = 0;
  let parsedRoundCount = 0;
  let parsedMatchCount = 0;
  let online = false;
  const errors: string[] = [];

  try {
    const html = await fetchHtml(CHINA_OPEN_SOURCE);
    online = true;
    const parsed = parseSnookerOrgEvent(html);
    parsedRoundCount = parsed.rounds.length;
    parsedMatchCount = parsed.matches.length;
    eventAccepted = parsed.eventDetected && parsed.rounds.length >= 6 && parsed.matches.length >= 30;
    if (eventAccepted) overlayCount += overlayMatches(snapshot, parsed.matches, snookerOrgText(html));
  } catch (error) {
    errors.push(error instanceof Error ? `赛事页 ${error.message}` : "赛事页读取失败");
  }

  try {
    const liveHtml = await fetchHtml(LIVE_SCORE_SOURCE);
    online = true;
    const liveParsed = parseSnookerOrgEvent(liveHtml);
    liveAccepted = liveParsed.eventDetected && liveParsed.matches.length > 0;
    if (liveAccepted) overlayCount += overlayMatches(snapshot, liveParsed.matches, snookerOrgText(liveHtml));
  } catch (error) {
    errors.push(error instanceof Error ? `实时页 ${error.message}` : "实时页读取失败");
  }

  const accepted = eventAccepted || liveAccepted;
  if (accepted) {
    snapshot.event.snapshotAt = fetchedAt;
    snapshot.builtAt = fetchedAt;
  }

  return {
    snapshot,
    sourceHealth: {
      online,
      accepted,
      eventAccepted,
      liveAccepted,
      source: "snooker.org",
      fetchedAt,
      latencyMs: Date.now() - startedAt,
      parsedRoundCount,
      parsedMatchCount,
      overlayCount,
      pollingSeconds: 15,
      message: accepted
        ? `已自动同步${liveAccepted ? "实时比分" : "赛事数据"}，页面每15秒检查一次。`
        : `实时源暂未通过校验，继续使用已验证快照。${errors.length ? ` ${errors.join("；")}` : ""}`,
    },
  };
}
