export type SnookerMatchStatus = "upcoming" | "live" | "session-break" | "completed" | "walkover";
export type SnookerPlayerStatus = "tour" | "former_pro" | "amateur" | "unknown";
export type SnookerEventType = "ranking" | "invitational" | "exhibition" | "pro_qualifier";
export type SnookerEventStage = "main" | "qualifier" | "finals";
export type SnookerRankingStatus = "ranking" | "non_ranking" | "not_applicable";

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

export type SnookerSeasonStatistics = {
  seasonStartYear: number;
  seasonLabel: string;
  ranking?: number;
  tournamentsWon?: number;
  pointsScored?: number;
  matchesPlayed?: number;
  matchesWon?: number;
  matchWinRate?: number;
  averageShotTimeSeconds?: number;
  breaks50Plus?: number;
  breaks100Plus?: number;
  highestBreak?: number;
  season147s?: number;
  averageBreak?: number;
};

export type SnookerPlayer = {
  id: string;
  slug: string;
  nameEn: string;
  nameZh: string;
  shortNameZh: string;
  shortNameEn?: string;
  nationalityZh: string;
  countryCode: string;
  currentRank: number | null;
  rankingPoints: number | null;
  dateOfBirth?: string;
  turnedPro?: number;
  nickname?: string;
  careerStats?: SnookerPlayerCareerStats;
  seasonStatistics?: SnookerSeasonStatistics;
  wstId?: string;
  snookerOrgId?: string;
  aliases?: string[];
  avatar?: SnookerPlayerAvatar;
  avatarUrl?: string;
  profileSource?: "WST" | "snooker.org" | "curated";
  isCurrentTour?: boolean;
  tourStatus?: string;
  playerStatus?: SnookerPlayerStatus;
};

export type SnookerFrame = {
  frameNo: number;
  score1: number;
  score2: number;
  break1?: number;
  break2?: number;
  note?: string;
};

export type SnookerMatchPlayerStatistics = {
  playerId: string;
  totalPoints?: number;
  averageShotTimeSeconds?: number;
  potRate?: number;
  breaks50Plus?: number;
  breaks100Plus?: number;
  highestBreak?: number;
  averageBreak?: number;
  shotsTaken?: number;
  timeOnTablePct?: number;
};

export type SnookerHeadToHeadMeeting = {
  date?: string;
  tournament?: string;
  round?: string;
  homePlayerName?: string;
  awayPlayerName?: string;
  homeScore?: number;
  awayScore?: number;
};

export type SnookerHeadToHead = {
  meetings: number;
  player1Wins: number;
  player2Wins: number;
  player1Frames: number;
  player2Frames: number;
  recentMeetings: SnookerHeadToHeadMeeting[];
  sourceUpdatedAt?: string;
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
  statistics?: SnookerMatchPlayerStatistics[];
  headToHead?: SnookerHeadToHead;
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

export type SnookerPrizeRow = {
  key: string;
  labelZh: string;
  labelEn?: string;
  amount: number;
  currency: "GBP";
  sortOrder: number;
  isTotal?: boolean;
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
  eventType?: SnookerEventType;
  eventStage?: SnookerEventStage;
  rankingStatus?: SnookerRankingStatus;
  status: "upcoming" | "live" | "completed";
  statusLabelZh: string;
  startDate: string;
  endDate: string;
  cityZh: string;
  countryZh: string;
  venueZh: string;
  venueEn?: string;
  previousChampionZh?: string;
  previousChampionYear?: number;
  winnerPrize: number;
  runnerUpPrize: number;
  currency: "GBP";
  prizes?: SnookerPrizeRow[];
  refereeZh?: string;
  sourceName: string;
  sourceUrl: string;
  snapshotAt: string;
  rounds: SnookerRound[];
  schedulePartial?: boolean;
  publishedMatchCount?: number;
};

export type SnookerCalendarEvent = {
  id: string;
  slug: string;
  nameZh: string;
  nameEn: string;
  season: string;
  typeZh: "排名赛" | "非排名赛" | "资格赛" | "邀请赛" | "表演赛" | "选拔赛";
  eventType?: SnookerEventType;
  eventStage?: SnookerEventStage;
  rankingStatus?: SnookerRankingStatus;
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
