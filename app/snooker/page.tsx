import SnookerDataCenterV2 from "./snooker-data-center-v2";
import SnookerDataUnavailable from "./snooker-data-unavailable";
import SnookerViewUrlSync from "./snooker-view-url-sync";
import { SNOOKER_BUILD_MARK } from "@/lib/snooker/foundation";
import { dashboardSourceHealth, loadSnookerDashboardCore } from "@/lib/snooker/dashboard-public";
import { CURRENT_RANKING_KEYS, loadSnookerRankingHub, type SnookerCurrentRankingKey, type SnookerRankingSection } from "@/lib/snooker/ranking-hub";

export const revalidate = 30;

type SnookerRootView = "home" | "matches" | "players" | "data";

function rankingKey(value?: string): SnookerCurrentRankingKey {
  return CURRENT_RANKING_KEYS.find((key) => key === value) ?? "world_official";
}

function rankingSection(value?: string): SnookerRankingSection {
  return value === "qualification" || value === "history" ? value : "current";
}

export default async function SnookerPage({ searchParams }: { searchParams: Promise<{ view?: string; player?: string; section?: string; list?: string; group?: string }> }) {
  const query = await searchParams;
  const [databaseResult, rankingHub] = await Promise.all([
    loadSnookerDashboardCore({ allowStale: true }).then((value) => ({ ok: true as const, value })).catch((error) => {
      console.error("[snooker-page] dashboard core unavailable", error);
      return { ok: false as const, value: null };
    }),
    loadSnookerRankingHub(),
  ]);

  if (!databaseResult.ok || !databaseResult.value) {
    return <SnookerDataUnavailable attemptedAt={new Date().toISOString()} />;
  }

  const database = databaseResult.value;
  const requestedPlayer = query.player?.trim() || null;
  const initialDataSection = query.view === "data" && query.section === "rankings" ? "rankings" as const : null;
  const initialView: SnookerRootView = requestedPlayer
    ? "players"
    : initialDataSection
      ? "data"
      : query.view === "matches" || query.view === "players" || query.view === "data"
        ? query.view
        : "home";

  return (
    <>
      <SnookerViewUrlSync />
      <SnookerDataCenterV2
        initialSnapshot={database.snapshot}
        initialDatabaseEvents={database.eventDetails}
        initialRankingHub={rankingHub}
        initialSourceHealth={dashboardSourceHealth(database)}
        buildMark={`${SNOOKER_BUILD_MARK}-DB11`}
        initialView={initialView}
        initialPlayerSlug={requestedPlayer}
        initialDataSection={initialDataSection}
        initialRankingKey={initialDataSection ? rankingKey(query.list) : null}
        initialRankingSection={initialDataSection ? rankingSection(query.group) : "current"}
      />
    </>
  );
}
