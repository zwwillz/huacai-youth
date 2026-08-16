import SnookerDataCenter from "./snooker-data-center";
import { SNOOKER_BUILD_MARK } from "@/lib/snooker/foundation";
import { getSnookerRepository } from "@/lib/snooker/repository";

export default async function SnookerPage() {
  const repository = getSnookerRepository();
  const snapshot = await repository.getDashboard();
  return <SnookerDataCenter initialSnapshot={snapshot} buildMark={SNOOKER_BUILD_MARK} />;
}
