import SnookerDataCenter from "./snooker-data-center";
import { SNOOKER_BUILD_MARK } from "@/lib/snooker/foundation";
import { loadSnookerDatabaseView } from "@/lib/snooker/database-public";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function SnookerPage() {
  const database = await loadSnookerDatabaseView();
  const sourceHealth = {
    online: database.databaseOnline,
    accepted: database.databaseOnline,
    eventAccepted: database.databaseOnline,
    liveAccepted: false,
    source: "Snooker DB",
    fetchedAt: database.loadedAt,
    latencyMs: 0,
    parsedRoundCount: database.snapshot.event.rounds.length,
    parsedMatchCount: database.snapshot.event.rounds.flatMap((round) => round.matches).length,
    overlayCount: database.snapshot.event.rounds.flatMap((round) => round.matches).length,
    changedCount: 0,
    pollingSeconds: 30,
    liveScore: null,
    appliedFinalScore: "",
    matchId: null,
    message: database.databaseOnline
      ? "前端已从独立 snooker-data-center 数据库读取。进行中比赛由中央同步任务写入数据库后再提供给用户端。"
      : "独立数据库暂不可用，当前使用本地已验证快照兜底。",
  };

  return (
    <SnookerDataCenter
      initialSnapshot={database.snapshot}
      initialDatabaseEvents={database.eventDetails}
      initialSourceHealth={sourceHealth}
      buildMark={`${SNOOKER_BUILD_MARK}-DB`}
    />
  );
}
