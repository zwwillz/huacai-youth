import { findPlayerByEnglishName } from "./data/players";
import { snookerOrgText, type SnookerSourceMatch, type SnookerSourcePlayer } from "./snooker-org";

function normalizePlayer(name: string, rank?: string): SnookerSourcePlayer {
  const cleaned = name.replace(/\s+/g, " ").trim();
  const master = findPlayerByEnglishName(cleaned);
  return {
    nameEn: master?.nameEn ?? cleaned,
    nameZh: master?.nameZh ?? cleaned,
    sourceRank: rank ? Number(rank) : null,
  };
}

function frameScores(segment: string, expected: number) {
  if (expected <= 0) return [];
  const scores = segment.match(/\b\d{1,3}\s*-\s*\d{1,3}(?:\s*\([^)]*\))?/g) ?? [];
  return scores.slice(0, expected).map((score) => score.replace(/\s*-\s*/g, "–").trim());
}

/**
 * snooker.org's Live Scores page is intentionally parsed separately from the
 * full event page. The live page has a much flatter structure and may omit the
 * full round hierarchy, so reusing the event parser can silently match other
 * completed matches while missing the one match we actually need to refresh.
 */
export function parseChinaOpenLiveScores(html: string): SnookerSourceMatch[] {
  const text = snookerOrgText(html);
  if (!/China\s+Open/i.test(text)) return [];

  const eventStart = text.search(/China\s+Open\s*\(/i);
  const eventText = eventStart >= 0 ? text.slice(eventStart) : text;

  const final = eventText.match(
    /\bFinal\s*\(\s*19\s*\)\s+([A-Z][A-Za-zÀ-ž.'’\-\s]+?)\s+\[(\d+)\]\s+(\d+)\s*-\s*(\d+)\s+([A-Z][A-Za-zÀ-ž.'’\-\s]+?)\s+\[(\d+)\]/i,
  );

  if (!final) return [];

  const player1 = normalizePlayer(final[1], final[2]);
  const player2 = normalizePlayer(final[5], final[6]);
  const score1 = Number(final[3]);
  const score2 = Number(final[4]);
  const target = 10;
  const status: SnookerSourceMatch["status"] = score1 >= target || score2 >= target ? "completed" : "live";

  const afterMatch = eventText.slice((final.index ?? 0) + final[0].length);
  const detailEndCandidates = [
    afterMatch.search(/\bReferee\b/i),
    afterMatch.search(/\bSemifinals\b/i),
    afterMatch.search(/\bSee also\b/i),
  ].filter((index) => index > 0);
  const detailEnd = detailEndCandidates.length ? Math.min(...detailEndCandidates) : afterMatch.length;
  const detail = afterMatch.slice(0, detailEnd);
  const expectedFrames = score1 + score2;

  return [{
    id: "live-china-open-final",
    roundKey: "final",
    roundLabelZh: "决赛",
    bestOf: 19,
    player1,
    player2,
    score1,
    score2,
    status,
    frames: frameScores(detail, expectedFrames),
  }];
}
