import { getDashboardWithLiveOverlay } from "./live-overlay";

export type CachedSnookerDashboard = Awaited<ReturnType<typeof getDashboardWithLiveOverlay>>;

const DEFAULT_TTL_MS = 10_000;

let cached: { value: CachedSnookerDashboard; expiresAt: number } | null = null;
let inflight: Promise<CachedSnookerDashboard> | null = null;

/**
 * Keep the public UI responsive without making every browser poll WST directly.
 * On a warm server runtime, concurrent requests share one in-flight request and
 * reuse the accepted result for a very short window. This is intentionally a
 * small POC cache; a distributed cache can replace it later without changing
 * the page/API contract.
 */
export async function getCachedDashboardWithLiveOverlay(ttlMs = DEFAULT_TTL_MS): Promise<CachedSnookerDashboard> {
  const now = Date.now();
  if (cached && cached.expiresAt > now) return cached.value;
  if (inflight) return inflight;

  inflight = getDashboardWithLiveOverlay()
    .then((value) => {
      cached = {
        value,
        expiresAt: Date.now() + Math.max(1_000, ttlMs),
      };
      return value;
    })
    .finally(() => {
      inflight = null;
    });

  return inflight;
}
