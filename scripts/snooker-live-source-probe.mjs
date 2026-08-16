import { readFile } from "node:fs/promises";

const headers = {
  "user-agent": "Mozilla/5.0 (compatible; WorldSnookerDataCenterProbe/2.1)",
  accept: "application/json,text/plain,*/*",
  "cache-control": "no-cache, no-store, max-age=0",
  pragma: "no-cache",
};

async function fetchJson(url) {
  const response = await fetch(url, { headers, cache: "no-store", redirect: "follow" });
  const text = await response.text();
  console.log(`GET ${url} -> ${response.status} ${response.headers.get("content-type")}`);
  if (!response.ok) throw new Error(`${url} HTTP ${response.status}: ${text.slice(0,300)}`);
  return JSON.parse(text);
}

function normalize(value) {
  return value.normalize("NFKC").replace(/[’‘']/g, "").toLowerCase().replace(/\s+/g, " ").trim();
}
function pairKey(a, b) {
  return [normalize(a), normalize(b)].sort().join("|");
}

const [playersSource, eventSource] = await Promise.all([
  readFile("lib/snooker/data/players.ts", "utf8"),
  readFile("lib/snooker/data/china-open-2026.ts", "utf8"),
]);
const slugToName = new Map();
for (const m of playersSource.matchAll(/\{\s*id:\s*"[^"]+",\s*slug:\s*"([^"]+)",\s*nameEn:\s*"([^"]+)"/g)) {
  slugToName.set(m[1], m[2]);
}
const curatedPairs = new Map();
for (const m of eventSource.matchAll(/match\(\{[\s\S]*?p1:\s*"([^"]+)"[\s\S]*?p2:\s*"([^"]+)"[\s\S]*?\}\),/g)) {
  const a = slugToName.get(m[1]);
  const b = slugToName.get(m[2]);
  if (a && b) curatedPairs.set(pairKey(a, b), `${a} vs ${b}`);
}
console.log(`CURATED_PAIRS=${curatedPairs.size}`);

const tournamentId = "5b3b0c5c-991c-444b-845d-70a1edbbdf39";
const tournamentUrl = `https://tournaments.snooker.web.gc.wstservices.co.uk/v2/${tournamentId}`;
const tournament = await fetchJson(tournamentUrl);
const attrs = tournament?.data?.attributes ?? tournament?.attributes ?? {};
let matches = [];
if (Array.isArray(attrs.matches)) matches = attrs.matches;
else if (Array.isArray(tournament?.included)) matches = tournament.included.filter((row) => row?.type === "match");
console.log(`TOURNAMENT=${attrs.name ?? "?"}`);
console.log(`TOURNAMENT_MATCHES=${matches.length}`);

let mapped = 0;
const unmatched = [];
for (const row of matches) {
  const a = row?.attributes ?? row;
  const [home = "", away = ""] = String(a?.name ?? "").split(/\s+vs\s+/i).map((v) => v.trim());
  const key = pairKey(home, away);
  if (curatedPairs.has(key)) mapped += 1;
  else unmatched.push(`${a?.name} | ${a?.round} | ${a?.homePlayerScore}:${a?.awayPlayerScore}`);
}
console.log(`PAIR_MAPPED=${mapped}`);
console.log(`PAIR_UNMATCHED=${JSON.stringify(unmatched)}`);

for (const row of matches) {
  const a = row?.attributes ?? row;
  if (/final/i.test(a?.round ?? "") || /Selby|Saengkham/i.test(a?.name ?? "")) {
    console.log(`CANDIDATE ${row?.id ?? a?.matchID ?? "?"} | ${a?.name} | ${a?.homePlayerScore}:${a?.awayPlayerScore} | ${a?.status} | ${a?.statusMeta} | ${a?.round} | ${a?.startDateTime}`);
  }
}

const finalRow = matches.find((row) => {
  const a = row?.attributes ?? row;
  return /^final$/i.test(a?.round ?? "") && /Selby/i.test(a?.name ?? "") && /Saengkham/i.test(a?.name ?? "");
}) ?? matches.find((row) => /Selby/i.test((row?.attributes ?? row)?.name ?? "") && /Saengkham/i.test((row?.attributes ?? row)?.name ?? ""));

if (!finalRow) throw new Error("China Open final not found in WST tournament detail");
const finalAttrs = finalRow.attributes ?? finalRow;
const matchId = finalRow.id ?? finalAttrs.matchID;
console.log(`FINAL_MATCH_ID=${matchId}`);
console.log(`FINAL_REST=${finalAttrs.homePlayerScore}:${finalAttrs.awayPlayerScore} STATUS=${finalAttrs.status} META=${finalAttrs.statusMeta}`);

const matchDetail = await fetchJson(`https://matches.snooker.web.gc.wstservices.co.uk/v2/${matchId}`);
const matchAttrs = matchDetail?.data?.attributes ?? matchDetail?.attributes ?? {};
console.log(`MATCH_DETAIL=${matchAttrs.name} ${matchAttrs.homePlayerScore}:${matchAttrs.awayPlayerScore} STATUS=${matchAttrs.status} META=${matchAttrs.statusMeta}`);

const query = `query ($matchId: ID!) {
  matchStatus(matchId: $matchId) {
    homePlayerFrames
    awayPlayerFrames
    status
    statusMeta
    currentBreak
    matchHistory {
      frames {
        frameNumber
        homePlayerPoints
        awayPlayerPoints
        homePlayerFiftyPlusBreaks
        awayPlayerFiftyPlusBreaks
      }
    }
  }
}`;

const graphResponse = await fetch("https://snooker.graph.gc.wstservices.co.uk/graphql", {
  method: "POST",
  headers: {
    ...headers,
    accept: "application/json",
    "content-type": "application/json",
    "x-apollo-operation-name": "ChinaOpenLiveProbe",
  },
  cache: "no-store",
  body: JSON.stringify({ query, variables: { matchId } }),
});
const graphText = await graphResponse.text();
console.log(`GRAPHQL -> ${graphResponse.status} ${graphResponse.headers.get("content-type")}`);
if (!graphResponse.ok) throw new Error(`GraphQL HTTP ${graphResponse.status}`);
const graph = JSON.parse(graphText);
if (graph.errors?.length) throw new Error(`GraphQL errors: ${JSON.stringify(graph.errors)}`);
const status = graph?.data?.matchStatus;
if (!status) throw new Error("GraphQL returned no matchStatus");
console.log(`VERIFIED_LIVE=${status.homePlayerFrames}:${status.awayPlayerFrames} STATUS=${status.status} META=${status.statusMeta} FRAMES=${status.matchHistory?.frames?.length ?? 0}`);
