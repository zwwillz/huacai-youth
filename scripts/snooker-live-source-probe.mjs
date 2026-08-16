const headers = {
  "user-agent": "Mozilla/5.0 (compatible; WorldSnookerDataCenterProbe/1.1)",
  accept: "text/html,application/xhtml+xml",
  "cache-control": "no-cache, no-store, max-age=0",
  pragma: "no-cache",
};

async function fetchText(url) {
  const target = new URL(url);
  target.searchParams.set("_ts", `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`);
  const response = await fetch(target, { headers, cache: "no-store", redirect: "follow" });
  const body = await response.text();
  console.log(`PROBE ${url} -> ${response.status} ${body.length} bytes ${response.url}`);
  return { response, body };
}

const snooker = await fetchText("https://www.snooker.org/res/index.asp?template=21");
const snookerText = snooker.body.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
console.log(`SNOOKER_ORG_BLOCKED=${/Foul and a Miss/i.test(snookerText)}`);
console.log(`SNOOKER_ORG_SAMPLE=${snookerText.slice(0, 220)}`);

const wst = await fetchText("https://www.wst.tv/matches/5b3b0c5c-991c-444b-845d-70a1edbbdf39");
const scriptSrcs = [...wst.body.matchAll(/<script[^>]+src=["']([^"']+)["']/gi)].map((m) => m[1]);
const urls = [...wst.body.matchAll(/https?:\\?\/\\?\/[^"'\s<>]+/gi)].map((m) => m[0].replaceAll("\\/", "/"));
const interestingUrls = [...new Set(urls.filter((url) => /api|match|score|incrowd|wst|sport/i.test(url)))].slice(0, 30);
console.log(`WST_HAS_MARK=${/Mark\s+Selby/i.test(wst.body)}`);
console.log(`WST_HAS_NOPPON=${/Noppon\s+Saengkham/i.test(wst.body)}`);
console.log(`WST_HAS_NEXT_DATA=${/__NEXT_DATA__/i.test(wst.body)}`);
console.log(`WST_SCRIPT_COUNT=${scriptSrcs.length}`);
console.log("WST_SCRIPTS=" + JSON.stringify(scriptSrcs.slice(-20)));
console.log("WST_INTERESTING_URLS=" + JSON.stringify(interestingUrls));
console.log(`WST_SAMPLE=${wst.body.slice(0, 500).replace(/\s+/g, " ")}`);

if (!wst.response.ok || wst.body.length < 1000) {
  throw new Error("WST event page is not usable from CI runner");
}
