"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import type { AccountManagementRow } from "@/db/account-admin";
import { useAdminActionDialog } from "../admin-action-dialog";

type CreateDraft = { username: string; displayName: string; password: string; role: "committee" | "referee" };

async function readResponse(response: Response) {
  const payload = await response.json() as { data?: AccountManagementRow[]; error?: string };
  if (!response.ok || !payload.data) throw new Error(payload.error || "账号操作失败。");
  return payload.data;
}

export default function AccountManagementClient({ initialAccounts }: { initialAccounts: AccountManagementRow[] }) {
  const router = useRouter();
  const [accounts, setAccounts] = useState(initialAccounts);
  const [draft, setDraft] = useState<CreateDraft>({ username: "", displayName: "", password: "", role: "committee" });
  const [working, setWorking] = useState("");
  const [message, setMessage] = useState("");
  const { ask, dialog } = useAdminActionDialog();

  const reload = async (showMessage = true) => {
    setWorking("refresh");
    try {
      const rows = await readResponse(await fetch("/api/admin/account-management", { cache: "no-store" }));
      setAccounts(rows);
      if (showMessage) setMessage(`账号列表已刷新，共 ${rows.length} 个可见后台账号。`);
      router.refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : "账号列表刷新失败。"); }
    finally { setWorking(""); }
  };

  const call = async (body: Record<string, unknown>, key: string, success: string) => {
    setWorking(key); setMessage("");
    try {
      const rows = await readResponse(await fetch("/api/admin/account-management", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }));
      setAccounts(rows);
      setMessage(success);
      router.refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : "账号操作失败。"); }
    finally { setWorking(""); }
  };

  const create = async (event: FormEvent) => {
    event.preventDefault();
    await call({ action: "create", ...draft }, "create", "后台账号已创建并已加入账号列表。下一步可到具体赛事的“后台成员”中分配赛事权限。" );
    setDraft({ username: "", displayName: "", password: "", role: "committee" });
  };
  const resetPassword = async (account: AccountManagementRow) => {
    const password = await ask({ title: `重置 ${account.displayName} 的密码`, description: "新密码保存后，该账号现有登录会话会立即失效，需要使用新密码重新登录。", confirmLabel: "确认重置密码", input: { label: "新密码（8—72位）", type: "password", minLength: 8, required: true, placeholder: "请输入至少8位的新密码" } });
    if (typeof password === "string") await call({ action: "password", id: account.id, password }, account.id, "密码已重置，该账号原登录会话已失效。");
  };
  const deleteAccount = async (account: AccountManagementRow) => {
    const confirmed = await ask({ title: `删除账号“${account.displayName}”`, description: `用户名：${account.username}\n\n该账号会立即退出登录，并移出所有赛事成员关系。历史操作日志会继续保留。`, confirmLabel: "确认删除账号", tone: "danger" });
    if (confirmed) await call({ action: "delete", id: account.id }, account.id, "账号已删除，历史操作日志仍保留。");
  };

  return <main className="admin-system-page">
    <section className="admin-system-head"><div><small>ACCOUNT & PERMISSION</small><h2>账号与权限</h2><p>这里管理系统级后台账号和角色。创建成功后会立即刷新列表；具体“能操作哪一站赛事”仍在对应赛事的“后台成员”中分配。</p></div><button type="button" disabled={working === "refresh"} onClick={() => reload()}>{working === "refresh" ? "刷新中…" : `刷新账号列表 · ${accounts.length}`}</button></section>
    {message && <div className="admin-system-message">{message}</div>}
    <section className="admin-system-grid">
      <article className="admin-system-card"><header><h3>创建后台账号</h3><p>系统管理员可以创建组委会或裁判账号。初始密码交给使用人后，可随时重置。</p></header><form className="admin-account-form" onSubmit={create}>
        <label><span>用户名</span><input value={draft.username} onChange={(e) => setDraft((current) => ({ ...current, username: e.target.value }))} placeholder="例如 referee.li" required /></label>
        <label><span>显示名称</span><input value={draft.displayName} onChange={(e) => setDraft((current) => ({ ...current, displayName: e.target.value }))} placeholder="例如 李裁判" required /></label>
        <label><span>初始密码</span><input type="password" minLength={8} value={draft.password} onChange={(e) => setDraft((current) => ({ ...current, password: e.target.value }))} placeholder="至少8位" required /></label>
        <label><span>系统角色</span><select value={draft.role} onChange={(e) => setDraft((current) => ({ ...current, role: e.target.value as CreateDraft["role"] }))}><option value="committee">组委会</option><option value="referee">裁判</option></select></label>
        <button disabled={working === "create"}>{working === "create" ? "正在创建…" : "创建账号"}</button>
      </form></article>

      <article className="admin-system-card"><header><h3>已有后台账号 · {accounts.length}</h3><p>角色决定系统功能范围；赛事分配决定账号能够操作的具体分站。系统管理员账号本身不允许在这里删除。</p></header><div className="admin-account-list">{accounts.map((account) => <div className="admin-account-row" key={account.id}>
        <div className="admin-account-person"><span>{account.displayName.slice(0, 1)}</span><div><strong>{account.displayName}</strong><small>{account.username} · <i className={`admin-account-status ${account.status}`}>{account.status === "active" ? "启用" : "停用"}</i></small></div></div>
        <div className="admin-account-role">{account.role === "system_admin" ? <b>系统管理员</b> : <select value={account.role} disabled={working === account.id} onChange={(e) => call({ action: "role", id: account.id, role: e.target.value }, account.id, "账号角色已更新。")}><option value="committee">组委会</option><option value="referee">裁判</option></select>}</div>
        <div className="admin-account-events">{account.assignedEvents.length ? account.assignedEvents.map((event) => <span key={event.id}>{event.title}</span>) : <small>尚未分配赛事</small>}</div>
        <div className="admin-account-actions">{account.role !== "system_admin" && <><button disabled={working === account.id} onClick={() => call({ action: "status", id: account.id, status: account.status === "active" ? "disabled" : "active" }, account.id, account.status === "active" ? "账号已停用。" : "账号已重新启用。")}>{account.status === "active" ? "停用" : "启用"}</button><button disabled={working === account.id} onClick={() => resetPassword(account)}>重置密码</button><button className="danger" disabled={working === account.id} onClick={() => deleteAccount(account)}>删除账号</button></>}</div>
      </div>)}</div></article>
    </section>
  {dialog}</main>;
}
