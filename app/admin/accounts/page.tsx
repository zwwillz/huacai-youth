import { redirect } from "next/navigation";
import { getAccountsForAdmin } from "@/db/account-admin";
import { getAdminNavigationEventsForPrincipal } from "@/db/admin-principal-ui";
import { isRootSystemAdminUsername } from "@/db/system-admin-policy.mjs";
import { getAdminViewer } from "../admin-viewer";
import AdminWorkspaceShell from "../admin-workspace-shell";
import AccountManagementClient from "./account-management-client";
import "../system-admin.css";

export const dynamic = "force-dynamic";

export default async function AccountsPage() {
  const viewer = await getAdminViewer();
  if (!viewer) redirect("/admin/login");
  if (viewer.role !== "system_admin") redirect("/admin");
  const [accounts, events] = await Promise.all([
    getAccountsForAdmin(viewer.username),
    getAdminNavigationEventsForPrincipal(viewer),
  ]);
  return <AdminWorkspaceShell
    viewer={{ displayName: viewer.displayName, role: viewer.role }}
    events={events}
    active="accounts"
    pageTitle="账号与权限"
    pageHint="系统 · 用户、角色与赛事权限"
  >
    <AccountManagementClient initialAccounts={accounts} canManageSystemAdmins={isRootSystemAdminUsername(viewer.username)} />
  </AdminWorkspaceShell>;
}
