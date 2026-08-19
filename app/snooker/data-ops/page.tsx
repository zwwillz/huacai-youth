import { getSnookerOpsViewer } from "@/lib/snooker/data-ops-auth";
import DataOpsClient from "./data-ops-client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function SnookerDataOpsPage() {
  const viewer = await getSnookerOpsViewer();
  return <DataOpsClient initialViewer={viewer} />;
}
