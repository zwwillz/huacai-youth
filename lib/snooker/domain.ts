export type SnookerMatchStatus = "upcoming" | "live" | "session-break" | "completed" | "walkover";

export type SnookerPlayerCareerStats = {
  tripleCrownTitles: number;
  rankingTitles: number;
  rankingFinals: number;
  maximums147: number;
};

export type SnookerPlayerAvatar = {
  url: string;
  source: "wikimedia-commons";
  credit: string;
  license: string;
  sourcePage: string;
};

export type SnookerPlayer = {
  id: string;
  slug: string;
  nameEn: string;
  nameZh: string;
  shortNameZh: string;
  nationalityZh: string;
  countryCode: string;
  currentRank: number | null;
  rankingPoints: number | null;
  dateOfBirth?: string;
  turnedPro?: number;
  nickname?: string;
  careerStats?: SnookerPlayerCareerStats;
  wstId?: string;
  snookerOrgId?: string;
  aliases?: string[];
  avatar?: SnookerPlayerAvatar;
  profileSource?: "WST" | "snooker.org" | "curated";
};

export type SnookerFrame = {
  frameNo: number;
  score1: number;
  score2: number;
  break1?: number;
  break2?: number;
  note?: string;
};

export type SnookerMatch = {
  id: string;
  roundKey: string;
  roundLabelZh: string;
  matchNo: number;
  bestOf: number;
  player1Id: string;
  player2Id: string;
  score1: number | null;
  score2: number | null;
  status: SnookerMatchStatus;
  statusLabelZh: string;
  scheduledAt?: string;
  timeLabelZh?: string;
  sessionTimesZh?: string[];
  sessionLabelZh?: string;
  tableLabelZh?: string;
  frames?: SnookerFrame[];
  note?: string;
  winnerId?: string;
};

export type SnookerRound = {
  key: string;
  labelZh: string;
  labelEn: string;
  bestOf: number;
  loserPrize?: number;
  matches: SnookerMatch[];
};

export type SnookerEvent = {
  id: string;
  sourceEventId: string;
  slug: string;
  nameZh: string;
  nameEn: string;
  sponsorName?: string;
  season: string;
  typeZh: string;
  status: "upcoming" | "live" | "completed";
  statusLabelZh: string;
  startDate: string;
  endDate: string;
  cityZh: string;
  countryZh: string;
  venueZh: string;
  venueEn?: string;
  previousChampionZh?: string;
  winnerPrize: number;
  runnerUpPrize: number;
  currency: "GBP";
  refereeZh?: string;
  sourceName: string;
  sourceUrl: string;
  snapshotAt: string;
  rounds: SnookerRound[];
};

export type SnookerCalendarEvent = {
  id: string;
  slug: string;
  nameZh: string;
  nameEn: string;
  season: string;
  typeZh: "排名赛" | "非排名赛" | "资格赛";
  status: "upcoming" | "live" | "completed";
  statusLabelZh: string;
  startDate: string;
  endDate: string;
  cityZh: string;
  countryZh: string;
  venueZh?: string;
  winnerZh?: string;
  current?: boolean;
  dataReady?: boolean;
};

export type SnookerRankingRow = {
  rank: number;
  playerId: string;
  points: number;
  change?: number;
};

export type PlayerEventStats = {
  playerId: string;
  eventId: string;
  played: number;
  wins: number;
  losses: number;
  frameWins: number;
  frameLosses: number;
  bestRoundKey: string;
  bestRoundLabelZh: string;
  isActive: boolean;
  matches: SnookerMatch[];
};

export type SnookerDashboardSnapshot = {
  version: string;
  builtAt: string;
  event: SnookerEvent;
  calendar: SnookerCalendarEvent[];
  players: SnookerPlayer[];
  rankings: SnookerRankingRow[];
};
