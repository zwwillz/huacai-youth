const DEFAULT_SUPABASE_URL = "https://rtlvncsmbueatdzqvhbn.supabase.co";
const DEFAULT_PUBLISHABLE_KEY = "sb_publishable_SR0NVsqpSBGBMP3xg9utvQ_jywPEUNP";

const SUPABASE_URL = process.env.SNOOKER_SUPABASE_URL || DEFAULT_SUPABASE_URL;
const SUPABASE_KEY = process.env.SNOOKER_SUPABASE_PUBLISHABLE_KEY || DEFAULT_PUBLISHABLE_KEY;
const REST_URL = `${SUPABASE_URL}/rest/v1`;

export type SnookerPlayerListItem = {
  id: string;
  slug: string;
  nameEn: string;
  nameZh: string;
  shortNameZh: string | null;
  nationalityZh: string | null;
  countryCode: string | null;
  dateOfBirth: string | null;
  turnedPro: number | null;
  currentRank: number | null;
  rankingPoints: number | null;
  avatarUrl: string | null;
  isCurrentTour: boolean;
  tourStatus: string;
};

export type SnookerPlayerCareerStats = {
  rankingTitles: number | null;
  rankingFinals: number | null;
  highestRanking: number | null;
  mastersTitles: number | null;
  ukChampionshipTitles: number | null;
  worldChampionshipTitles: number | null;
  tripleCrownTitles: number | null;
  career147s: number | null;
  lastTournamentWin: string | null;
  lastTournamentWinZh: string | null;
};

export type SnookerPlayerSeasonStats = {
  seasonStartYear: number;
  seasonLabel: string;
  ranking: number | null;
  tournamentsWon: number | null;
  pointsScored: number | null;
  matchesPlayed: number | null;
  matchesWon: number | null;
  matchWinRate: number | null;
  averageShotTime: number | null;
  breaks50Plus: number | null;
  breaks100Plus: number | null;
  highestBreak: number | null;
  season147s: number | null;
  averageBreak: number | null;
  isFinal: boolean;
};

export type SnookerPlayerCareerHighlight = {
  year: number | null;
  sequenceNo: number;
  descriptionEn: string;
  descriptionZh: string;
};

export type SnookerPlayerDetail = SnookerPlayerListItem & {
  nicknameEn: string | null;
  nicknameZh: string | null;
  biographyEn: string | null;
  biographyZh: string | null;
  quoteEn: string | null;
  quoteZh: string | null;
  career: SnookerPlayerCareerStats | null;
  seasons: SnookerPlayerSeasonStats[];
  highlights: SnookerPlayerCareerHighlight[];
};

type PlayerRow = {
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
};

type OfficialRankingRow = {
  player_id: string;
  rank: number;
  points: number | null;
  ranking_money: number | null;
};

type ProfileRow = {
  nickname_en: string | null;
  nickname_zh: string | null;
  biography_html_en: string | null;
  biography_html_zh: string | null;
  quote_en: string | null;
  quote_zh: string | null;
};

type CareerRow = {
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

type SeasonRow = {
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

type HighlightRow = {
  highlight_year: number | null;
  sequence_no: number;
  description_en: string;
  description_zh: string | null;
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

async function rest<T>(resource: string, params: URLSearchParams, revalidate = 300): Promise<T> {
  const response = await fetch(`${REST_URL}/${resource}?${params.toString()}`, {
    headers: {
      apikey: SUPABASE_KEY,
      Accept: "application/json",
    },
    next: { revalidate },
  });

  if (!response.ok) {
    const message = await response.text().catch(() => "");
    throw new Error(`SNOOKER_PLAYER_DB_HTTP_${response.status}${message ? `: ${message.slice(0, 240)}` : ""}`);
  }

  return response.json() as Promise<T>;
}

function mapPlayer(row: PlayerRow): SnookerPlayerListItem {
  return {
    id: row.id,
    slug: row.slug,
    nameEn: row.name_en,
    nameZh: row.name_zh,
    shortNameZh: row.short_name_zh,
    nationalityZh: row.nationality_zh,
    countryCode: row.country_code,
    dateOfBirth: row.date_of_birth,
    turnedPro: row.turned_pro,
    currentRank: row.current_rank,
    rankingPoints: row.ranking_points,
    avatarUrl: row.avatar_url,
    isCurrentTour: row.is_current_tour,
    tourStatus: row.tour_status,
  };
}

function withOfficialRanking(player: SnookerPlayerListItem, ranking?: OfficialRankingRow) {
  if (!ranking) return player;
  return {
    ...player,
    currentRank: ranking.rank,
    rankingPoints: Number(ranking.ranking_money ?? ranking.points ?? 0),
  };
}

function isDirectoryPlayerRow(row: PlayerRow) {
  const slug = row.slug.trim().toLowerCase();
  const nameEn = row.name_en.trim();
  const nameZh = row.name_zh.trim();

  const isPlaceholder =
    /^china-wildcard-\d+(?:-|$)/i.test(slug) ||
    /(?:^|-)winner-(?:of-)?match-\d+(?:-|$)/i.test(slug) ||
    /^China Wildcard #?\d+$/i.test(nameEn) ||
    /^Winner of Match \d+$/i.test(nameEn) ||
    /^中国外卡\d+号$/.test(nameZh) ||
    /^第\d+场胜者$/.test(nameZh);

  return !isPlaceholder;
}

const PLAYER_SELECT = [
  "id",
  "slug",
  "name_en",
  "name_zh",
  "short_name_zh",
  "nationality_zh",
  "country_code",
  "date_of_birth",
  "turned_pro",
  "current_rank",
  "ranking_points",
  "avatar_url",
  "is_current_tour",
  "tour_status",
].join(",");

function officialRankingParams(extra: Record<string, string> = {}) {
  return new URLSearchParams({
    select: "player_id,rank,points,ranking_money",
    list_key: "eq.world_official",
    order: "rank.asc",
    ...extra,
  });
}

export async function getSnookerPlayerDirectory(): Promise<SnookerPlayerListItem[]> {
  const params = new URLSearchParams({
    select: PLAYER_SELECT,
    order: "current_rank.asc.nullslast,name_en.asc",
  });
  const [rows, rankingRows] = await Promise.all([
    rest<PlayerRow[]>("snooker_players", params, 300),
    rest<OfficialRankingRow[]>("snooker_latest_rankings", officialRankingParams({ limit: "256" }), 60),
  ]);
  const rankingByPlayer = new Map(rankingRows.map((row) => [row.player_id, row]));
  return rows
    .filter(isDirectoryPlayerRow)
    .map((row) => withOfficialRanking(mapPlayer(row), rankingByPlayer.get(row.id)))
    .sort((a, b) => (a.currentRank ?? 9999) - (b.currentRank ?? 9999) || a.nameEn.localeCompare(b.nameEn));
}

export async function getSnookerPlayerDetail(slug: string): Promise<SnookerPlayerDetail | null> {
  const playerParams = new URLSearchParams({
    select: PLAYER_SELECT,
    slug: `eq.${slug}`,
    limit: "1",
  });
  const [playerRow] = await rest<PlayerRow[]>("snooker_players", playerParams, 300);
  if (!playerRow) return null;

  const profileParams = new URLSearchParams({
    select: "nickname_en,nickname_zh,biography_html_en,biography_html_zh,quote_en,quote_zh",
    player_id: `eq.${playerRow.id}`,
    limit: "1",
  });
  const careerParams = new URLSearchParams({
    select: "ranking_titles,ranking_finals,highest_ranking,masters_titles,uk_championship_titles,world_championship_titles,triple_crown_titles,career_147s,last_tournament_win,last_tournament_win_zh",
    player_id: `eq.${playerRow.id}`,
    limit: "1",
  });
  const seasonParams = new URLSearchParams({
    select: "season_start_year,season_label,ranking,tournaments_won,points_scored,matches_played,matches_won,match_win_rate,average_shot_time,breaks_50_plus,breaks_100_plus,highest_break,season_147s,average_break,is_final",
    player_id: `eq.${playerRow.id}`,
    order: "season_start_year.desc",
  });
  const highlightParams = new URLSearchParams({
    select: "highlight_year,sequence_no,description_en,description_zh",
    player_id: `eq.${playerRow.id}`,
    order: "highlight_year.desc.nullslast,sequence_no.asc",
  });

  const [profileRows, careerRows, seasonRows, highlightRows, officialRows] = await Promise.all([
    rest<ProfileRow[]>("snooker_player_profile_details", profileParams, 1800),
    rest<CareerRow[]>("snooker_player_career_stats", careerParams, 900),
    rest<SeasonRow[]>("snooker_player_season_stats", seasonParams, 900),
    rest<HighlightRow[]>("snooker_player_career_highlights", highlightParams, 1800),
    rest<OfficialRankingRow[]>("snooker_latest_rankings", officialRankingParams({ player_id: `eq.${playerRow.id}`, limit: "1" }), 60),
  ]);

  const profile = profileRows[0] ?? null;
  const careerRow = careerRows[0] ?? null;
  const basePlayer = withOfficialRanking(mapPlayer(playerRow), officialRows[0]);

  return {
    ...basePlayer,
    avatarUrl: detailAvatarUrl(basePlayer.avatarUrl),
    nicknameEn: profile?.nickname_en ?? null,
    nicknameZh: profile?.nickname_zh ?? profile?.nickname_en ?? null,
    biographyEn: htmlToText(profile?.biography_html_en ?? null),
    biographyZh: htmlToText(profile?.biography_html_zh ?? profile?.biography_html_en ?? null),
    quoteEn: profile?.quote_en ?? null,
    quoteZh: profile?.quote_zh ?? profile?.quote_en ?? null,
    career: careerRow
      ? {
          rankingTitles: careerRow.ranking_titles,
          rankingFinals: careerRow.ranking_finals,
          highestRanking: careerRow.highest_ranking,
          mastersTitles: careerRow.masters_titles,
          ukChampionshipTitles: careerRow.uk_championship_titles,
          worldChampionshipTitles: careerRow.world_championship_titles,
          tripleCrownTitles: careerRow.triple_crown_titles,
          career147s: careerRow.career_147s,
          lastTournamentWin: careerRow.last_tournament_win,
          lastTournamentWinZh: careerRow.last_tournament_win_zh ?? careerRow.last_tournament_win,
        }
      : null,
    seasons: seasonRows.map((row) => ({
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
    highlights: highlightRows.map((row) => ({
      year: row.highlight_year,
      sequenceNo: row.sequence_no,
      descriptionEn: row.description_en,
      descriptionZh: row.description_zh ?? row.description_en,
    })),
  };
}
