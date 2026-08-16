import { getCanonicalEnglishName, getChinesePlayerName } from "./player-master";

export type SnookerSourcePlayer = {
  nameEn: string;
  nameZh: string;
  sourceRank: number | null;
};

export type SnookerSourceMatch = {
  id: string;
  roundKey: string;
  roundLabelZh: string;
  bestOf: number;
  player1: SnookerSourcePlayer;
  player2: SnookerSourcePlayer;
  score1: number | null;
  score2: number | null;
  status: "live" | "completed" | "walkover";
  frames: string[];
};

export type SnookerSourceRound = {
  key: string;
  labelZh: string;
  bestOf: number;
  matches: SnookerSourceMatch[];
};

const ROUND_DEFS = [
  ["final", /\bFinal\s*\(/i, "决赛", 19],
  ["semifinals", /\bSemifinals\s*\(/i, "半决赛", 11],
  ["quarterfinals", /\bQuarterfinals\s*\(/i, "1/4决赛", 11],
  ["round-2", /\bRound\s+2\s*\(/i, "16强", 11],
  ["round-1", /\bRound\s+1\s*\(/i, "32强", 11],
  ["wild-card", /\bWild\s+Card\s+Round\s*\(/i, "外卡轮", 11],
] as const;

function decode(value: string) {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, "\"")
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&ndash;|&#8211;/gi, "–")
    .replace(/&mdash;|&#8212;/gi, "—")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCharCode(Number(code)));
}

export function snookerOrgText(html: string) {
  return decode(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<img\b[^>]*>/gi, " ")
      .replace(/<[^>]+>/g, " "),
  ).replace(/\s+/g, " ").trim();
}

function cleanName(value: string) {
  return getCanonicalEnglishName(value.replace(/^[\d|.\s]+/, "").replace(/\s+/g, " ").trim());
}

function player(name: string, rank?: string): SnookerSourcePlayer {
  const nameEn = cleanName(name);
  return { nameEn, nameZh: getChinesePlayerName(nameEn), sourceRank: rank ? Number(rank) : null };
}

function frames(segment: string, expected: number) {
  if (!expected) return [];
  const scores = segment.match(/\b\d{1,3}\s*-\s*\d{1,3}(?:\s*\([^)]*\))?/g) ?? [];
  return scores.length >= expected
    ? scores.slice(0, expected).map((score) => score.replace(/\s*-\s*/g, "–").trim())
    : [];
}

function parseRound(text: string, key: string, labelZh: string, bestOf: number): SnookerSourceRound {
  const scored = /([A-Z][A-Za-zÀ-ž.'’\-\s]+?)\s+(?:\[(\d+)\]|\(a\))\s+(\d+)\s*-\s*(\d+)\s+([A-Z][A-Za-zÀ-ž.'’\-\s]+?)\s+(?:\[(\d+)\]|\(a\))/g;
  const walkover = /([A-Z][A-Za-zÀ-ž.'’\-\s]+?)\s+(?:\[(\d+)\]|\(a\))\s+w\/o\s+([A-Z][A-Za-zÀ-ž.'’\-\s]+?)\s+(?:\[(\d+)\]|\(a\))/gi;
  const raw: Array<{
    index: number; end: number; p1: string; r1?: string; p2: string; r2?: string;
    s1: number | null; s2: number | null; walkover: boolean;
  }> = [];

  let match: RegExpExecArray | null;
  while ((match = scored.exec(text))) {
    raw.push({
      index: match.index, end: scored.lastIndex, p1: match[1], r1: match[2],
      s1: Number(match[3]), s2: Number(match[4]), p2: match[5], r2: match[6], walkover: false,
    });
  }
  while ((match = walkover.exec(text))) {
    raw.push({
      index: match.index, end: walkover.lastIndex, p1: match[1], r1: match[2],
      s1: null, s2: null, p2: match[3], r2: match[4], walkover: true,
    });
  }
  raw.sort((a, b) => a.index - b.index);

  const target = Math.floor(bestOf / 2) + 1;
  const matches = raw.map((item, index): SnookerSourceMatch => {
    const expected = item.walkover ? 0 : (item.s1 ?? 0) + (item.s2 ?? 0);
    const status: SnookerSourceMatch["status"] = item.walkover
      ? "walkover"
      : (item.s1 ?? 0) >= target || (item.s2 ?? 0) >= target ? "completed" : "live";
    return {
      id: `${key}-${index + 1}`,
      roundKey: key,
      roundLabelZh: labelZh,
      bestOf,
      player1: player(item.p1, item.r1),
      player2: player(item.p2, item.r2),
      score1: item.s1,
      score2: item.s2,
      status,
      frames: frames(text.slice(item.end, raw[index + 1]?.index ?? text.length), expected),
    };
  });

  return { key, labelZh, bestOf, matches };
}

export function parseSnookerOrgEvent(html: string) {
  const text = snookerOrgText(html);
  const qualifierAt = text.search(/China Open Qualifiers/i);
  const mainText = qualifierAt >= 0 ? text.slice(0, qualifierAt) : text;

  const markers = ROUND_DEFS
    .map(([key, pattern, labelZh, bestOf]) => {
      const match = pattern.exec(mainText);
      return { key, labelZh, bestOf, index: match?.index ?? -1, length: match?.[0].length ?? 0 };
    })
    .filter((marker) => marker.index >= 0)
    .sort((a, b) => a.index - b.index);

  const rounds = markers.map((marker, index) =>
    parseRound(
      mainText.slice(marker.index + marker.length, markers[index + 1]?.index ?? mainText.length),
      marker.key,
      marker.labelZh,
      marker.bestOf,
    ),
  );
  const matches = rounds.flatMap((round) => round.matches);

  return {
    eventDetected: /China\s+Open/i.test(text),
    rounds,
    matches,
    liveMatch: matches.find((match) => match.status === "live") ?? null,
  };
}
