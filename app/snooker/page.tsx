import SnookerDataCenterV2 from "./snooker-data-center-v2";
import SnookerViewUrlSync from "./snooker-view-url-sync";
import { SNOOKER_BUILD_MARK } from "@/lib/snooker/foundation";
import { loadSnookerDatabaseViewV2 } from "@/lib/snooker/database-public-v2";
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
  const [database, rankingHub, query] = await Promise.all([loadSnookerDatabaseViewV2(), loadSnookerRankingHub(), searchParams]);
  const requestedPlayer = query.player?.trim() || null;
  const initialDataSection = query.view === "data" && query.section === "rankings" ? "rankings" as const : null;
  const initialView: SnookerRootView = requestedPlayer
    ? "players"
    : initialDataSection
      ? "data"
      : query.view === "matches" || query.view === "players" || query.view === "data"
        ? query.view
        : "home";
  const sourceHealth = {
    online: database.databaseOnline,
    accepted: database.databaseOnline,
    fetchedAt: database.loadedAt,
    message: database.databaseOnline
      ? "前端读取独立斯诺克数据库；官方数据由中央同步任务统一写入。"
      : "独立数据库暂不可用，当前使用本地已验证快照兜底。",
  };

  return (
    <>
      <SnookerViewUrlSync />
      <SnookerDataCenterV2
        initialSnapshot={database.snapshot}
        initialDatabaseEvents={database.eventDetails}
        initialRankingHub={rankingHub}
        initialSourceHealth={sourceHealth}
        buildMark={`${SNOOKER_BUILD_MARK}-DB10`}
        initialView={initialView}
        initialPlayerSlug={requestedPlayer}
        initialDataSection={initialDataSection}
        initialRankingKey={initialDataSection ? rankingKey(query.list) : null}
        initialRankingSection={initialDataSection ? rankingSection(query.group) : "current"}
      />
    </>
  );
}
