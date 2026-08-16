export type SnookerView = "home" | "matches" | "players" | "data";

export type RankingRow = {
  rank: number;
  nameEn: string;
  nameZh: string;
  nationality: string;
  points: number;
  isChinese?: boolean;
};

export type MatchRow = {
  round: string;
  player1En: string;
  player1Zh: string;
  score1: number;
  player2En: string;
  player2Zh: string;
  score2: number;
};

export const sourceSnapshot = {
  source: "snooker.org",
  eventId: "2755",
  capturedAt: "2026-08-16T17:39:00+08:00",
  note: "POC fallback snapshot; the live card attempts a server-side refresh every 30 seconds.",
};

export const currentEvent = {
  id: "china-open-2026",
  nameZh: "2026 斯诺克中国公开赛",
  nameEn: "2026 China Open",
  dates: "8月8日—8月16日",
  city: "太原",
  country: "中国",
  venue: "Sports Centre",
  type: "排名赛",
  status: "进行中",
  winnerPrize: 250000,
  runnerUpPrize: 100000,
};

export const nextEvent = {
  id: "wuhan-open-2026",
  nameZh: "2026 斯诺克武汉公开赛",
  nameEn: "2026 Wuhan Open",
  dates: "8月23日—8月29日",
  city: "武汉",
  country: "中国",
  type: "排名赛",
  winnerPrize: 175000,
};

export const liveFallback = {
  eventZh: currentEvent.nameZh,
  round: "决赛 · 19局10胜",
  status: "第一阶段结束",
  sessionLabel: "第二阶段 19:30",
  player1En: "Mark Selby",
  player1Zh: "马克·塞尔比",
  player1Rank: 9,
  player1Score: 3,
  player2En: "Noppon Saengkham",
  player2Zh: "诺鹏·桑坎姆",
  player2Rank: 46,
  player2Score: 4,
  frames: ["8–67", "89–38", "138–0 (138)", "0–73", "0–80 (80)", "5–75 (51)", "70–68"],
};

export const rankings: RankingRow[] = [
  { rank: 1, nameEn: "Judd Trump", nameZh: "贾德·特鲁姆普", nationality: "英格兰", points: 1655550 },
  { rank: 2, nameEn: "Neil Robertson", nameZh: "尼尔·罗伯逊", nationality: "澳大利亚", points: 1206550 },
  { rank: 3, nameEn: "Zhao Xintong", nameZh: "赵心童", nationality: "中国", points: 1178550, isChinese: true },
  { rank: 4, nameEn: "Wu Yize", nameZh: "吴宜泽", nationality: "中国", points: 1114900, isChinese: true },
  { rank: 5, nameEn: "John Higgins", nameZh: "约翰·希金斯", nationality: "苏格兰", points: 967350 },
  { rank: 6, nameEn: "Shaun Murphy", nameZh: "肖恩·墨菲", nationality: "英格兰", points: 951800 },
  { rank: 7, nameEn: "Kyren Wilson", nameZh: "凯伦·威尔逊", nationality: "英格兰", points: 895100 },
  { rank: 8, nameEn: "Mark J Williams", nameZh: "马克·威廉姆斯", nationality: "威尔士", points: 894400 },
  { rank: 9, nameEn: "Mark Selby", nameZh: "马克·塞尔比", nationality: "英格兰", points: 849350 },
  { rank: 10, nameEn: "Barry Hawkins", nameZh: "巴里·霍金斯", nationality: "英格兰", points: 685350 },
  { rank: 11, nameEn: "Xiao Guodong", nameZh: "肖国栋", nationality: "中国", points: 658900, isChinese: true },
  { rank: 12, nameEn: "Mark Allen", nameZh: "马克·艾伦", nationality: "北爱尔兰", points: 587750 },
  { rank: 13, nameEn: "Chris Wakelin", nameZh: "克里斯·韦克林", nationality: "英格兰", points: 585200 },
  { rank: 14, nameEn: "Ronnie O'Sullivan", nameZh: "罗尼·奥沙利文", nationality: "英格兰", points: 550250 },
  { rank: 15, nameEn: "Ding Junhui", nameZh: "丁俊晖", nationality: "中国", points: 464850, isChinese: true },
  { rank: 16, nameEn: "Si Jiahui", nameZh: "斯佳辉", nationality: "中国", points: 437400, isChinese: true },
];

export const recentMatches: MatchRow[] = [
  { round: "半决赛", player1En: "Mark Selby", player1Zh: "马克·塞尔比", score1: 6, player2En: "Stuart Bingham", player2Zh: "斯图尔特·宾汉姆", score2: 2 },
  { round: "半决赛", player1En: "Noppon Saengkham", player1Zh: "诺鹏·桑坎姆", score1: 6, player2En: "Zhou Yuelong", player2Zh: "周跃龙", score2: 5 },
  { round: "1/4决赛", player1En: "Mark Selby", player1Zh: "马克·塞尔比", score1: 6, player2En: "Neil Robertson", player2Zh: "尼尔·罗伯逊", score2: 1 },
  { round: "1/4决赛", player1En: "Stuart Bingham", player1Zh: "斯图尔特·宾汉姆", score1: 6, player2En: "Zhang Anda", player2Zh: "张安达", score2: 3 },
  { round: "1/4决赛", player1En: "Noppon Saengkham", player1Zh: "诺鹏·桑坎姆", score1: 6, player2En: "Shaun Murphy", player2Zh: "肖恩·墨菲", score2: 4 },
  { round: "1/4决赛", player1En: "Zhou Yuelong", player1Zh: "周跃龙", score1: 6, player2En: "David Gilbert", player2Zh: "大卫·吉尔伯特", score2: 5 },
];

export const chinesePlayers = rankings.filter((player) => player.isChinese);
