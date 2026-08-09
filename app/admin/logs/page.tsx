import { redirect } from "next/navigation";
import { getAuditLogData } from "@/db/admin-ui";
import { getAdminNavigationEventsForPrincipal } from "@/db/admin-principal-ui";
import { getAdminViewer } from "../admin-viewer";
import AdminWorkspaceShell from "../admin-workspace-shell";
import "../system-admin.css";

export const dynamic = "force-dynamic";

const actionLabels: Record<string, string> = {
  bootstrap_admin: "初始化管理员",
  resume_bootstrap: "补充初始化",
  create: "创建赛事",
  update: "修改赛事",
  publish: "发布内容",
  unpublish: "撤回内容",
  create_account: "创建账号",
  enable_account: "启用账号",
  disable_account: "停用账号",
  reset_password: "重置密码",
  change_role: "修改角色",
  delete_account: "删除账号",
  delete_event: "删除赛事",
  save_content: "保存内容",
  save_guides: "保存参赛提示",
};

function formatTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("zh-CN", { hour12: false });
}

export default async function LogsPage() {
  const viewer = await getAdminViewer();
  if (!viewer) redirect("/admin/login");
  if (viewer.role !== "system_admin") redirect("/admin");
  const [logs, events] = await Promise.all([
    getAuditLogData(viewer.username, 150),
    getAdminNavigationEventsForPrincipal(viewer),
  ]);

  return <AdminWorkspaceShell viewer={{ displayName: viewer.displayName, role: viewer.role }} events={events} active="logs" pageTitle="操作日志" pageHint="系统 · 审计与操作记录">
    <main className="admin-system-page">
      <section className="admin-system-head"><div><small>AUDIT LOG</small><h2>操作日志</h2><p>记录赛事、内容、账号和后台关键操作。日志独立于当前赛事，便于系统管理员追溯修改来源。</p></div></section>
      <section className="admin-system-card admin-log-card">
        <div className="admin-log-head"><span>时间</span><span>操作人</span><span>模块</span><span>操作</span><span>对象</span></div>
        {logs.length ? logs.map((log) => <div className="admin-log-row" key={log.id}><span>{formatTime(log.createdAt)}</span><span><strong>{log.actorName}</strong><br/><small>{log.actorUsername}</small></span><span>{log.moduleType}</span><span><b className="admin-log-action">{actionLabels[log.action] ?? log.action}</b></span><span><strong>{log.targetType}</strong><br/><small>{log.targetId || log.eventId || "-"}</small></span></div>) : <div className="admin-log-empty">暂无操作日志</div>}
      </section>
    </main>
  </AdminWorkspaceShell>;
}
