export type Group = "少年组" | "青年组";
export type PhaseId = "qualifier-one" | "qualifier-two" | "main-one" | "main-two";
export type PrizeMap = Record<Group, string[][]>;

export type Match = {
  id: string;
  eventId: string;
  phaseId: PhaseId | null;
  group: Group;
  date: string;
  time: string;
  round: string;
  progress: string;
  race: string;
  order: number;
  playerA: string;
  playerB: string;
  table: string;
  isTv: boolean;
  status: string;
  playerAId?: string | null;
  playerBId?: string | null;
  matchCode?: string;
  scoreA?: string | null;
  scoreB?: string | null;
  resultType?: string | null;
};

export type Phase = {
  id: PhaseId;
  number: string;
  title: string;
  date: string;
  status: "待开始" | "进行中" | "已结束";
};

export type Station = {
  eventId: string;
  year: number;
  id: string;
  stop: string;
  city: string;
  shortCity: string;
  status: string;
  active: boolean;
  title: string;
  sponsor: string;
  coverImage: string;
  date: string;
  duration: string;
  venue: string;
  venueDetail: string;
  rulesPdf: string;
  refereesPdf: string;
  qualDate: string;
  mainDate: string;
  totalPrize: string;
  mainSize: string;
  intro: string;
  organizers: string[][];
  age: Record<Group, string>;
  minimumAge: string;
  format: string[][];
  draw: string[];
  signup: string;
  prizes: PrizeMap;
  phases: Phase[];
};

export type EventData = {
  stations: Station[];
  matches: Match[];
  players: string[];
};
