import type { SnookerDashboardSnapshot, SnookerFrame, SnookerMatch, SnookerMatchStatus } from "./domain";
import { allEventMatches, dashboardSnapshot, getPlayer } from "./foundation";
import { parseChinaOpenLiveScores } from "./snooker-org-live";
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
  changedCount: number;
  pollingSeconds: number;
  liveScore: string | null;
  appliedFinalScore: string;
  message: string;
};

function normalizedName(value: string) {
  return value.normalize("NFKC").replace(/[’‘]/g, "'").toLowerCase().replace(/\s+/g, " ").trim();
}

function pairKey(a: string, b: string) {
  return [normalizedName(a), normalizedName(b)].sort().join("|");
}

function exactKey(roundKey: string, a: string, b: string) {
  return `${roundKey}|${pairKey(a, b)}`;
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
      const found = note.match(new RegExp(`${p1Surname}[^0-9]{0,8}(\\d{2,3})`, "i"));
      if (found && Number(found[1]) >= 50) result.break1 = Number(found[1]);
    }
    if (p2Surname && lower.includes(p2Surname)) {
      const found = note.match(new RegExp(`${p2Surname}[^0-9]{0,8}(\\d{2,3})`, "i"));
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
  const target = new URL(url);
  target.searchParams.set("_ts", `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 7000);

  try {
    const response = await fetch(target.toString(), {
      headers: {
        "user-agent": "Mozilla/5.0 (compatible; WorldSnookerDataCenterPOC/0.4.2)",
        accept: "text/html,application/xhtml+xml",
        "cache-control": "no-cache, no-store, max-age=0",
        pragma: "no-cache",
      },
      cache: "no-store",
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`HTTP_${response.status}`);
    return response.text();
  } finally {
    clearTimeout(timer);
  }
}

function matchSignature(match: SnookerMatch) {
  return JSON.stringify({
    score1: match.score1,
    score2: match.score2,
    status: match.status,
    winnerId: match.winnerId ?? null,
    frames: (match.frames ?? []).map((frame) => [frame.frameNo, frame.score1, frame.score2, frame.break1 ?? null, frame.break2 ?? null]),
  });
}

function overlayMatches(snapshot: SnookerDashboardSnapshot, sourceMatches: SnookerSourceMatch[], sourceText: string) {
  const eventMatches = allEventMatches(snapshot.event);
  const exact = new Map<string, SnookerMatch>();
  const pairs = new Map<string, SnookerMatch[]>();

  for (const match of eventMatches) {
    const p1 = getPlayer(match.player1Id).nameEn;
    const p2 = getPlayer(match.player2Id).nameEn;
    exact.set(exactKey(match.roundKey, p1, p2), match);
    const pKey = pairKey(p1, p2);
    const candidates = pairs.get(pKey) ?? [];
    candidates.push(match);
    pairs.set(pKey, candidates);
  }

  let matched = 0;
  let changed = 0;

  for (const sourceMatch of sourceMatches) {
    const sourcePair = pairKey(sourceMatch.player1.nameEn, sourceMatch.player2.nameEn);
    const pairCandidates = pairs.get(sourcePair) ?? [];
    const target = exact.get(exactKey(sourceMatch.roundKey, sourceMatch.player1.nameEn, sourceMatch.player2.nameEn))
      ?? (pairCandidates.length === 1 ? pairCandidates[0] : undefined);
    if (!target) continue;

    const before = matchSignature(target);
    target.score1 = sourceMatch.score1;
    target.score2 = sourceMatch.score2;

    let status: SnookerMatchStatus = sourceMatch.status;
    const isFinalEightAll = sourceMatch.roundKey === "final" && sourceMatch.status === "live" && sourceMatch.score1 === 4 && sourceMatch.score2 === 4;
    if (isFinalEightAll && /Session\s*1\s*:/i.test(sourceText) && !/Session\s*2\s*:/i.test(sourceText)) status = "session-break";
    if (sourceMatch.roundKey === "final" && sourceMatch.status === "live" && /Match will resume later/i.test(sourceText) && !/Session\s*2\s*:/i.test(sourceText)) status = "session-break";

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
    } else {
      delete target.winnerId;
    }

    matched += 1;
    if (matchSignature(target) !== before) changed += 1;
  }

  return { matched, changed };
}

function finalScore(snapshot: SnookerDashboardSnapshot) {
  const final = snapshot.event.rounds.find((round) => round.key === "final")?.matches[0];
  return final ? `${final.score1 ?? "-"}:${final.score2 ?? "-"}` : "-:-";
}

export async function getDashboardWithLiveOverlay(): Promise<{ snapshot: SnookerDashboardSnapshot; sourceHealth: SnookerSourceHealth }> {
  const startedAt = Date.now();
  const fetchedAt = new Date().toISOString();
  const snapshot = structuredClone(dashboardSnapshot);
  let eventAccepted = false;
  let liveAccepted = false;
  let overlayCount = 0;
  let changedCount = 0;
  let parsedRoundCount = 0;
  let parsedMatchCount = 0;
  let online = false;
  let liveScore: string | null = null;
  const errors: string[] = [];

  // Full event page supplies the completed draw and acts as a broad fallback.
  try {
    const html = await fetchHtml(CHINA_OPEN_SOURCE);
    online = true;
    const parsed = parseSnookerOrgEvent(html);
    parsedRoundCount = parsed.rounds.length;
    parsedMatchCount = parsed.matches.length;
    const eventValid = parsed.eventDetected && parsed.rounds.length >= 6 && parsed.matches.length >= 30;
    if (eventValid) {
      const result = overlayMatches(snapshot, parsed.matches, snookerOrgText(html));
      overlayCount += result.matched;
      changedCount += result.changed;
      eventAccepted = result.matched > 0;
    }
  } catch (error) {
    errors.push(error instanceof Error ? `赛事页 ${error.name === "AbortError" ? "TIMEOUT" : error.message}` : "赛事页读取失败");
  }

  // The live page is parsed with its own flatter parser and is applied LAST so
  // it always wins over an older full-event snapshot.
  try {
    const liveHtml = await fetchHtml(LIVE_SCORE_SOURCE);
    online = true;
    const liveMatches = parseChinaOpenLiveScores(liveHtml);
    if (liveMatches.length) {
      liveScore = `${liveMatches[0].score1 ?? "-"}:${liveMatches[0].score2 ?? "-"}`;
      const result = overlayMatches(snapshot, liveMatches, snookerOrgText(liveHtml));
      overlayCount += result.matched;
      changedCount += result.changed;
      liveAccepted = result.matched > 0;
    }
  } catch (error) {
    errors.push(error instanceof Error ? `实时页 ${error.name === "AbortError" ? "TIMEOUT" : error.message}` : "实时页读取失败");
  }

  const accepted = eventAccepted || liveAccepted;
  if (accepted) {
    snapshot.event.snapshotAt = fetchedAt;
    snapshot.builtAt = fetchedAt;
  }
  const appliedFinalScore = finalScore(snapshot);

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
      changedCount,
      pollingSeconds: 15,
      liveScore,
      appliedFinalScore,
      message: liveAccepted
        ? `实时比分已匹配：数据源 ${liveScore} → 页面 ${appliedFinalScore}。`
        : accepted
          ? `赛事数据已同步，但实时比分未匹配。当前页面决赛 ${appliedFinalScore}。${errors.length ? ` ${errors.join("；")}` : ""}`
          : online
            ? `数据源可访问，但没有匹配到可安全覆盖的比赛。${errors.length ? ` ${errors.join("；")}` : ""}`
            : `实时源暂不可用，继续使用已验证快照。${errors.length ? ` ${errors.join("；")}` : ""}`,
    },
  };
}
