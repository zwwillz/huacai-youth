import SnookerRootController from "./snooker-root-controller";
import { SNOOKER_BUILD_MARK } from "@/lib/snooker/foundation";
import { loadSnookerDatabaseViewV2 } from "@/lib/snooker/database-public-v2";

export const revalidate = 30;

type SnookerRootView = "home" | "matches" | "players" | "data";

export default async function SnookerPage({ searchParams }: { searchParams: Promise<{ view?: string; player?: string }> }) {
  const [database, query] = await Promise.all([loadSnookerDatabaseViewV2(), searchParams]);
  const requestedPlayer = query.player?.trim() || null;
  const initialView: SnookerRootView = requestedPlayer
    ? "players"
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
    <SnookerRootController
      initialSnapshot={database.snapshot}
      initialDatabaseEvents={database.eventDetails}
      initialSourceHealth={sourceHealth}
      buildMark={`${SNOOKER_BUILD_MARK}-DB09`}
      initialView={initialView}
      initialPlayerSlug={requestedPlayer}
    />
  );
}
