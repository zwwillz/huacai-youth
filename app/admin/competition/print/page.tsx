import { redirect } from "next/navigation";
import { getAdminViewer } from "../../admin-viewer";
import { getBracketDetail } from "@/db/bracket-engine";
import { getScheduleWorkspaceData } from "@/db/schedule-engine";
import PrintableCompetitionClient from "./printable-competition-client";
import "./printable-competition.css";

export const dynamic = "force-dynamic";

export default async function CompetitionPrintPage({ searchParams }: { searchParams: Promise<{ session?: string }> }) {
  const viewer = await getAdminViewer();
  if (!viewer) redirect("/admin/login");
  const query = await searchParams;
  const sessionId = String(query.session || "");
  if (!sessionId) redirect("/admin/competition");
  const [bracket, schedule] = await Promise.all([
    getBracketDetail(viewer.username, sessionId),
    getScheduleWorkspaceData(viewer.username, sessionId),
  ]);
  if (!bracket) redirect("/admin/competition");
  return <PrintableCompetitionClient bracket={bracket} schedule={schedule} />;
}
