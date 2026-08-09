import "./admin.css";
import "./admin-workspace-shell.css";
import "./admin-progressive-loading.css";
import "./admin-recovery.css";
import "./admin-local-workspace.css";
import "./admin-home.css";
import "./competition-controls.css";
import "./events/event-management.css";
import "./events/event-settings-index.css";
import "./events/new/new-event.css";
import AdminWorkspaceShell from "./admin-workspace-shell";
import { getAdminViewer } from "./admin-viewer";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const viewer = await getAdminViewer();
  if (!viewer) return <>{children}</>;

  // Structure first: authenticated identity is required before rendering the
  // private workspace, but the event navigation list is not. Individual pages
  // progressively register their authorized event context after the shell is up.
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
