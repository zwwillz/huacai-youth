import SnookerDataCenter from "./snooker-data-center";
import { SNOOKER_BUILD_MARK } from "@/lib/snooker/foundation";
import { getSnookerRepository } from "@/lib/snooker/repository";

type SnookerRootView = "home" | "matches" | "data";

export default async function SnookerPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const repository = getSnookerRepository();
  const [snapshot, query] = await Promise.all([repository.getDashboard(), searchParams]);
  const initialView: SnookerRootView = query.view === "matches" || query.view === "data" ? query.view : "home";
  return <SnookerDataCenter initialSnapshot={snapshot} buildMark={SNOOKER_BUILD_MARK} initialView={initialView} />;
}
