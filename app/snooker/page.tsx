import SnookerDataCenterV2 from "./snooker-data-center-v2";
import { SNOOKER_BUILD_MARK } from "@/lib/snooker/foundation";
import { loadSnookerDatabaseViewV2 } from "@/lib/snooker/database-public-v2";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type SnookerRootView = "home" | "matches" | "data";

export default async function SnookerPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const [database, query] = await Promise.all([loadSnookerDatabaseViewV2(), searchParams]);
  const initialView: SnookerRootView = query.view === "matches" || query.view === "data" ? query.view : "home";
  const sourceHealth = {
    online: database.databaseOnline,
    accepted: database.databaseOnline,
    fetchedAt: database.loadedAt,
    message: database.databaseOnline
      ? "前端已从独立 snooker-data-center 数据库读取；WST 由中央任务同步。"
      : "独立数据库暂不可用，当前使用本地已验证快照兜底。",
  };

  return (
    <SnookerDataCenterV2
      initialSnapshot={database.snapshot}
      initialDatabaseEvents={database.eventDetails}
      initialSourceHealth={sourceHealth}
      buildMark={`${SNOOKER_BUILD_MARK}-DB07`}
      initialView={initialView}
    />
  );
}
