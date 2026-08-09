import { getDb } from "./index";
import { eventDetails, eventPhases } from "./schema";

const DEFAULT_PHASES = [
  { code: "qualifier-one", phaseNumber: "01", title: "资格赛第一场", sortOrder: 1 },
  { code: "qualifier-two", phaseNumber: "02", title: "资格赛第二场", sortOrder: 2 },
  { code: "main-one", phaseNumber: "03", title: "正赛第一阶段", sortOrder: 3 },
  { code: "main-two", phaseNumber: "04", title: "正赛第二阶段", sortOrder: 4 },
] as const;

const DEFAULT_FORMAT = [
  ["资格赛第一轮", "单败淘汰；每个组别晋级24人", "9局5胜", "13局7胜"],
  ["资格赛第二轮", "单败淘汰；每个组别晋级24人", "9局5胜", "13局7胜"],
  ["正赛第一轮", "64人分8组双败；每组8人、晋级4人", "13局7胜", "17局9胜"],
  ["正赛第二轮", "32强单败淘汰至冠军", "17局9胜", "21局11胜"],
];

const DEFAULT_RULE_STANDARD = "执行中国台球协会2026版《华彩十六球比赛规则和竞赛规定（试行）》，全程采用三角框摆球。";
const DEFAULT_DRAW_RULES = [
  "资格赛不设种子，全部混抽入位。",
  "各组别正赛第一阶段将直接参加正赛的16名运动员按照蛇形排位抽入种子位，其他运动员混抽入位。",
  "各组别正赛第二阶段将第一阶段胜部晋级的16名运动员抽入种子位，败部晋级的运动员混抽入位。",
  "正赛阶段抽签全部由裁判员统一代抽，抽签过程全程直播。",
];
const DEFAULT_PRIZE_NOTE = "以上均为税前奖金，由承办单位按国家有关规定代扣代缴个人所得税；领取奖金需提供有效身份证明；各组前三名须穿着比赛服出席闭幕式颁奖；正赛阶段需打满一场方可领取相应名次奖金。";

const DEFAULT_PRIZES = {
  少年组: [
    ["冠军", "¥50,000", "奖杯、证书、球杆"],
    ["亚军", "¥30,000", "奖杯、证书、球杆"],
    ["季军", "¥15,000", "奖杯、证书、球杆"],
    ["殿军", "¥10,000", "证书、球杆"],
    ["8强", "¥3,500/人", "证书"],
    ["16强", "¥2,000/人", ""],
    ["32强", "¥1,000/人", ""],
    ["64强", "¥600/人", ""],
  ],
  青年组: [
    ["冠军", "¥60,000", "奖杯、证书、球杆"],
    ["亚军", "¥30,000", "奖杯、证书、球杆"],
    ["季军", "¥15,000", "奖杯、证书、球杆"],
    ["殿军", "¥10,000", "证书、球杆"],
    ["8强", "¥3,500/人", "证书"],
    ["16强", "¥2,000/人", ""],
    ["32强", "¥1,000/人", ""],
    ["64强", "¥600/人", ""],
  ],
};

export async function ensureNewEventDefaults(eventId: string) {
  const db = getDb();
  const timestamp = new Date().toISOString();
  await db.insert(eventDetails).values({
    eventId,
    sponsorLabel: null,
    durationLabel: null,
    qualifierDateLabel: null,
    mainDateLabel: null,
    totalPrizeLabel: null,
    mainSizeLabel: null,
    minimumAgeNote: "最低6周岁；未满14周岁须由成年人陪同，14至18周岁单独参赛须提供家长责任书。",
    signupNote: "本赛事单站参赛费为100元人民币；一次报名可参加两场资格赛。参赛运动员交通、食宿等费用自理，具体报名时间和入口以组委会发布信息为准。",
    ageRules: { 少年组: "", 青年组: "" },
    competitionFormat: DEFAULT_FORMAT,
    ruleStandard: DEFAULT_RULE_STANDARD,
    drawRules: DEFAULT_DRAW_RULES,
    prizeNote: DEFAULT_PRIZE_NOTE,
    prizes: DEFAULT_PRIZES,
    createdAt: timestamp,
    updatedAt: timestamp,
  }).onConflictDoNothing();

  await db.insert(eventPhases).values(DEFAULT_PHASES.map((phase) => ({
    id: `phase_${eventId}_${phase.code}`,
    eventId,
    code: phase.code,
    phaseNumber: phase.phaseNumber,
    title: phase.title,
    dateLabel: null,
    status: "pending",
    sortOrder: phase.sortOrder,
    createdAt: timestamp,
    updatedAt: timestamp,
  }))).onConflictDoNothing();
}
