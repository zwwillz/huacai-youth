import { getDashboardWithLiveOverlay } from "./live-overlay";

export type CachedSnookerDashboard = Awaited<ReturnType<typeof getDashboardWithLiveOverlay>>;

const DEFAULT_TTL_MS = 10_000;
const IDLE_TTL_MS = 30_000;

let cached: { value: CachedSnookerDashboard; expiresAt: number } | null = null;
let inflight: Promise<CachedSnookerDashboard> | null = null;

function hasActiveMatch(value: CachedSnookerDashboard) {
  return value.snapshot.event.rounds.some((round) => round.matches.some(
    (match) => match.status === "live" || match.status === "session-break",
  ));
}

/**
 * Keep the public UI responsive without making every browser poll WST directly.
 * On a warm server runtime, concurrent requests share one in-flight request.
 * During live play the cache window stays very short; while no match is active
 * it backs off automatically so an idle monitor cannot keep hitting WST every
 * few seconds. A distributed cache can replace this POC layer later without
 * changing the page/API contract.
 */
export async function getCachedDashboardWithLiveOverlay(ttlMs = DEFAULT_TTL_MS): Promise<CachedSnookerDashboard> {
  const now = Date.now();
  if (cached && cached.expiresAt > now) return cached.value;
  if (inflight) return inflight;

  inflight = getDashboardWithLiveOverlay()
    .then((value) => {
      const effectiveTtl = hasActiveMatch(value) ? ttlMs : Math.max(ttlMs, IDLE_TTL_MS);
      cached = {
        value,
        expiresAt: Date.now() + Math.max(1_000, effectiveTtl),
      };
      return value;
    })
    .finally(() => {
      inflight = null;
    });

  return inflight;
}
