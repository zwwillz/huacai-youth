import fs from "node:fs";

const [inputPath, outputPath] = process.argv.slice(2);
if (!inputPath || !outputPath) process.exit(1);

const lines = fs.readFileSync(inputPath, "utf8").split(/\r?\n/);
const matches = [];
let group = "", date = "", time = "", round = "", progress = "", race = "";
const tidy = (value) => value.replace(/\s+/g, " ").replace(/抢\s+位/g, "抢位").trim();

for (const raw of lines) {
  const line = tidy(raw.replace(/\f/g, ""));
  const meta = line.match(/组别\s+(少年组|青年组)\s+日期\s+(\d{4}\/\d{1,2}\/\d{1,2})\s+时间\s+(\d{2}:\d{2})/);
  if (meta) { [, group, date, time] = meta; continue; }
  const phase = line.match(/轮次\s+(.+?)\s+赛程\s+(.+?)\s+赛制\s+(.+?)$/);
  if (phase) { [, round, progress, race] = phase.map(tidy); continue; }
  const row = line.match(/^(\d+)\s+(.+?)\s+VS\s+(.+?)\s+(TV\d+|[一二三四五六七八九十]+楼\d+号)$/);
  if (!row || !group || !date || !time) continue;
  const [, order, a, b, table] = row;
  const playerA = tidy(a), playerB = tidy(b);
  if (!playerA || !playerB) continue;
  matches.push({ id: `${group}-${date.replaceAll("/", "-")}-${time}-${order}`, group, date: date.replaceAll("/", "-"), time, round, progress, race, order: Number(order), playerA, playerB, table, isTv: table.startsWith("TV"), status: "赛程已公布" });
}

const players = [...new Set(matches.flatMap((m) => [m.playerA, m.playerB]))].filter((n) => n !== "抢位").sort((a,b) => a.localeCompare(b,"zh-CN"));
fs.mkdirSync(new URL("../app/data/", import.meta.url), { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify({ matches, players }, null, 2)}\n`);
console.log(JSON.stringify({ matches: matches.length, players: players.length }));
