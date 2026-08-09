import "./admin.css";
import "./admin-workspace-shell.css";
import "./admin-progressive-loading.css";
import "./admin-structure-frame.css";
import "./admin-recovery.css";
import "./admin-local-workspace.css";
import "./admin-home.css";
import "./competition-controls.css";
import "./events/event-management.css";
import "./events/event-settings-index.css";
import "./events/new/new-event.css";
import "./content/content-management.css";
import "./content/content-extensions.css";
import "./content/[eventId]/guides/guide-management.css";
import "./players/player-management.css";
import "./players/player-management-performance.css";
import "./system-admin.css";
import "./competition/competition-context-bar.css";
import "./competition/competition.css";
import "./competition/schedules/schedules-index.css";
import "./competition/scoring/scoring-workbench.css";
import "./competition/qualification/qualification.css";
import "./competition/qualification/main-roster-control.css";
import "./competition/final-ranking/final-ranking.css";
import "./competition/draw/draw-workbench.css";
import "./competition/draw/main-stage-workbench.css";
import "./competition/schedule/schedule-workbench.css";
import "./competition/bracket/bracket-workbench.css";
import "./competition/bracket/bracket-next-step.css";
import AdminWorkspaceShell from "./admin-workspace-shell";
import { getAdminViewer } from "./admin-viewer";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const viewer = await getAdminViewer();
  if (!viewer) return <>{children}</>;

  // The authenticated identity is the only hard prerequisite for the private shell.
  // Page-owned structure CSS stays resident in this layout so route transitions can
  // paint the exact final-page frame before business data or route-specific chunks finish.
  return <AdminWorkspaceShell
    viewer={{ displayName: viewer.displayName, role: viewer.role }}
    events={[]}
    active="dashboard"
    pageTitle="工作台"
    pageHint="全局总览与待办"
  >
    {children}
  </AdminWorkspaceShell>;
}
