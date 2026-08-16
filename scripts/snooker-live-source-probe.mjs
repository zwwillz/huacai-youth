const headers = {
  "user-agent": "Mozilla/5.0 (compatible; WorldSnookerDataCenterProbe/1.3)",
  accept: "*/*",
  "cache-control": "no-cache, no-store, max-age=0",
  pragma: "no-cache",
};
async function get(url) {
  const response = await fetch(new URL(url, "https://www.wst.tv"), { headers, cache: "no-store", redirect: "follow" });
  const body = await response.text();
  console.log(`PROBE ${url} -> ${response.status} ${body.length}`);
  if (!response.ok) throw new Error(`${url} HTTP ${response.status}`);
  return body;
}

const runtime = await get("https://www.wst.tv/_nuxt/dde4183b4d4f2638169c.js");
console.log("RUNTIME_BEGIN");
console.log(runtime);
console.log("RUNTIME_END");

for (const url of [
  "https://matches.snooker.web.gc.wstservices.co.uk/v2",
  "https://tournaments.snooker.web.gc.wstservices.co.uk/v2",
  "https://snooker.graph.gc.wstservices.co.uk/graphql",
]) {
  const response = await fetch(url, { headers, cache: "no-store", redirect: "follow" });
  const body = await response.text();
  console.log(`DATA_ENDPOINT ${url} -> ${response.status} ${response.headers.get("content-type")} ${body.slice(0, 800).replace(/\s+/g, " ")}`);
}
