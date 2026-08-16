const headers = {
  "user-agent": "Mozilla/5.0 (compatible; WorldSnookerDataCenterProbe/1.2)",
  accept: "*/*",
  "cache-control": "no-cache, no-store, max-age=0",
  pragma: "no-cache",
};

async function fetchText(url, cacheBust = true) {
  const target = new URL(url, "https://www.wst.tv");
  if (cacheBust) target.searchParams.set("_ts", `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`);
  const response = await fetch(target, { headers, cache: "no-store", redirect: "follow" });
  const body = await response.text();
  console.log(`PROBE ${target.origin}${target.pathname} -> ${response.status} ${body.length} bytes ${response.url}`);
  return { response, body };
}

const snooker = await fetchText("https://www.snooker.org/res/index.asp?template=21");
const snookerText = snooker.body.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
console.log(`SNOOKER_ORG_BLOCKED=${/Foul and a Miss/i.test(snookerText)}`);

const eventUrl = "https://www.wst.tv/matches/5b3b0c5c-991c-444b-845d-70a1edbbdf39";
const wst = await fetchText(eventUrl);
const scriptSrcs = [...wst.body.matchAll(/<script[^>]+src=["']([^"']+)["']/gi)].map((m) => m[1]);
const nuxtScripts = scriptSrcs.filter((src) => src.includes("/_nuxt/"));
console.log(`WST_NUXT_COUNT=${nuxtScripts.length}`);

const keywords = ["baseURL", "$axios", "axios", "match-centre", "matchCentre", "fixtures", "scores", "score", "frames", "tournament", "api/", "graphql", "incrowd", "sportradar", "sport_event", "sportEvent"];
const allUrls = new Set();
const allHosts = new Set();

for (const src of nuxtScripts) {
  const { response, body } = await fetchText(src, false);
  if (!response.ok) continue;
  console.log(`CHUNK ${src} SIZE=${body.length}`);

  for (const match of body.matchAll(/https?:\\?\/\\?\/[^"'`\s)]+/gi)) {
    const value = match[0].replaceAll("\\/", "/");
    allUrls.add(value);
    try { allHosts.add(new URL(value).host); } catch {}
  }

  for (const keyword of keywords) {
    let start = 0;
    let found = 0;
    while (found < 8) {
      const index = body.toLowerCase().indexOf(keyword.toLowerCase(), start);
      if (index < 0) break;
      const snippet = body.slice(Math.max(0, index - 180), Math.min(body.length, index + keyword.length + 260)).replace(/\s+/g, " ");
      console.log(`HIT ${src} [${keyword}] ${snippet}`);
      start = index + keyword.length;
      found += 1;
    }
  }
}

console.log("WST_HOSTS=" + JSON.stringify([...allHosts]));
console.log("WST_URLS=" + JSON.stringify([...allUrls].filter((url) => /api|match|score|incrowd|sport|wst|fixture|tournament/i.test(url)).slice(0, 100)));

if (!wst.response.ok || wst.body.length < 1000 || !nuxtScripts.length) {
  throw new Error("WST frontend assets are not usable from CI runner");
}
