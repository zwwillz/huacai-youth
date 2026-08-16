const headers = {
  "user-agent": "Mozilla/5.0 (compatible; WorldSnookerDataCenterProbe/1.4)",
  accept: "application/json,text/plain,*/*",
  "cache-control": "no-cache, no-store, max-age=0",
  pragma: "no-cache",
};
async function fetchText(url) {
  const response = await fetch(new URL(url, "https://www.wst.tv"), { headers, cache: "no-store", redirect: "follow" });
  const body = await response.text();
  console.log(`PROBE ${url} -> ${response.status} ${body.length}`);
  return { response, body };
}

const chunkUrls = [
  "/_nuxt/03a08035c747453d2f75.js", // match-centre route (chunk 41)
  "/_nuxt/e9d5da5dbe5c99d5aaa1.js", // matches route (chunk 42)
  "/_nuxt/e5796995c5cb26d76aae.js", // shared chunk 10
  "/_nuxt/a44569d4179fb53c534e.js", // shared chunk 5
  "/_nuxt/ad37ad74d4c4e881a5ca.js", // shared chunk 12
];
const keywords = ["matchesapi", "tournamentID", "tournamentId", "matchID", "matchId", "graphql", "subscription", "query ", "mutation ", "$axios", "$get", "frames", "frameScore", "homePlayerScore", "statusMeta"];
for (const url of chunkUrls) {
  const { response, body } = await fetchText(url);
  if (!response.ok) continue;
  for (const keyword of keywords) {
    let index = 0;
    let hits = 0;
    while (hits < 12 && (index = body.toLowerCase().indexOf(keyword.toLowerCase(), index)) >= 0) {
      console.log(`HIT ${url} [${keyword}] ${body.slice(Math.max(0,index-220), Math.min(body.length,index+keyword.length+420)).replace(/\s+/g," ")}`);
      index += keyword.length;
      hits++;
    }
  }
}

const tournamentId = "5b3b0c5c-991c-444b-845d-70a1edbbdf39";
const base = "https://matches.snooker.web.gc.wstservices.co.uk/v2";
const candidates = [
  `${base}?tournamentID=${tournamentId}`,
  `${base}?tournamentId=${tournamentId}`,
  `${base}?filter[tournamentID]=${tournamentId}`,
  `${base}?filter[tournamentId]=${tournamentId}`,
  `${base}?tournament=${tournamentId}`,
  `${base}?filter[tournament]=${tournamentId}`,
  `${base}/tournament/${tournamentId}`,
];
for (const url of candidates) {
  const { response, body } = await fetchText(url);
  let parsed;
  try { parsed = JSON.parse(body); } catch {}
  const rows = Array.isArray(parsed?.data) ? parsed.data : [];
  const matching = rows.filter((row) => row?.attributes?.tournamentID === tournamentId);
  console.log(`FILTER_RESULT ${url} STATUS=${response.status} ROWS=${rows.length} MATCHING=${matching.length}`);
  if (matching.length) {
    for (const row of matching.slice(-5)) console.log(`MATCH ${row.id} ${row.attributes?.name} ${row.attributes?.homePlayerScore}:${row.attributes?.awayPlayerScore} ${row.attributes?.status} ${row.attributes?.round}`);
  } else if (rows.length) {
    console.log(`FIRST_TOURNAMENT=${rows[0]?.attributes?.tournamentID} FIRST=${rows[0]?.attributes?.name}`);
  } else {
    console.log(`BODY=${body.slice(0,500).replace(/\s+/g," ")}`);
  }
}
