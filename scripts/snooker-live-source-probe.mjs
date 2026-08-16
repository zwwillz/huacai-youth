const target = new URL("https://www.snooker.org/res/index.asp?template=21");
target.searchParams.set("_ts", `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`);

const response = await fetch(target, {
  headers: {
    "user-agent": "Mozilla/5.0 (compatible; WorldSnookerDataCenterProbe/1.0)",
    accept: "text/html,application/xhtml+xml",
    "cache-control": "no-cache, no-store, max-age=0",
    pragma: "no-cache",
  },
  cache: "no-store",
});
if (!response.ok) throw new Error(`snooker.org live probe HTTP ${response.status}`);
const html = await response.text();
const text = html
  .replace(/<script[\s\S]*?<\/script>/gi, " ")
  .replace(/<style[\s\S]*?<\/style>/gi, " ")
  .replace(/<img\b[^>]*>/gi, " ")
  .replace(/<[^>]+>/g, " ")
  .replace(/&nbsp;/gi, " ")
  .replace(/&amp;/gi, "&")
  .replace(/&quot;/gi, '"')
  .replace(/&#39;|&apos;/gi, "'")
  .replace(/&ndash;|&#8211;/gi, "–")
  .replace(/&mdash;|&#8212;/gi, "—")
  .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
  .replace(/\s+/g, " ")
  .trim();

const match = text.match(/\bFinal\s*\(\s*19\s*\)\s+([A-Z][A-Za-zÀ-ž.'’\-\s]+?)\s+\[(\d+)\]\s+(\d+)\s*-\s*(\d+)\s+([A-Z][A-Za-zÀ-ž.'’\-\s]+?)\s+\[(\d+)\]/i);
if (!match) {
  console.error(text.slice(Math.max(0, text.search(/China Open/i) - 100), text.search(/China Open/i) + 1000));
  throw new Error("Could not parse China Open final from live source");
}

console.log(`SNOOKER_LIVE_SOURCE=${match[1].trim()} ${match[3]}:${match[4]} ${match[5].trim()}`);
console.log(`SNOOKER_LIVE_FETCHED_AT=${new Date().toISOString()}`);
