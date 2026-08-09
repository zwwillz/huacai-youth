import "./admin.css";
import "./admin-workspace-shell.css";
import "./admin-recovery.css";
import "./admin-local-workspace.css";
import "./competition-controls.css";
import "./events/event-management.css";
import "./events/event-settings-index.css";
import AdminWorkspaceShell from "./admin-workspace-shell";
import { getAdminViewer } from "./admin-viewer";
import { getAdminNavigationEventsForPrincipal } from "@/db/admin-principal-ui";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const viewer = await getAdminViewer();
  if (!viewer) return <>{children}</>;

  let events: Awaited<ReturnType<typeof getAdminNavigationEventsForPrincipal>> = [];
  try {
    events = await getAdminNavigationEventsForPrincipal(viewer);
  } catch {
    // Keep the authenticated workspace usable even if the navigation list has a transient read failure.
    // Individual pages still enforce their own event access and can surface a precise error state.
  }

  return <AdminWorkspaceShell
    viewer={{ displayName: viewer.displayName, role: viewer.role }}
    events={events}
    active="dashboard"
    pageTitle="工作台"
    pageHint="全局总览与待办"
  >
    {children}
  </AdminWorkspaceShell>;
}
