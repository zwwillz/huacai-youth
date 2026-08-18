import type { SnookerPlayerDetail, SnookerPlayerStatus } from "./player-data";
import { getSnookerPlayerDetail } from "./player-data";

const DEFAULT_SUPABASE_URL = "https://rtlvncsmbueatdzqvhbn.supabase.co";
const DEFAULT_PUBLISHABLE_KEY = "sb_publishable_SR0NVsqpSBGBMP3xg9utvQ_jywPEUNP";

const SUPABASE_URL = process.env.SNOOKER_SUPABASE_URL || DEFAULT_SUPABASE_URL;
const SUPABASE_KEY = process.env.SNOOKER_SUPABASE_PUBLISHABLE_KEY || DEFAULT_PUBLISHABLE_KEY;
const RPC_URL = `${SUPABASE_URL}/rest/v1/rpc/snooker_player_detail_public`;

type RpcPlayer = {
  id: string;
  slug: string;
  name_en: string;
  name_zh: string;
  short_name_zh: string | null;
  nationality_zh: string | null;
  country_code: string | null;
  date_of_birth: string | null;
  turned_pro: number | null;
  current_rank: number | null;
  ranking_points: number | null;
  avatar_url: string | null;
  is_current_tour: boolean;
  tour_status: string;
  player_status: SnookerPlayerStatus;
};

type RpcProfile = {
  nickname_en: string | null;
  nickname_zh: string | null;
  biography_html_en: string | null;
  biography_html_zh: string | null;
  quote_en: string | null;
  quote_zh: string | null;
};

type RpcCareer = {
  ranking_titles: number | null;
  ranking_finals: number | null;
  highest_ranking: number | null;
  masters_titles: number | null;
  uk_championship_titles: number | null;
  world_championship_titles: number | null;
  triple_crown_titles: number | null;
  career_147s: number | null;
  last_tournament_win: string | null;
  last_tournament_win_zh: string | null;
};

type RpcSeason = {
  season_start_year: number;
  season_label: string;
  ranking: number | null;
  tournaments_won: number | null;
  points_scored: number | null;
  matches_played: number | null;
  matches_won: number | null;
  match_win_rate: number | string | null;
  average_shot_time: number | string | null;
  breaks_50_plus: number | null;
  breaks_100_plus: number | null;
  highest_break: number | null;
  season_147s: number | null;
  average_break: number | string | null;
  is_final: boolean;
};

type RpcHighlight = {
  highlight_year: number | null;
  sequence_no: number;
  description_en: string;
  description_zh: string | null;
};

type RpcRanking = {
  player_id: string;
  rank: number;
  points: number | null;
  ranking_money: number | null;
};

type RpcPayload = {
  player: RpcPlayer;
  profile: RpcProfile | null;
  career: RpcCareer | null;
  seasons: RpcSeason[];
  highlights: RpcHighlight[];
  official_ranking: RpcRanking | null;
};

function toNumberOrNull(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function decodeEntities(value: string) {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&ndash;|&#8211;/gi, "–")
    .replace(/&mdash;|&#8212;/gi, "—")
    .replace(/&pound;/gi, "£")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCharCode(Number(code)));
}

function detailAvatarUrl(value: string | null) {
  if (!value) return null;
  return value.includes("/wst/256/") ? value.replace("/wst/256/", "/wst/512/") : value;
}

function htmlToText(html: string | null) {
  if (!html) return null;
  const text = decodeEntities(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<br\s*\/?\s*>/gi, "\n")
      .replace(/<\/p>/gi, "\n\n")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return text || null;
}

function mapPayload(payload: RpcPayload): SnookerPlayerDetail {
  const p = payload.player;
  const ranking = payload.official_ranking;
  const career = payload.career;
  const rankingPoints = ranking?.ranking_money ?? ranking?.points ?? p.ranking_points;
  return {
    id: p.id,
    slug: p.slug,
    nameEn: p.name_en,
    nameZh: p.name_zh,
    shortNameZh: p.short_name_zh,
    nationalityZh: p.nationality_zh,
    countryCode: p.country_code,
    dateOfBirth: p.date_of_birth,
    turnedPro: p.turned_pro,
    currentRank: ranking?.rank ?? p.current_rank,
    rankingPoints: rankingPoints === null || rankingPoints === undefined ? null : Number(rankingPoints),
    avatarUrl: detailAvatarUrl(p.avatar_url),
    isCurrentTour: p.is_current_tour,
    tourStatus: p.tour_status,
    playerStatus: p.player_status,
    nicknameEn: payload.profile?.nickname_en ?? null,
    nicknameZh: payload.profile?.nickname_zh ?? payload.profile?.nickname_en ?? null,
    biographyEn: htmlToText(payload.profile?.biography_html_en ?? null),
    biographyZh: htmlToText(payload.profile?.biography_html_zh ?? payload.profile?.biography_html_en ?? null),
    quoteEn: payload.profile?.quote_en ?? null,
    quoteZh: payload.profile?.quote_zh ?? payload.profile?.quote_en ?? null,
    career: career ? {
      rankingTitles: career.ranking_titles,
      rankingFinals: career.ranking_finals,
      highestRanking: career.highest_ranking,
      mastersTitles: career.masters_titles,
      ukChampionshipTitles: career.uk_championship_titles,
      worldChampionshipTitles: career.world_championship_titles,
      tripleCrownTitles: career.triple_crown_titles,
      career147s: career.career_147s,
      lastTournamentWin: career.last_tournament_win,
      lastTournamentWinZh: career.last_tournament_win_zh ?? career.last_tournament_win,
    } : null,
    seasons: (payload.seasons ?? []).map((row) => ({
      seasonStartYear: row.season_start_year,
      seasonLabel: row.season_label,
      ranking: row.ranking,
      tournamentsWon: row.tournaments_won,
      pointsScored: row.points_scored,
      matchesPlayed: row.matches_played,
      matchesWon: row.matches_won,
      matchWinRate: toNumberOrNull(row.match_win_rate),
      averageShotTime: toNumberOrNull(row.average_shot_time),
      breaks50Plus: row.breaks_50_plus,
      breaks100Plus: row.breaks_100_plus,
      highestBreak: row.highest_break,
      season147s: row.season_147s,
      averageBreak: toNumberOrNull(row.average_break),
      isFinal: row.is_final,
    })),
    highlights: (payload.highlights ?? []).map((row) => ({
      year: row.highlight_year,
      sequenceNo: row.sequence_no,
      descriptionEn: row.description_en,
      descriptionZh: row.description_zh ?? row.description_en,
    })),
  };
}

export async function getSnookerPlayerDetailFast(slug: string): Promise<SnookerPlayerDetail | null> {
  try {
    const query = new URLSearchParams({ p_slug: slug });
    const response = await fetch(`${RPC_URL}?${query.toString()}`, {
      headers: { apikey: SUPABASE_KEY, Accept: "application/json" },
      next: { revalidate: 300 },
    });
    if (!response.ok) throw new Error(`SNOOKER_PLAYER_DETAIL_RPC_${response.status}`);
    const payload = await response.json() as RpcPayload | null;
    return payload?.player ? mapPayload(payload) : null;
  } catch {
    return getSnookerPlayerDetail(slug);
  }
}
