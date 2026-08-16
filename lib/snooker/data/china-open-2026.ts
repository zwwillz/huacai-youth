import type { SnookerEvent, SnookerFrame, SnookerMatch, SnookerMatchStatus, SnookerRound } from "../domain";

const pid = (slug: string) => `p-${slug}`;

function frame(frameNo: number, score1: number, score2: number, break1?: number, break2?: number, note?: string): SnookerFrame {
  return {
    frameNo,
    score1,
    score2,
    ...(break1 ? { break1 } : {}),
    ...(break2 ? { break2 } : {}),
    ...(note ? { note } : {}),
  };
}

function match(input: {
  id: string;
  roundKey: string;
  roundLabelZh: string;
  matchNo: number;
  bestOf: number;
  p1: string;
  p2: string;
  score1?: number | null;
  score2?: number | null;
  status?: SnookerMatchStatus;
  statusLabelZh?: string;
  frames?: SnookerFrame[];
  note?: string;
  scheduledAt?: string;
  timeLabelZh?: string;
  sessionTimesZh?: string[];
  sessionLabelZh?: string;
}): SnookerMatch {
  const score1 = input.score1 ?? null;
  const score2 = input.score2 ?? null;
  const status = input.status ?? "completed";
  const winnerId = status === "walkover"
    ? pid(input.p1)
    : status === "completed" && score1 !== null && score2 !== null
      ? (score1 > score2 ? pid(input.p1) : pid(input.p2))
      : undefined;

  const statusLabelZh = input.statusLabelZh ?? (
    status === "completed" ? "已结束" :
    status === "walkover" ? "退赛晋级" :
    status === "upcoming" ? "待开始" :
    status === "session-break" ? "进行中 · 阶段休息" : "进行中"
  );

  return {
    id: input.id,
    roundKey: input.roundKey,
    roundLabelZh: input.roundLabelZh,
    matchNo: input.matchNo,
    bestOf: input.bestOf,
    player1Id: pid(input.p1),
    player2Id: pid(input.p2),
    score1,
    score2,
    status,
    statusLabelZh,
    ...(input.scheduledAt ? { scheduledAt: input.scheduledAt } : {}),
    ...(input.timeLabelZh ? { timeLabelZh: input.timeLabelZh } : {}),
    ...(input.sessionTimesZh ? { sessionTimesZh: input.sessionTimesZh } : {}),
    ...(input.sessionLabelZh ? { sessionLabelZh: input.sessionLabelZh } : {}),
    ...(input.frames ? { frames: input.frames } : {}),
    ...(input.note ? { note: input.note } : {}),
    ...(winnerId ? { winnerId } : {}),
  };
}

const rounds: SnookerRound[] = [
  {
    key: "final",
    labelZh: "决赛",
    labelEn: "Final",
    bestOf: 19,
    matches: [
      match({
        id: "co26-final-1", roundKey: "final", roundLabelZh: "决赛", matchNo: 1, bestOf: 19,
        p1: "mark-selby", p2: "noppon-saengkham", score1: 4, score2: 4,
        status: "session-break", statusLabelZh: "进行中 · 第一阶段结束",
        scheduledAt: "2026-08-16T14:00:00+08:00",
        timeLabelZh: "8月16日 14:00 / 19:30",
        sessionTimesZh: ["14:00 第一阶段", "19:30 第二阶段"],
        sessionLabelZh: "第一阶段结束 · 4-4",
        frames: [
          frame(1, 8, 67),
          frame(2, 89, 38),
          frame(3, 138, 0, 138),
          frame(4, 0, 73),
          frame(5, 0, 80, undefined, 80),
          frame(6, 5, 75, undefined, 51),
          frame(7, 70, 68, 53, 57),
          frame(8, 73, 32),
        ],
        note: "19局10胜；两阶段进行。实时比分以数据源最近同步为准。",
      }),
    ],
  },
  {
    key: "semifinals",
    labelZh: "半决赛",
    labelEn: "Semifinals",
    bestOf: 11,
    loserPrize: 50000,
    matches: [
      match({
        id: "co26-sf-1", roundKey: "semifinals", roundLabelZh: "半决赛", matchNo: 1, bestOf: 11,
        p1: "mark-selby", p2: "stuart-bingham", score1: 6, score2: 2,
        scheduledAt: "2026-08-15T14:00:00+08:00", timeLabelZh: "8月15日 14:00",
        frames: [
          frame(1,75,39), frame(2,0,130,undefined,130), frame(3,106,1,74), frame(4,15,78),
          frame(5,102,0,102), frame(6,85,22), frame(7,75,15), frame(8,89,5,72),
        ],
      }),
      match({
        id: "co26-sf-2", roundKey: "semifinals", roundLabelZh: "半决赛", matchNo: 2, bestOf: 11,
        p1: "noppon-saengkham", p2: "zhou-yuelong", score1: 6, score2: 5,
        scheduledAt: "2026-08-15T19:30:00+08:00", timeLabelZh: "8月15日 19:30",
        frames: [
          frame(1,87,7), frame(2,86,4,86), frame(3,7,105,undefined,56), frame(4,24,62),
          frame(5,67,32), frame(6,64,51,56), frame(7,33,68), frame(8,75,26,56),
          frame(9,0,99,undefined,99), frame(10,32,74,undefined,74), frame(11,134,0,134),
        ],
      }),
    ],
  },
  {
    key: "quarterfinals",
    labelZh: "1/4决赛",
    labelEn: "Quarterfinals",
    bestOf: 11,
    loserPrize: 25000,
    matches: [
      match({ id:"co26-qf-1", roundKey:"quarterfinals", roundLabelZh:"1/4决赛", matchNo:1, bestOf:11, p1:"mark-selby", p2:"neil-robertson", score1:6, score2:1, scheduledAt:"2026-08-14T14:00:00+08:00", timeLabelZh:"8月14日 14:00" }),
      match({ id:"co26-qf-2", roundKey:"quarterfinals", roundLabelZh:"1/4决赛", matchNo:2, bestOf:11, p1:"stuart-bingham", p2:"zhang-anda", score1:6, score2:3, scheduledAt:"2026-08-14T14:00:00+08:00", timeLabelZh:"8月14日 14:00" }),
      match({ id:"co26-qf-3", roundKey:"quarterfinals", roundLabelZh:"1/4决赛", matchNo:3, bestOf:11, p1:"noppon-saengkham", p2:"shaun-murphy", score1:6, score2:4, scheduledAt:"2026-08-14T19:30:00+08:00", timeLabelZh:"8月14日 19:30" }),
      match({ id:"co26-qf-4", roundKey:"quarterfinals", roundLabelZh:"1/4决赛", matchNo:4, bestOf:11, p1:"zhou-yuelong", p2:"david-gilbert", score1:6, score2:5, scheduledAt:"2026-08-14T19:30:00+08:00", timeLabelZh:"8月14日 19:30", note:"第1局与第10局出现重开。" }),
    ],
  },
  {
    key: "round-2",
    labelZh: "16强",
    labelEn: "Last 16",
    bestOf: 11,
    loserPrize: 15000,
    matches: [
      match({ id:"co26-r16-1", roundKey:"round-2", roundLabelZh:"16强", matchNo:1, bestOf:11, p1:"neil-robertson", p2:"si-jiahui", score1:6, score2:2, scheduledAt:"2026-08-12T14:00:00+08:00", timeLabelZh:"8月12日 14:00" }),
      match({ id:"co26-r16-2", roundKey:"round-2", roundLabelZh:"16强", matchNo:2, bestOf:11, p1:"mark-selby", p2:"kyren-wilson", score1:6, score2:1, scheduledAt:"2026-08-12T14:00:00+08:00", timeLabelZh:"8月12日 14:00" }),
      match({ id:"co26-r16-3", roundKey:"round-2", roundLabelZh:"16强", matchNo:3, bestOf:11, p1:"stuart-bingham", p2:"hossein-vafaei", score1:6, score2:0, scheduledAt:"2026-08-12T19:30:00+08:00", timeLabelZh:"8月12日 19:30" }),
      match({ id:"co26-r16-4", roundKey:"round-2", roundLabelZh:"16强", matchNo:4, bestOf:11, p1:"zhang-anda", p2:"chris-wakelin", score1:6, score2:4, scheduledAt:"2026-08-12T19:30:00+08:00", timeLabelZh:"8月12日 19:30" }),
      match({ id:"co26-r16-5", roundKey:"round-2", roundLabelZh:"16强", matchNo:5, bestOf:11, p1:"noppon-saengkham", p2:"ronnie-osullivan", score1:6, score2:4, scheduledAt:"2026-08-13T14:00:00+08:00", timeLabelZh:"8月13日 14:00", note:"第3局重置黑球，奥沙利文获胜。" }),
      match({ id:"co26-r16-6", roundKey:"round-2", roundLabelZh:"16强", matchNo:6, bestOf:11, p1:"shaun-murphy", p2:"xiao-guodong", score1:6, score2:2, scheduledAt:"2026-08-13T14:00:00+08:00", timeLabelZh:"8月13日 14:00" }),
      match({ id:"co26-r16-7", roundKey:"round-2", roundLabelZh:"16强", matchNo:7, bestOf:11, p1:"zhou-yuelong", p2:"liu-hongyu", score1:6, score2:4, scheduledAt:"2026-08-13T19:30:00+08:00", timeLabelZh:"8月13日 19:30" }),
      match({ id:"co26-r16-8", roundKey:"round-2", roundLabelZh:"16强", matchNo:8, bestOf:11, p1:"david-gilbert", p2:"wu-yize", score1:6, score2:2, scheduledAt:"2026-08-13T19:30:00+08:00", timeLabelZh:"8月13日 19:30" }),
    ],
  },
  {
    key: "round-1",
    labelZh: "32强",
    labelEn: "Last 32",
    bestOf: 11,
    loserPrize: 10000,
    matches: [
      match({ id:"co26-r32-1", roundKey:"round-1", roundLabelZh:"32强", matchNo:1, bestOf:11, p1:"neil-robertson", p2:"chang-bingyu", score1:6, score2:3, scheduledAt:"2026-08-10T14:00:00+08:00", timeLabelZh:"8月10日 14:00" }),
      match({ id:"co26-r32-2", roundKey:"round-1", roundLabelZh:"32强", matchNo:2, bestOf:11, p1:"si-jiahui", p2:"jiang-jun", score1:6, score2:0, scheduledAt:"2026-08-10T14:00:00+08:00", timeLabelZh:"8月10日 14:00" }),
      match({ id:"co26-r32-3", roundKey:"round-1", roundLabelZh:"32强", matchNo:3, bestOf:11, p1:"mark-selby", p2:"pang-junxu", score1:6, score2:3, scheduledAt:"2026-08-10T19:30:00+08:00", timeLabelZh:"8月10日 19:30" }),
      match({ id:"co26-r32-4", roundKey:"round-1", roundLabelZh:"32强", matchNo:4, bestOf:11, p1:"kyren-wilson", p2:"aaron-hill", score1:6, score2:5, scheduledAt:"2026-08-10T19:30:00+08:00", timeLabelZh:"8月10日 19:30" }),
      match({ id:"co26-r32-5", roundKey:"round-1", roundLabelZh:"32强", matchNo:5, bestOf:11, p1:"stuart-bingham", p2:"john-higgins", score1:6, score2:4, scheduledAt:"2026-08-11T14:00:00+08:00", timeLabelZh:"8月11日 14:00" }),
      match({ id:"co26-r32-6", roundKey:"round-1", roundLabelZh:"32强", matchNo:6, bestOf:11, p1:"hossein-vafaei", p2:"mark-allen", status:"walkover", statusLabelZh:"艾伦退赛 · 瓦菲晋级", scheduledAt:"2026-08-11T14:00:00+08:00", timeLabelZh:"8月11日 14:00", note:"马克·艾伦因个人原因退赛。" }),
      match({ id:"co26-r32-7", roundKey:"round-1", roundLabelZh:"32强", matchNo:7, bestOf:11, p1:"chris-wakelin", p2:"tom-ford", score1:6, score2:4, scheduledAt:"2026-08-11T19:30:00+08:00", timeLabelZh:"8月11日 19:30" }),
      match({ id:"co26-r32-8", roundKey:"round-1", roundLabelZh:"32强", matchNo:8, bestOf:11, p1:"zhang-anda", p2:"zhao-xintong", score1:6, score2:5, scheduledAt:"2026-08-11T19:30:00+08:00", timeLabelZh:"8月11日 19:30", note:"决胜局64-64后重置黑球。" }),
      match({ id:"co26-r32-9", roundKey:"round-1", roundLabelZh:"32强", matchNo:9, bestOf:11, p1:"noppon-saengkham", p2:"judd-trump", score1:6, score2:3, scheduledAt:"2026-08-09T14:00:00+08:00", timeLabelZh:"8月9日 14:00" }),
      match({ id:"co26-r32-10", roundKey:"round-1", roundLabelZh:"32强", matchNo:10, bestOf:11, p1:"ronnie-osullivan", p2:"jackson-page", score1:6, score2:2, scheduledAt:"2026-08-09T19:30:00+08:00", timeLabelZh:"8月9日 19:30" }),
      match({ id:"co26-r32-11", roundKey:"round-1", roundLabelZh:"32强", matchNo:11, bestOf:11, p1:"xiao-guodong", p2:"anthony-mcgill", score1:6, score2:3, scheduledAt:"2026-08-09T14:00:00+08:00", timeLabelZh:"8月9日 14:00" }),
      match({ id:"co26-r32-12", roundKey:"round-1", roundLabelZh:"32强", matchNo:12, bestOf:11, p1:"shaun-murphy", p2:"matthew-selt", score1:6, score2:0, scheduledAt:"2026-08-09T19:30:00+08:00", timeLabelZh:"8月9日 19:30", note:"墨菲连续四局破百，连续得到607分。" }),
      match({ id:"co26-r32-13", roundKey:"round-1", roundLabelZh:"32强", matchNo:13, bestOf:11, p1:"zhou-yuelong", p2:"mark-williams", score1:6, score2:3, scheduledAt:"2026-08-08T14:00:00+08:00", timeLabelZh:"8月8日 14:00" }),
      match({ id:"co26-r32-14", roundKey:"round-1", roundLabelZh:"32强", matchNo:14, bestOf:11, p1:"liu-hongyu", p2:"barry-hawkins", score1:6, score2:4, scheduledAt:"2026-08-08T19:30:00+08:00", timeLabelZh:"8月8日 19:30" }),
      match({ id:"co26-r32-15", roundKey:"round-1", roundLabelZh:"32强", matchNo:15, bestOf:11, p1:"david-gilbert", p2:"ding-junhui", score1:6, score2:1, scheduledAt:"2026-08-08T14:00:00+08:00", timeLabelZh:"8月8日 14:00" }),
      match({ id:"co26-r32-16", roundKey:"round-1", roundLabelZh:"32强", matchNo:16, bestOf:11, p1:"wu-yize", p2:"yao-pengcheng", score1:6, score2:5, scheduledAt:"2026-08-08T19:30:00+08:00", timeLabelZh:"8月8日 19:30" }),
    ],
  },
  {
    key: "wild-card",
    labelZh: "外卡轮",
    labelEn: "Wild Card Round",
    bestOf: 11,
    matches: [
      match({ id:"co26-wc-1", roundKey:"wild-card", roundLabelZh:"外卡轮", matchNo:1, bestOf:11, p1:"hossein-vafaei", p2:"liu-linhao", score1:6, score2:0, scheduledAt:"2026-08-08T09:30:00+08:00", timeLabelZh:"8月8日 09:30" }),
      match({ id:"co26-wc-2", roundKey:"wild-card", roundLabelZh:"外卡轮", matchNo:2, bestOf:11, p1:"anthony-mcgill", p2:"wu-shengguang", score1:6, score2:0, scheduledAt:"2026-08-08T09:30:00+08:00", timeLabelZh:"8月8日 09:30" }),
    ],
  },
];

export const chinaOpen2026: SnookerEvent = {
  id: "event-china-open-2026",
  sourceEventId: "2755",
  slug: "china-open-2026",
  nameZh: "2026斯诺克中国公开赛",
  nameEn: "SATUO Window Cleaning Robot China Open 2026",
  sponsorName: "SATUO Window Cleaning Robot",
  season: "2026/27",
  typeZh: "排名赛",
  status: "live",
  statusLabelZh: "决赛日 · 进行中",
  startDate: "2026-08-08",
  endDate: "2026-08-16",
  cityZh: "太原",
  countryZh: "中国",
  venueZh: "太原滨河体育中心",
  venueEn: "Binhe Sports Centre",
  previousChampionZh: "尼尔·罗伯逊（2019）",
  winnerPrize: 250000,
  runnerUpPrize: 100000,
  currency: "GBP",
  refereeZh: "郑伟利",
  sourceName: "snooker.org",
  sourceUrl: "https://www.snooker.org/res/index.asp?event=2755",
  snapshotAt: "2026-08-16T20:05:00+08:00",
  rounds,
};
