import { getSnookerOpsViewer, loadSnookerOpsSnapshot } from "@/lib/snooker/data-ops-auth";
import DataOpsClientV2, { type DataOpsSnapshot } from "./data-ops-client-v2";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function SnookerDataOpsPage() {
  const viewer = await getSnookerOpsViewer();
  let snapshot: DataOpsSnapshot | null = null;
  if (viewer && !viewer.mustChangePassword) {
    try { snapshot = await loadSnookerOpsSnapshot<DataOpsSnapshot>(); }
    catch { snapshot = null; }
  }
  return <DataOpsClientV2 initialViewer={viewer} initialSnapshot={snapshot} />;
}
