export type SnookerPlayerMaster = {
  nameEn: string;
  nameZh: string;
  nationalityZh?: string;
  aliases?: string[];
  wstId?: string;
};

const players: SnookerPlayerMaster[] = [
  { nameEn: "Judd Trump", nameZh: "贾德·特鲁姆普", nationalityZh: "英格兰" },
  { nameEn: "Neil Robertson", nameZh: "尼尔·罗伯逊", nationalityZh: "澳大利亚" },
  { nameEn: "Zhao Xintong", nameZh: "赵心童", nationalityZh: "中国", wstId: "895d376f-9f42-4e67-8a63-bc78676d0726" },
  { nameEn: "Wu Yize", nameZh: "吴宜泽", nationalityZh: "中国", wstId: "d935d534-e696-4292-b773-e9b8efee1ea7" },
  { nameEn: "John Higgins", nameZh: "约翰·希金斯", nationalityZh: "苏格兰", wstId: "a5eecca1-8302-4739-84fc-6721627baa43" },
  { nameEn: "Shaun Murphy", nameZh: "肖恩·墨菲", nationalityZh: "英格兰" },
  { nameEn: "Kyren Wilson", nameZh: "凯伦·威尔逊", nationalityZh: "英格兰" },
  { nameEn: "Mark Williams", nameZh: "马克·威廉姆斯", nationalityZh: "威尔士", aliases: ["Mark J Williams"], wstId: "6aaddcbb-345c-474a-9069-e7757e155729" },
  { nameEn: "Mark Selby", nameZh: "马克·塞尔比", nationalityZh: "英格兰", wstId: "ba7831b4-ab75-4435-946a-c6f02e4e2d4b" },
  { nameEn: "Barry Hawkins", nameZh: "巴里·霍金斯", nationalityZh: "英格兰" },
  { nameEn: "Xiao Guodong", nameZh: "肖国栋", nationalityZh: "中国" },
  { nameEn: "Mark Allen", nameZh: "马克·艾伦", nationalityZh: "北爱尔兰" },
  { nameEn: "Chris Wakelin", nameZh: "克里斯·韦克林", nationalityZh: "英格兰" },
  { nameEn: "Ronnie O'Sullivan", nameZh: "罗尼·奥沙利文", nationalityZh: "英格兰" },
  { nameEn: "Ding Junhui", nameZh: "丁俊晖", nationalityZh: "中国" },
  { nameEn: "Si Jiahui", nameZh: "斯佳辉", nationalityZh: "中国" },
  { nameEn: "Chang Bingyu", nameZh: "常冰玉", nationalityZh: "中国" },
  { nameEn: "Jiang Jun", nameZh: "江俊", nationalityZh: "中国" },
  { nameEn: "Pang Junxu", nameZh: "庞俊旭", nationalityZh: "中国" },
  { nameEn: "Aaron Hill", nameZh: "亚伦·希尔", nationalityZh: "爱尔兰" },
  { nameEn: "Stuart Bingham", nameZh: "斯图尔特·宾汉姆", nationalityZh: "英格兰" },
  { nameEn: "Hossein Vafaei", nameZh: "侯赛因·瓦菲", nationalityZh: "伊朗" },
  { nameEn: "Tom Ford", nameZh: "汤姆·福德", nationalityZh: "英格兰" },
  { nameEn: "Noppon Saengkham", nameZh: "诺鹏·桑坎姆", nationalityZh: "泰国" },
  { nameEn: "Jackson Page", nameZh: "杰克逊·佩奇", nationalityZh: "威尔士" },
  { nameEn: "Anthony McGill", nameZh: "安东尼·麦克吉尔", nationalityZh: "苏格兰" },
  { nameEn: "Matthew Selt", nameZh: "马修·塞尔特", nationalityZh: "英格兰" },
  { nameEn: "Zhou Yuelong", nameZh: "周跃龙", nationalityZh: "中国" },
  { nameEn: "Liu Hongyu", nameZh: "刘宏宇", nationalityZh: "中国" },
  { nameEn: "David Gilbert", nameZh: "大卫·吉尔伯特", nationalityZh: "英格兰" },
  { nameEn: "Yao Pengcheng", nameZh: "姚朋成", nationalityZh: "中国", wstId: "3481ae79-48df-4da2-ae40-575f21b0bc12" },
  { nameEn: "Liu Linhao", nameZh: "刘林昊", nationalityZh: "中国" },
  { nameEn: "Wu Shengguang", nameZh: "吴盛光", nationalityZh: "中国" },
  { nameEn: "Lei Peifan", nameZh: "雷佩凡", nationalityZh: "中国", wstId: "9e0b1245-cc2c-4dab-ad27-46db80701684" },
  { nameEn: "Zhang Anda", nameZh: "张安达", nationalityZh: "中国" },
];

function normalizePlayerName(value: string) {
  return value
    .normalize("NFKC")
    .replace(/[’‘]/g, "'")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

const byName = new Map<string, SnookerPlayerMaster>();
for (const player of players) {
  byName.set(normalizePlayerName(player.nameEn), player);
  for (const alias of player.aliases ?? []) byName.set(normalizePlayerName(alias), player);
}

export function getPlayerMaster(nameEn: string) {
  return byName.get(normalizePlayerName(nameEn)) ?? null;
}

export function getChinesePlayerName(nameEn: string) {
  return getPlayerMaster(nameEn)?.nameZh ?? nameEn;
}

export function getCanonicalEnglishName(nameEn: string) {
  return getPlayerMaster(nameEn)?.nameEn ?? nameEn.trim().replace(/\s+/g, " ");
}

export const playerMaster = players;
