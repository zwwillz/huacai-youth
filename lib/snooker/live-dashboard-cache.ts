import { getDashboardWithLiveOverlay } from "./live-overlay";

export type CachedSnookerDashboard = Awaited<ReturnType<typeof getDashboardWithLiveOverlay>>;

// Live match data is intentionally shared for ~30 seconds. This prevents every
// browser from turning into an independent WST poller while keeping the user
// experience close to realtime for snooker scoring.
const DEFAULT_TTL_MS = 30_000;
// When no match is active, reuse the snapshot much longer. Rankings, calendar
// and player profile refreshes are handled by separate low-frequency jobs.
const IDLE_TTL_MS = 30 * 60_000;

let cached: { value: CachedSnookerDashboard; expiresAt: number } | null = null;
let inflight: Promise<CachedSnookerDashboard> | null = null;

function hasActiveMatch(value: CachedSnookerDashboard) {
  return value.snapshot.event.rounds.some((round) => round.matches.some(
    (match) => match.status === "live" || match.status === "session-break",
  ));
}

/**
 * Keep the public UI responsive without making every browser poll WST directly.
 * Concurrent requests on a warm runtime share one in-flight request. Live play
 * uses a 30-second shared window; once there is no active match, the cache backs
 * off to 30 minutes. The dedicated Snooker database will become the long-term
 * shared source, with the same 30-second live-match cadence.
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
