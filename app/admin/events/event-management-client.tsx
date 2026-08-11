"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { EventManagementData, EventManagementInput } from "@/db/event-management";
import type { EventWorkflowSummary } from "@/db/event-workflow";
import { useAdminActionDialog } from "../admin-action-dialog";

const statusLabels: Record<string, string> = {
  draft: "筹备中",
  registration_open: "报名中",
  registration_closed: "报名截止",
  in_progress: "比赛中",
  finished: "已结束",
  archived: "已归档",
};
const organizationLabels = { host: "主办单位", support: "支持单位", operator: "承办单位", cooperator: "协办单位" } as const;

function toDraft(data: EventManagementData): EventManagementInput {
  return {
    eventId: data.event.id,year: data.event.year,stationNo: data.event.stationNo,fullTitle: data.event.fullTitle,shortTitle: data.event.shortTitle,city: data.event.city,
    startDate: data.event.startDate,endDate: data.event.endDate,registrationStartAt: data.event.registrationStartAt,registrationEndAt: data.event.registrationEndAt,
    coverImageKey: data.event.coverImageKey,summary: data.event.summary,status: data.event.status as EventManagementInput["status"],publishStatus: data.event.publishStatus as EventManagementInput["publishStatus"],
    venue: { ...data.event.venue },details: { ...data.event.details },sponsors: data.event.sponsors.map((sponsor) => ({ ...sponsor })),organizations: { ...data.event.organizations },
    groups: data.event.groups.map((group) => ({ ...group })),memberIds: [...data.event.memberIds],
  };
}

export default function EventManagementClient({ initialData }: { initialData: EventManagementData }) {
  const router = useRouter();
  const [data, setData] = useState(initialData);
  const [draft, setDraft] = useState<EventManagementInput>(() => toDraft(initialData));
  const [workflow, setWorkflow] = useState<EventWorkflowSummary | null>(null);
  const [workflowLoading, setWorkflowLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [lifecycleWorking, setLifecycleWorking] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const { ask, dialog } = useAdminActionDialog();
  const archived = draft.status === "archived";
  const assignedAccounts = useMemo(() => new Set(draft.memberIds ?? []), [draft.memberIds]);
  const nextAction = workflow?.nextAction ?? null;

  const refreshWorkflow = useCallback(async () => {
    try {
      const response = await fetch(`/api/admin/workflow-summary?event=${encodeURIComponent(data.event.id)}`, { cache: "no-store" });
      const payload = await response.json() as { data?: EventWorkflowSummary; error?: string };
      if (!response.ok || !payload.data) throw new Error(payload.error || "赛事流程状态读取失败。");
      setWorkflow(payload.data);
      return payload.data;
    } catch (failure) {
      setWorkflow(null);
      setError(failure instanceof Error ? failure.message : "赛事流程状态读取失败。");
      return null;
    } finally {
      setWorkflowLoading(false);
    }
  }, [data.event.id]);

  useEffect(() => { void refreshWorkflow(); }, [refreshWorkflow]);

  const updateRoot = <K extends keyof EventManagementInput>(key: K, value: EventManagementInput[K]) => setDraft((current) => ({ ...current, [key]: value }));
  const applyLifecycleStatus = (status: string) => {
    setData((current) => ({ ...current, event: { ...current.event, status } }));
    setDraft((current) => ({ ...current, status: status as EventManagementInput["status"] }));
  };

  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (archived) return;
    setWorking(true); setNotice(""); setError("");
    try {
      const response = await fetch("/api/admin/event-management", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(draft) });
      const payload = await response.json() as { data?: EventManagementData; error?: string };
      if (!response.ok || !payload.data) throw new Error(payload.error || "赛事资料保存失败。");
      setData(payload.data); setDraft(toDraft(payload.data)); setNotice("赛事基础资料已保存。");
      await refreshWorkflow();
    } catch (failure) { setError(failure instanceof Error ? failure.message : "赛事资料保存失败。"); }
    finally { setWorking(false); }
  };

  const postLifecycle = async (action: string, reason = "") => {
    setLifecycleWorking(true); setNotice(""); setError("");
    try {
      const response = await fetch(`/api/admin/events/${encodeURIComponent(data.event.id)}/lifecycle`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action, reason }) });
      const payload = await response.json() as { data?: { status?: string }; error?: string };
      if (!response.ok) throw new Error(payload.error || "赛事生命周期推进失败。");
      if (payload.data?.status) applyLifecycleStatus(payload.data.status);
      setNotice(action === "force_finish" ? "赛事已由系统管理员强制结束，原因已记录到操作日志。" : "赛事生命周期已更新。");
      await refreshWorkflow();
      router.refresh();
    } catch (failure) { setError(failure instanceof Error ? failure.message : "赛事生命周期推进失败。"); }
    finally { setLifecycleWorking(false); }
  };

  const runLifecycle = async () => {
    if (!nextAction || nextAction.kind !== "lifecycle" || !nextAction.lifecycleAction || lifecycleWorking) return;
    const ok = await ask({ title: nextAction.title, description: nextAction.description, confirmLabel: nextAction.title });
    if (ok) await postLifecycle(nextAction.lifecycleAction);
  };

  const focusCurrentAction = () => {
    document.getElementById("event-master-basics")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const forceFinish = async () => {
    if (data.viewerRole !== "system_admin" || lifecycleWorking || archived || draft.status === "finished") return;
    let currentWorkflow = workflow;
    if (!currentWorkflow) currentWorkflow = await refreshWorkflow();
    if (!currentWorkflow) return;
    const incomplete = currentWorkflow.groups.filter((group) => !["confirmed", "published"].includes(group.rankingStatus)).map((group) => `${group.groupName}最终排名尚未确认`);
    const reason = await ask({
      title: "强制结束赛事",
      description: <div><p>该操作会绕过正常结束条件，仅用于异常处理。</p>{incomplete.length ? <ul>{incomplete.map((item) => <li key={item}>{item}</li>)}</ul> : <p>当前未检测到未完成的排名条件，但仍将按强制结束记录。</p>}</div>,
      confirmLabel: "确认强制结束",
      tone: "danger",
      input: { label: "强制结束原因（必填）", type: "text", minLength: 4, required: true, placeholder: "请说明异常情况或处理依据" },
    });
    if (typeof reason === "string") await postLifecycle("force_finish", reason);
  };

  return <main className="event-v2-editor">
    <section className="event-v2-editor-head"><div><small>EVENT MASTER DATA</small><h2>{archived ? "查看赛事" : "编辑赛事"}</h2><p>{archived ? "该赛事已经归档，当前页面为历史只读状态。" : "这里只维护赛事本身的基础主数据。当前下一步由统一 Workflow 判断，生命周期不再作为普通字段任意切换。"}</p></div><div className="event-v2-card-actions"><Link href="/admin/events">返回赛事管理</Link></div></section>
    {archived && <div className="event-v2-readonly">已归档赛事不可直接修改；系统管理员可在赛事管理列表中撤回归档后继续维护。</div>}
    {notice && <div className="event-v2-message">✓ {notice}</div>}{error && <div className="event-v2-error">{error}</div>}

    <form className="event-v2-form" onSubmit={save}>
      <section className="event-v2-form-main">
        <section className="event-v2-section" id="event-master-basics">
          <header><div><small>01 · BASIC</small><h3>赛事基本信息</h3><p>赛事身份与日期属于主数据；生命周期只通过统一 Workflow 推荐的合法流程动作推进。</p></div><b>核心信息</b></header>
          <div className="event-v2-grid">
            <label className="wide"><span>完整赛事名称</span><input disabled={archived} value={draft.fullTitle} onChange={(e) => updateRoot("fullTitle", e.target.value)} required /></label>
            <label><span>赛季年份</span><input disabled={archived} type="number" min="2025" max="2100" value={draft.year} onChange={(e) => updateRoot("year", Number(e.target.value))} required /></label>
            <label><span>第几站</span><input disabled={archived} type="number" min="1" value={draft.stationNo} onChange={(e) => updateRoot("stationNo", Number(e.target.value))} required /></label>
            <label><span>城市</span><input disabled={archived} value={draft.city} onChange={(e) => updateRoot("city", e.target.value)} required /></label>
            <label><span>赛事生命周期</span><div className="event-v2-lifecycle-readonly"><strong>{statusLabels[draft.status] ?? draft.status}</strong><small>只读</small></div></label>
            <label><span>比赛开始日期</span><input disabled={archived} type="date" value={draft.startDate} onChange={(e) => updateRoot("startDate", e.target.value)} required /></label>
            <label><span>比赛结束日期</span><input disabled={archived} type="date" value={draft.endDate} onChange={(e) => updateRoot("endDate", e.target.value)} required /></label>
          </div>
          {!archived && <div className="event-v2-lifecycle-actions"><div><div><small>CURRENT / NEXT ACTION</small><strong>{workflowLoading ? "正在读取统一 Workflow…" : nextAction?.title || "当前没有新的流程动作"}</strong><p>{workflowLoading ? "正在根据当前赛事、报名和竞赛事实计算下一步。" : nextAction?.description || "当前页面不会根据赛事状态自行猜测下一步，请返回工作台查看最新流程状态。"}</p></div>
            {!workflowLoading && nextAction?.kind === "lifecycle" && nextAction.lifecycleAction && <button type="button" disabled={lifecycleWorking} onClick={runLifecycle}>{lifecycleWorking ? "处理中…" : nextAction.title}</button>}
            {!workflowLoading && nextAction?.kind === "link" && nextAction.code === "complete_event_basics" && <button type="button" onClick={focusCurrentAction}>{nextAction.title}</button>}
            {!workflowLoading && nextAction?.kind === "link" && nextAction.code !== "complete_event_basics" && nextAction.href && <Link href={nextAction.href}>{nextAction.title}</Link>}
          </div>
            {data.viewerRole === "system_admin" && !["finished","archived"].includes(draft.status) && <details className="event-v2-lifecycle-advanced"><summary>高级操作 / 异常处理</summary><p>强制结束会绕过正常排名确认条件，必须填写原因并写入操作日志。普通赛事请不要使用。</p><button type="button" disabled={lifecycleWorking} onClick={forceFinish}>强制结束赛事</button></details>}
          </div>}
        </section>

        <section className="event-v2-section"><header><div><small>02 · GROUPS</small><h3>参赛组别</h3><p>这里只确定赛事有哪些参赛组别；少年组和青年组后续允许完全不同的竞赛进度。</p></div><b>{draft.groups.filter((group) => group.status === "active").length} 个启用</b></header><div className="event-v2-group-list">{draft.groups.map((group, index) => <div className="event-v2-group-row" key={group.id}><label><span>组别名称</span><input disabled={archived} value={group.name} onChange={(e) => updateRoot("groups", draft.groups.map((row,i) => i === index ? { ...row, name: e.target.value } : row))} /></label><label><span>代码</span><input disabled={archived} value={group.code} onChange={(e) => updateRoot("groups", draft.groups.map((row,i) => i === index ? { ...row, code: e.target.value } : row))} /></label><label><span>状态</span><select disabled={archived} value={group.status} onChange={(e) => updateRoot("groups", draft.groups.map((row,i) => i === index ? { ...row, status: e.target.value } : row))}><option value="active">启用</option><option value="disabled">停用</option></select></label></div>)}</div></section>

        <section className="event-v2-section"><header><div><small>03 · ORGANIZATIONS</small><h3>赛事组织机构</h3><p>这些信息作为赛事主数据同步到赛事概览，运营页面只读引用。</p></div></header><div className="event-v2-grid">{(Object.keys(organizationLabels) as Array<keyof typeof organizationLabels>).map((type) => <label className="wide" key={type}><span>{organizationLabels[type]}</span><textarea disabled={archived} rows={2} value={draft.organizations[type] || ""} onChange={(e) => updateRoot("organizations", { ...draft.organizations, [type]: e.target.value })} placeholder="多个单位可用顿号或换行分隔" /></label>)}</div></section>

        {data.viewerRole === "system_admin" && <section className="event-v2-section"><header><div><small>04 · MEMBERS</small><h3>组委会与裁判账号</h3><p>将已有后台账号分配到本站，后续赛事运营和竞赛执行按赛事范围授权。</p></div><b>{draft.memberIds?.length ?? 0} 人</b></header><div className="event-v2-member-list">{data.assignableAccounts.length ? data.assignableAccounts.map((account) => { const checked = assignedAccounts.has(account.id); return <label className={checked ? "selected" : ""} key={account.id}><input type="checkbox" checked={checked} disabled={archived || account.status !== "active"} onChange={(e) => updateRoot("memberIds", e.target.checked ? [...(draft.memberIds ?? []), account.id] : (draft.memberIds ?? []).filter((id) => id !== account.id))} /><div><strong>{account.displayName}</strong><small>{account.username} · {account.role === "committee" ? "组委会" : "裁判"}</small></div></label>; }) : <p>暂无可分配账号。</p>}</div></section>}
      </section>

      <aside className="event-v2-side"><small>当前赛事</small><h3>第 {draft.stationNo} 站</h3><p>{draft.fullTitle}</p><dl><div><dt>城市</dt><dd>{draft.city || "—"}</dd></div><div><dt>日期</dt><dd>{draft.startDate || "—"}<br/>{draft.endDate || "—"}</dd></div><div><dt>组别</dt><dd>{draft.groups.filter((group) => group.status === "active").map((group) => group.name).join(" / ") || "—"}</dd></div><div><dt>生命周期</dt><dd>{statusLabels[draft.status] ?? draft.status}</dd></div></dl>{!archived && <button className="event-v2-save" type="submit" disabled={working}>{working ? "正在保存…" : "保存赛事资料"}</button>}<Link href="/admin/events">返回赛事列表</Link></aside>
    </form>
    {dialog}
  </main>;
}
