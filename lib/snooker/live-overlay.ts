import type { SnookerDashboardSnapshot, SnookerFrame, SnookerMatch, SnookerMatchStatus } from "./domain";
import { allEventMatches, dashboardSnapshot, getPlayer } from "./foundation";
import { findPlayerByEnglishName } from "./data/players";
import {
  fetchWstMatchStatus,
  fetchWstTournament,
  type WstMatchAttributes,
  type WstMatchRow,
  type WstMatchStatus,
  wstPlayerName,
} from "./wst-source";

export type SnookerSourceHealth = {
  online: boolean;
  accepted: boolean;
  eventAccepted: boolean;
  liveAccepted: boolean;
  source: "WST";
  fetchedAt: string;
  latencyMs: number;
  parsedRoundCount: number;
  parsedMatchCount: number;
  overlayCount: number;
  changedCount: number;
  pollingSeconds: number;
  liveScore: string | null;
  appliedFinalScore: string;
  matchId: string | null;
  message: string;
};

type LinkedWstMatch = {
  target: SnookerMatch;
  row: WstMatchRow;
  homeMapsToPlayer1: boolean;
};

function normalizedName(value: string) {
  const master = findPlayerByEnglishName(value);
  return (master?.nameEn ?? value)
    .normalize("NFKC")
    .replace(/[’‘]/g, "'")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function pairKey(a: string, b: string) {
  return [normalizedName(a), normalizedName(b)].sort().join("|");
}

function sourceNames(attributes: WstMatchAttributes) {
  if (attributes.name) {
    const parts = attributes.name.split(/\s+vs\s+/i);
    if (parts.length >= 2) {
      return {
        home: parts[0].trim(),
        away: parts[1].trim(),
      };
    }
  }
  return {
    home: wstPlayerName(attributes.homePlayer),
    away: wstPlayerName(attributes.awayPlayer),
  };
}

function matchSignature(match: SnookerMatch) {
  return JSON.stringify({
    score1: match.score1,
    score2: match.score2,
    status: match.status,
    winnerId: match.winnerId ?? null,
    timeLabelZh: match.timeLabelZh ?? null,
    frames: (match.frames ?? []).map((frame) => [
      frame.frameNo,
      frame.score1,
      frame.score2,
      frame.break1 ?? null,
      frame.break2 ?? null,
    ]),
  });
}

function statusFromWst(status?: string | null, statusMeta?: string | null, fallback: SnookerMatchStatus = "upcoming"): SnookerMatchStatus {
  const value = (status ?? "").toLowerCase();
  const meta = (statusMeta ?? "").toUpperCase();
  if (value.includes("complete") || value.includes("finished")) return "completed";
  if (value.includes("scheduled") || value.includes("fixture")) return "upcoming";
  if (value.includes("suspend") || meta.includes("INTERVAL")) return "session-break";
  if (value.includes("live") || value.includes("play") || value.includes("progress") || value.includes("started")) return "live";
  return fallback;
}

function statusLabel(status: SnookerMatchStatus) {
  if (status === "completed") return "已结束";
  if (status === "walkover") return "退赛晋级";
  if (status === "session-break") return "进行中 · 阶段休息";
  if (status === "live") return "进行中";
  return "待开始";
}

function toScheduledAt(value?: string | null) {
  if (!value) return undefined;
  const iso = `${value.replace(" ", "T")}Z`;
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

function toChinaTimeLabel(value?: string | null) {
  const scheduledAt = toScheduledAt(value);
  if (!scheduledAt) return undefined;
  const parts = new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date(scheduledAt));
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? "";
  return `${Number(part("month"))}月${Number(part("day"))}日 ${part("hour")}:${part("minute")}`;
}

function scoreByOrientation(homeMapsToPlayer1: boolean, home: number | null | undefined, away: number | null | undefined) {
  return homeMapsToPlayer1
    ? { score1: home ?? null, score2: away ?? null }
    : { score1: away ?? null, score2: home ?? null };
}

function applyWinner(match: SnookerMatch) {
  if (match.status === "walkover") return;
  if (match.status === "completed" && match.score1 !== null && match.score2 !== null && match.score1 !== match.score2) {
    match.winnerId = match.score1 > match.score2 ? match.player1Id : match.player2Id;
  } else {
    delete match.winnerId;
  }
}

function overlayWstTournament(snapshot: SnookerDashboardSnapshot, sourceMatches: WstMatchRow[]) {
  const pairMap = new Map<string, SnookerMatch[]>();
  for (const match of allEventMatches(snapshot.event)) {
    const p1 = getPlayer(match.player1Id).nameEn;
    const p2 = getPlayer(match.player2Id).nameEn;
    const key = pairKey(p1, p2);
    const candidates = pairMap.get(key) ?? [];
    candidates.push(match);
    pairMap.set(key, candidates);
  }

  let matched = 0;
  let changed = 0;
  const linked = new Map<string, LinkedWstMatch>();

  for (const row of sourceMatches) {
    const attributes = row.attributes ?? {};
    const names = sourceNames(attributes);
    if (!names.home || !names.away) continue;
    const candidates = pairMap.get(pairKey(names.home, names.away)) ?? [];
    if (candidates.length !== 1) continue;
    const target = candidates[0];
    const targetPlayer1 = getPlayer(target.player1Id).nameEn;
    const homeMapsToPlayer1 = normalizedName(names.home) === normalizedName(targetPlayer1);
    const before = matchSignature(target);
    const score = scoreByOrientation(homeMapsToPlayer1, attributes.homePlayerScore, attributes.awayPlayerScore);

    const preserveWalkover = target.status === "walkover" && score.score1 === 0 && score.score2 === 0;
    if (!preserveWalkover) {
      target.score1 = score.score1;
      target.score2 = score.score2;
      target.status = statusFromWst(attributes.status, attributes.statusMeta, target.status);
      target.statusLabelZh = statusLabel(target.status);
      applyWinner(target);
    }

    if (attributes.numberOfFrames && attributes.numberOfFrames > 0) target.bestOf = attributes.numberOfFrames;
    const scheduledAt = toScheduledAt(attributes.startDateTime);
    const timeLabelZh = toChinaTimeLabel(attributes.startDateTime);
    if (scheduledAt) target.scheduledAt = scheduledAt;
    if (timeLabelZh) target.timeLabelZh = timeLabelZh;

    matched += 1;
    if (matchSignature(target) !== before) changed += 1;
    linked.set(target.id, { target, row, homeMapsToPlayer1 });
  }

  return { matched, changed, linked };
}

function graphFrames(status: WstMatchStatus, homeMapsToPlayer1: boolean): SnookerFrame[] {
  const rows = status.matchHistory?.frames ?? [];
  return rows.map((frame) => {
    const homeBreak = frame.homePlayerFiftyPlusBreaks >= 50 ? frame.homePlayerFiftyPlusBreaks : undefined;
    const awayBreak = frame.awayPlayerFiftyPlusBreaks >= 50 ? frame.awayPlayerFiftyPlusBreaks : undefined;
    return homeMapsToPlayer1
      ? {
          frameNo: frame.frameNumber,
          score1: frame.homePlayerPoints,
          score2: frame.awayPlayerPoints,
          break1: homeBreak,
          break2: awayBreak,
        }
      : {
          frameNo: frame.frameNumber,
          score1: frame.awayPlayerPoints,
          score2: frame.homePlayerPoints,
          break1: awayBreak,
          break2: homeBreak,
        };
  });
}

function overlayGraphStatus(link: LinkedWstMatch, status: WstMatchStatus) {
  const match = link.target;
  const before = matchSignature(match);
  const score = scoreByOrientation(link.homeMapsToPlayer1, status.homePlayerFrames, status.awayPlayerFrames);
  match.score1 = score.score1;
  match.score2 = score.score2;
  match.status = statusFromWst(status.status, status.statusMeta, match.status);
  match.statusLabelZh = statusLabel(match.status);
  const frames = graphFrames(status, link.homeMapsToPlayer1);
  if (frames.length) match.frames = frames;
  applyWinner(match);
  return matchSignature(match) !== before ? 1 : 0;
}

function finalScore(snapshot: SnookerDashboardSnapshot) {
  const final = snapshot.event.rounds.find((round) => round.key === "final")?.matches[0];
  return final ? `${final.score1 ?? "-"}:${final.score2 ?? "-"}` : "-:-";
}

function isActiveMatch(match: SnookerMatch) {
  return match.status === "live" || match.status === "session-break";
}

export async function getDashboardWithLiveOverlay(): Promise<{ snapshot: SnookerDashboardSnapshot; sourceHealth: SnookerSourceHealth }> {
  const startedAt = Date.now();
  const fetchedAt = new Date().toISOString();
  const snapshot = structuredClone(dashboardSnapshot);
  let online = false;
  let eventAccepted = false;
  let liveAccepted = false;
  let overlayCount = 0;
  let changedCount = 0;
  let parsedMatchCount = 0;
  let matchId: string | null = null;
  let liveScore: string | null = null;
  const errors: string[] = [];

  try {
    const tournament = await fetchWstTournament();
    online = true;
    parsedMatchCount = tournament.matches.length;
    const result = overlayWstTournament(snapshot, tournament.matches);
    overlayCount += result.matched;
    changedCount += result.changed;
    eventAccepted = tournament.matches.length >= 30 && result.matched >= 30;

    // Match Centre is needed for the unfinished current frame. During early rounds
    // several tables may be live at once, so fetch every active match rather than
    // hard-coding the final. Completed matches are never fetched from Match Centre.
    if (eventAccepted) {
      const activeLinks = [...result.linked.values()].filter((link) => isActiveMatch(link.target));
      const graphResults = await Promise.allSettled(
        activeLinks.map(async (link) => ({
          link,
          graph: await fetchWstMatchStatus(link.row.id),
        })),
      );

      for (const resultItem of graphResults) {
        if (resultItem.status === "rejected") {
          const reason = resultItem.reason;
          errors.push(reason instanceof Error ? `Match Centre ${reason.message}` : "Match Centre 读取失败");
          continue;
        }
        const { link, graph } = resultItem.value;
        liveAccepted = true;
        changedCount += overlayGraphStatus(link, graph);
        if (!matchId) {
          matchId = link.row.id;
          liveScore = `${graph.homePlayerFrames}:${graph.awayPlayerFrames}`;
        }
      }
    }
  } catch (error) {
    errors.push(error instanceof Error ? `WST赛事数据 ${error.name === "AbortError" ? "TIMEOUT" : error.message}` : "WST赛事数据读取失败");
  }

  const accepted = eventAccepted || liveAccepted;
  if (accepted) {
    snapshot.event.snapshotAt = fetchedAt;
    snapshot.builtAt = fetchedAt;
  }
  const appliedFinalScore = finalScore(snapshot);
  const activeCount = allEventMatches(snapshot.event).filter(isActiveMatch).length;

  return {
    snapshot,
    sourceHealth: {
      online,
      accepted,
      eventAccepted,
      liveAccepted,
      source: "WST",
      fetchedAt,
      latencyMs: Date.now() - startedAt,
      parsedRoundCount: snapshot.event.rounds.length,
      parsedMatchCount,
      overlayCount,
      changedCount,
      pollingSeconds: 30,
      liveScore,
      appliedFinalScore,
      matchId,
      message: liveAccepted
        ? `WST实时数据已同步，${activeCount}场进行中比赛已接入逐局数据。`
        : eventAccepted
          ? `WST赛事比分已同步。${activeCount ? "进行中比赛的 Match Centre 暂未返回逐局数据。" : "当前没有进行中比赛，逐局实时请求已停止。"}${errors.length ? ` ${errors.join("；")}` : ""}`
          : online
            ? `WST数据可访问，但完整性校验未通过。${errors.length ? ` ${errors.join("；")}` : ""}`
            : `WST实时数据暂不可用，继续使用已验证快照。${errors.length ? ` ${errors.join("；")}` : ""}`,
    },
  };
}
