import { gzipSync } from "node:zlib";

const PUBLIC_CACHE_CONTROL = "public, max-age=60, s-maxage=300, stale-while-revalidate=86400";

export function publicJson(request: Request, value: unknown, options: { status?: number; durationMs?: number; cache?: boolean } = {}) {
  const json = JSON.stringify(value);
  const acceptsGzip = /(?:^|,)\s*gzip\s*(?:,|$)/i.test(request.headers.get("accept-encoding") || "");
  const headers = new Headers({
    "content-type": "application/json; charset=utf-8",
    "cache-control": options.cache === false ? "no-store" : PUBLIC_CACHE_CONTROL,
    vary: "Accept-Encoding",
  });
  if (options.durationMs != null) headers.set("server-timing", `app;dur=${options.durationMs.toFixed(1)}`);
  if (acceptsGzip) {
    headers.set("content-encoding", "gzip");
    return new Response(gzipSync(json), { status: options.status ?? 200, headers });
  }
  return new Response(json, { status: options.status ?? 200, headers });
}
