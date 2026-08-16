import type { SnookerPlayer, SnookerPlayerAvatar, SnookerRankingRow } from "../domain";

function commons(file: string, credit: string, license: string, sourcePage: string): SnookerPlayerAvatar {
  return {
    url: `https://commons.wikimedia.org/wiki/Special:Redirect/file/${file}`,
    source: "wikimedia-commons",
    credit,
    license,
    sourcePage,
  };
}

const zhaoAvatar = commons(
  "Zhao_Xintong_at_the_World_Snooker_Green_Carpet_Ceremony_2026.jpg",
  "Daniel King",
  "CC BY-SA 4.0",
  "https://commons.wikimedia.org/wiki/File:Zhao_Xintong_at_the_World_Snooker_Green_Carpet_Ceremony_2026.jpg",
);
const wuAvatar = commons(
  "Wu_Yize_2024.jpg",
  "BennyOnTheLoose",
  "CC0 1.0",
  "https://commons.wikimedia.org/wiki/File:Wu_Yize_2024.jpg",
);
const nopponAvatar = commons(
  "Noppon_Saengkham_2025.jpg",
  "Andrej146",
  "CC0 1.0",
  "https://commons.wikimedia.org/wiki/File:Noppon_Saengkham_2025.jpg",
);
const selbyAvatar = commons(
  "Mark_Selby.JPG",
  "Tmv23",
  "CC BY-SA 3.0",
  "https://commons.wikimedia.org/wiki/File:Mark_Selby.JPG",
);
const dingAvatar = commons(
  "Ding_Jun-hui.jpg",
  "Jim Knowles",
  "Public domain",
  "https://commons.wikimedia.org/wiki/File:Ding_Jun-hui.jpg",
);

const players: SnookerPlayer[] = [
  { id: "p-judd-trump", slug: "judd-trump", nameEn: "Judd Trump", nameZh: "贾德·特鲁姆普", shortNameZh: "特鲁姆普", nationalityZh: "英格兰", countryCode: "ENG", currentRank: 1, rankingPoints: 1655550, dateOfBirth: "1989-08-20", profileSource: "curated" },
  { id: "p-neil-robertson", slug: "neil-robertson", nameEn: "Neil Robertson", nameZh: "尼尔·罗伯逊", shortNameZh: "罗伯逊", nationalityZh: "澳大利亚", countryCode: "AUS", currentRank: 2, rankingPoints: 1206550, profileSource: "curated" },
  { id: "p-zhao-xintong", slug: "zhao-xintong", nameEn: "Zhao Xintong", nameZh: "赵心童", shortNameZh: "赵心童", nationalityZh: "中国", countryCode: "CHN", currentRank: 3, rankingPoints: 1178550, dateOfBirth: "1997-04-03", wstId: "895d376f-9f42-4e67-8a63-bc78676d0726", avatar: zhaoAvatar, profileSource: "WST" },
  { id: "p-wu-yize", slug: "wu-yize", nameEn: "Wu Yize", nameZh: "吴宜泽", shortNameZh: "吴宜泽", nationalityZh: "中国", countryCode: "CHN", currentRank: 4, rankingPoints: 1114900, dateOfBirth: "2003-10-14", wstId: "d935d534-e696-4292-b773-e9b8efee1ea7", avatar: wuAvatar, profileSource: "WST" },
  { id: "p-john-higgins", slug: "john-higgins", nameEn: "John Higgins", nameZh: "约翰·希金斯", shortNameZh: "希金斯", nationalityZh: "苏格兰", countryCode: "SCO", currentRank: 5, rankingPoints: 967350, wstId: "a5eecca1-8302-4739-84fc-6721627baa43", profileSource: "WST" },
  { id: "p-shaun-murphy", slug: "shaun-murphy", nameEn: "Shaun Murphy", nameZh: "肖恩·墨菲", shortNameZh: "墨菲", nationalityZh: "英格兰", countryCode: "ENG", currentRank: 6, rankingPoints: 951800, profileSource: "curated" },
  { id: "p-kyren-wilson", slug: "kyren-wilson", nameEn: "Kyren Wilson", nameZh: "凯伦·威尔逊", shortNameZh: "威尔逊", nationalityZh: "英格兰", countryCode: "ENG", currentRank: 7, rankingPoints: 895100, profileSource: "curated" },
  { id: "p-mark-williams", slug: "mark-williams", nameEn: "Mark Williams", nameZh: "马克·威廉姆斯", shortNameZh: "威廉姆斯", nationalityZh: "威尔士", countryCode: "WAL", currentRank: 8, rankingPoints: 894400, aliases: ["Mark J Williams"], wstId: "6aaddcbb-345c-474a-9069-e7757e155729", profileSource: "WST" },
  { id: "p-mark-selby", slug: "mark-selby", nameEn: "Mark Selby", nameZh: "马克·塞尔比", shortNameZh: "塞尔比", nationalityZh: "英格兰", countryCode: "ENG", currentRank: 9, rankingPoints: 849350, dateOfBirth: "1983-06-19", wstId: "ba7831b4-ab75-4435-946a-c6f02e4e2d4b", avatar: selbyAvatar, profileSource: "WST" },
  { id: "p-barry-hawkins", slug: "barry-hawkins", nameEn: "Barry Hawkins", nameZh: "巴里·霍金斯", shortNameZh: "霍金斯", nationalityZh: "英格兰", countryCode: "ENG", currentRank: 10, rankingPoints: 685350, profileSource: "curated" },
  { id: "p-xiao-guodong", slug: "xiao-guodong", nameEn: "Xiao Guodong", nameZh: "肖国栋", shortNameZh: "肖国栋", nationalityZh: "中国", countryCode: "CHN", currentRank: 11, rankingPoints: 658900, profileSource: "curated" },
  { id: "p-mark-allen", slug: "mark-allen", nameEn: "Mark Allen", nameZh: "马克·艾伦", shortNameZh: "艾伦", nationalityZh: "北爱尔兰", countryCode: "NIR", currentRank: 12, rankingPoints: 587750, profileSource: "curated" },
  { id: "p-chris-wakelin", slug: "chris-wakelin", nameEn: "Chris Wakelin", nameZh: "克里斯·韦克林", shortNameZh: "韦克林", nationalityZh: "英格兰", countryCode: "ENG", currentRank: 13, rankingPoints: 585200, profileSource: "curated" },
  { id: "p-ronnie-osullivan", slug: "ronnie-osullivan", nameEn: "Ronnie O'Sullivan", nameZh: "罗尼·奥沙利文", shortNameZh: "奥沙利文", nationalityZh: "英格兰", countryCode: "ENG", currentRank: 14, rankingPoints: 550250, profileSource: "curated" },
  { id: "p-ding-junhui", slug: "ding-junhui", nameEn: "Ding Junhui", nameZh: "丁俊晖", shortNameZh: "丁俊晖", nationalityZh: "中国", countryCode: "CHN", currentRank: 15, rankingPoints: 464850, dateOfBirth: "1987-04-01", avatar: dingAvatar, profileSource: "curated" },
  { id: "p-si-jiahui", slug: "si-jiahui", nameEn: "Si Jiahui", nameZh: "斯佳辉", shortNameZh: "斯佳辉", nationalityZh: "中国", countryCode: "CHN", currentRank: 16, rankingPoints: 437400, profileSource: "curated" },
  { id: "p-zhang-anda", slug: "zhang-anda", nameEn: "Zhang Anda", nameZh: "张安达", shortNameZh: "张安达", nationalityZh: "中国", countryCode: "CHN", currentRank: 19, rankingPoints: 358950, profileSource: "curated" },
  { id: "p-stuart-bingham", slug: "stuart-bingham", nameEn: "Stuart Bingham", nameZh: "斯图尔特·宾汉姆", shortNameZh: "宾汉姆", nationalityZh: "英格兰", countryCode: "ENG", currentRank: 21, rankingPoints: 337700, profileSource: "curated" },
  { id: "p-zhou-yuelong", slug: "zhou-yuelong", nameEn: "Zhou Yuelong", nameZh: "周跃龙", shortNameZh: "周跃龙", nationalityZh: "中国", countryCode: "CHN", currentRank: 22, rankingPoints: 315250, profileSource: "curated" },
  { id: "p-pang-junxu", slug: "pang-junxu", nameEn: "Pang Junxu", nameZh: "庞俊旭", shortNameZh: "庞俊旭", nationalityZh: "中国", countryCode: "CHN", currentRank: 26, rankingPoints: 283900, profileSource: "curated" },
  { id: "p-hossein-vafaei", slug: "hossein-vafaei", nameEn: "Hossein Vafaei", nameZh: "侯赛因·瓦菲", shortNameZh: "瓦菲", nationalityZh: "伊朗", countryCode: "IRN", currentRank: 27, rankingPoints: 252600, profileSource: "curated" },
  { id: "p-david-gilbert", slug: "david-gilbert", nameEn: "David Gilbert", nameZh: "大卫·吉尔伯特", shortNameZh: "吉尔伯特", nationalityZh: "英格兰", countryCode: "ENG", currentRank: 32, rankingPoints: 230700, profileSource: "curated" },
  { id: "p-tom-ford", slug: "tom-ford", nameEn: "Tom Ford", nameZh: "汤姆·福德", shortNameZh: "福德", nationalityZh: "英格兰", countryCode: "ENG", currentRank: 35, rankingPoints: 187050, profileSource: "curated" },
  { id: "p-anthony-mcgill", slug: "anthony-mcgill", nameEn: "Anthony McGill", nameZh: "安东尼·麦克吉尔", shortNameZh: "麦克吉尔", nationalityZh: "苏格兰", countryCode: "SCO", currentRank: 38, rankingPoints: 174850, profileSource: "curated" },
  { id: "p-jackson-page", slug: "jackson-page", nameEn: "Jackson Page", nameZh: "杰克逊·佩奇", shortNameZh: "佩奇", nationalityZh: "威尔士", countryCode: "WAL", currentRank: 39, rankingPoints: 174250, profileSource: "curated" },
  { id: "p-aaron-hill", slug: "aaron-hill", nameEn: "Aaron Hill", nameZh: "亚伦·希尔", shortNameZh: "希尔", nationalityZh: "爱尔兰", countryCode: "IRL", currentRank: 41, rankingPoints: 170950, profileSource: "curated" },
  { id: "p-matthew-selt", slug: "matthew-selt", nameEn: "Matthew Selt", nameZh: "马修·塞尔特", shortNameZh: "塞尔特", nationalityZh: "英格兰", countryCode: "ENG", currentRank: 44, rankingPoints: 167000, profileSource: "curated" },
  { id: "p-noppon-saengkham", slug: "noppon-saengkham", nameEn: "Noppon Saengkham", nameZh: "诺鹏·桑坎姆", shortNameZh: "桑坎姆", nationalityZh: "泰国", countryCode: "THA", currentRank: 45, rankingPoints: 162350, dateOfBirth: "1992-07-15", avatar: nopponAvatar, profileSource: "curated" },
  { id: "p-chang-bingyu", slug: "chang-bingyu", nameEn: "Chang Bingyu", nameZh: "常冰玉", shortNameZh: "常冰玉", nationalityZh: "中国", countryCode: "CHN", currentRank: 47, rankingPoints: 149100, profileSource: "curated" },
  { id: "p-liu-hongyu", slug: "liu-hongyu", nameEn: "Liu Hongyu", nameZh: "刘宏宇", shortNameZh: "刘宏宇", nationalityZh: "中国", countryCode: "CHN", currentRank: 56, rankingPoints: 119700, profileSource: "curated" },
  { id: "p-jiang-jun", slug: "jiang-jun", nameEn: "Jiang Jun", nameZh: "江俊", shortNameZh: "江俊", nationalityZh: "中国", countryCode: "CHN", currentRank: 65, rankingPoints: 74350, profileSource: "curated" },
  { id: "p-yao-pengcheng", slug: "yao-pengcheng", nameEn: "Yao Pengcheng", nameZh: "姚朋成", shortNameZh: "姚朋成", nationalityZh: "中国", countryCode: "CHN", currentRank: 79, rankingPoints: 30850, wstId: "3481ae79-48df-4da2-ae40-575f21b0bc12", profileSource: "WST" },
  { id: "p-liu-linhao", slug: "liu-linhao", nameEn: "Liu Linhao", nameZh: "刘林昊", shortNameZh: "刘林昊", nationalityZh: "中国", countryCode: "CHN", currentRank: null, rankingPoints: null, profileSource: "curated" },
  { id: "p-wu-shengguang", slug: "wu-shengguang", nameEn: "Wu Shengguang", nameZh: "吴盛光", shortNameZh: "吴盛光", nationalityZh: "中国", countryCode: "CHN", currentRank: null, rankingPoints: null, profileSource: "curated" },
];

export const snookerPlayers = players;
export const playerById = new Map(players.map((player) => [player.id, player]));

function normalized(value: string) {
  return value.normalize("NFKC").replace(/[’‘]/g, "'").replace(/\s+/g, " ").trim().toLowerCase();
}

const playerByEnglishName = new Map<string, SnookerPlayer>();
for (const player of players) {
  playerByEnglishName.set(normalized(player.nameEn), player);
  for (const alias of player.aliases ?? []) playerByEnglishName.set(normalized(alias), player);
}

export function findPlayerByEnglishName(name: string) {
  return playerByEnglishName.get(normalized(name)) ?? null;
}

export const top16Rankings: SnookerRankingRow[] = players
  .filter((player) => player.currentRank !== null && player.currentRank <= 16 && player.rankingPoints !== null)
  .map((player) => ({ rank: player.currentRank!, playerId: player.id, points: player.rankingPoints! }))
  .sort((a, b) => a.rank - b.rank);
