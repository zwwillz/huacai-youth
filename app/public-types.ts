export type GroupName = "少年组" | "青年组";

export type PrizeMap = Record<GroupName, string[][]>;

export type PublicPhase = {
  id: string;
  databaseId: string;
  number: string;
  title: string;
  date: string;
  status: "待开始" | "进行中" | "已结束";
};

export type PublicGroup = {
  id: string;
  name: string;
  code: string;
  mainDrawSize: number | null;
  registrationFeeCents: number;
};

export type PublicGuide = {
  title: string;
  body: string | null;
  fileUrl: string | null;
  externalUrl: string | null;
};

export type PublicStation = {
  id: string;
  slug: string;
  visualKey: string;
  year: number;
  stationNo: number;
  stop: string;
  city: string;
  shortCity: string;
  status: string;
  active: boolean;
  title: string;
  sponsor: string;
  sponsorImage: string | null;
  date: string;
  duration: string;
  venue: string;
  venueDetail: string;
  rulesPdf: string | null;
  refereesPdf: string | null;
  qualDate: string;
  mainDate: string;
  totalPrize: string;
  mainSize: string;
  intro: string;
  organizers: string[][];
  age: Record<GroupName, string>;
  minimumAge: string;
  format: string[][];
  draw: string[];
  signup: string;
  prizes: PrizeMap;
  groups: PublicGroup[];
  phases: PublicPhase[];
  guides: Partial<Record<"transport" | "clothing", PublicGuide>>;
};

export type PublicMatch = {
  id: string;
  eventId: string;
  phaseId: string | null;
  group: string;
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
};

export type PublicParticipant = {
  eventId: string;
  group: string;
  playerId: string;
  playerName: string;
};

export type PublicSiteData = {
  stations: PublicStation[];
  matches: PublicMatch[];
  participants: PublicParticipant[];
  players: string[];
};
