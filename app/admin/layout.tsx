import "./admin.css";
import "./admin-workspace-shell.css";
import "./admin-recovery.css";
import "./admin-local-workspace.css";
import "./competition-controls.css";
import "./events/event-management.css";
import "./events/event-settings-index.css";
import AdminNavigationFeedback from "./admin-navigation-feedback";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <>
    <AdminNavigationFeedback />
    {children}
  </>;
}
