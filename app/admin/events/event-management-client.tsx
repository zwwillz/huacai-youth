"use client";

import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import type { EventManagementData, EventManagementInput } from "@/db/event-management";

const statusOptions = [
  ["draft", "准备中"],
  ["registration_open", "报名中"],
  ["registration_closed", "报名截止"],
  ["in_progress", "比赛中"],
  ["finished", "已结束"],
] as const;

const organizationLabels = {
  host: "主办单位",
  support: "支持单位",
  operator: "承办单位",
  cooperator: "协办单位",
} as const;

function toDraft(data: EventManagementData): EventManagementInput {
  return {
    eventId: data.event.id,
    year: data.event.year,
    stationNo: data.event.stationNo,
    fullTitle: data.event.fullTitle,
    shortTitle: data.event.shortTitle,
    city: data.event.city,
    startDate: data.event.startDate,
    endDate: data.event.endDate,
    registrationStartAt: data.event.registrationStartAt,
    registrationEndAt: data.event.registrationEndAt,
    coverImageKey: data.event.coverImageKey,
    summary: data.event.summary,
    status: data.event.status as EventManagementInput["status"],
    publishStatus: data.event.publishStatus as EventManagementInput["publishStatus"],
    venue: { ...data.event.venue },
    details: { ...data.event.details },
    sponsors: data.event.sponsors.map((sponsor) => ({ ...sponsor })),
    organizations: { ...data.event.organizations },
    groups: data.event.groups.map((group) => ({ ...group })),
    memberIds: [...data.event.memberIds],
  };
}

export default function EventManagementClient({ initialData }: { initialData: EventManagementData }) {
  const [data, setData] = useState(initialData);
  const [draft, setDraft] = useState<EventManagementInput>(() => toDraft(initialData));
  const [working, setWorking] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const archived = draft.status === "archived";
  const assignedAccounts = useMemo(() => new Set(draft.memberIds ?? []), [draft.memberIds]);

  const updateRoot = <K extends keyof EventManagementInput>(key: K, value: EventManagementInput[K]) => setDraft((current) => ({ ...current, [key]: value }));

  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (archived) return;
    setWorking(true); setNotice(""); setError("");
    try {
      const response = await fetch("/api/admin/event-management", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(draft),
      });
      const payload = await response.json() as { data?: EventManagementData; error?: string };
      if (!response.ok || !payload.data) throw new Error(payload.error || "赛事资料保存失败。");
      setData(payload.data);
      setDraft(toDraft(payload.data));
      setNotice("赛事基础资料已保存。");
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "赛事资料保存失败。");
    } finally { setWorking(false); }
  };

  return <main className="event-v2-editor">
    <section className="event-v2-editor-head">
      <div><small>EVENT MASTER DATA</small><h2>{archived ? "查看赛事" : "编辑赛事"}</h2><p>{archived ? "该赛事已经归档，当前页面为历史只读状态。" : "这里只维护赛事本身的基础主数据。主题图、赞助商、主要参数和公众展示内容统一前往赛事运营维护。"}</p></div>
      <div className="event-v2-card-actions"><Link href="/admin/events">返回赛事管理</Link></div>
    </section>

    {archived && <div className="event-v2-readonly">已归档赛事不可直接修改；系统管理员可在赛事管理列表中撤回归档后继续维护。</div>}
    {notice && <div className="event-v2-message">✓ {notice}</div>}
    {error && <div className="event-v2-error">{error}</div>}

    <form className="event-v2-form" onSubmit={save}>
      <section className="event-v2-form-main">
        <section className="event-v2-section">
          <header><div><small>01 · BASIC</small><h3>赛事基本信息</h3><p>赛事身份与日期属于主数据，赛事运营只能读取，不能重复修改。</p></div><b>核心信息</b></header>
          <div className="event-v2-grid">
            <label className="wide"><span>完整赛事名称</span><input disabled={archived} value={draft.fullTitle} onChange={(e) => updateRoot("fullTitle", e.target.value)} required /></label>
            <label><span>赛季年份</span><input disabled={archived} type="number" min="2025" max="2100" value={draft.year} onChange={(e) => updateRoot("year", Number(e.target.value))} required /></label>
            <label><span>第几站</span><input disabled={archived} type="number" min="1" value={draft.stationNo} onChange={(e) => updateRoot("stationNo", Number(e.target.value))} required /></label>
            <label><span>城市</span><input disabled={archived} value={draft.city} onChange={(e) => updateRoot("city", e.target.value)} required /></label>
            <label><span>赛事状态</span><select disabled={archived} value={draft.status} onChange={(e) => updateRoot("status", e.target.value as EventManagementInput["status"])}>{archived ? <option value="archived">已归档</option> : statusOptions.map(([value,label]) => <option value={value} key={value}>{label}</option>)}</select></label>
            <label><span>比赛开始日期</span><input disabled={archived} type="date" value={draft.startDate} onChange={(e) => updateRoot("startDate", e.target.value)} required /></label>
            <label><span>比赛结束日期</span><input disabled={archived} type="date" value={draft.endDate} onChange={(e) => updateRoot("endDate", e.target.value)} required /></label>
          </div>
        </section>

        <section className="event-v2-section">
          <header><div><small>02 · GROUPS</small><h3>参赛组别</h3><p>这里只确定赛事有哪些参赛组别；年龄、报名费、正赛规模等运营参数后续再维护。</p></div><b>{draft.groups.filter((group) => group.status === "active").length} 个启用</b></header>
          <div className="event-v2-group-list">{draft.groups.map((group, index) => <div className="event-v2-group-row" key={group.id}>
            <label><span>组别名称</span><input disabled={archived} value={group.name} onChange={(e) => updateRoot("groups", draft.groups.map((row,i) => i === index ? { ...row, name: e.target.value } : row))} /></label>
            <label><span>代码</span><input disabled={archived} value={group.code} onChange={(e) => updateRoot("groups", draft.groups.map((row,i) => i === index ? { ...row, code: e.target.value } : row))} /></label>
            <label><span>状态</span><select disabled={archived} value={group.status} onChange={(e) => updateRoot("groups", draft.groups.map((row,i) => i === index ? { ...row, status: e.target.value } : row))}><option value="active">启用</option><option value="disabled">停用</option></select></label>
          </div>)}</div>
        </section>

        <section className="event-v2-section">
          <header><div><small>03 · ORGANIZATIONS</small><h3>赛事组织机构</h3><p>这些信息作为赛事主数据同步到赛事概览，运营页面只读引用。</p></div></header>
          <div className="event-v2-grid">{(Object.keys(organizationLabels) as Array<keyof typeof organizationLabels>).map((type) => <label className="wide" key={type}><span>{organizationLabels[type]}</span><textarea disabled={archived} rows={2} value={draft.organizations[type] || ""} onChange={(e) => updateRoot("organizations", { ...draft.organizations, [type]: e.target.value })} placeholder="多个单位可用顿号或换行分隔" /></label>)}</div>
        </section>

        {data.viewerRole === "system_admin" && <section className="event-v2-section">
          <header><div><small>04 · MEMBERS</small><h3>组委会与裁判账号</h3><p>将已有后台账号分配到本站，后续赛事运营和竞赛执行按赛事范围授权。</p></div><b>{draft.memberIds?.length ?? 0} 人</b></header>
          <div className="event-v2-member-list">{data.assignableAccounts.length ? data.assignableAccounts.map((account) => {
            const checked = assignedAccounts.has(account.id);
            return <label className={checked ? "selected" : ""} key={account.id}><input type="checkbox" checked={checked} disabled={archived || account.status !== "active"} onChange={(e) => updateRoot("memberIds", e.target.checked ? [...(draft.memberIds ?? []), account.id] : (draft.memberIds ?? []).filter((id) => id !== account.id))} /><div><strong>{account.displayName}</strong><small>{account.username} · {account.role === "committee" ? "组委会" : "裁判"}</small></div></label>;
          }) : <p>暂无可分配账号。</p>}</div>
        </section>}
      </section>

      <aside className="event-v2-side">
        <small>当前赛事</small>
        <h3>第 {draft.stationNo} 站</h3>
        <p>{draft.fullTitle}</p>
        <dl><div><dt>城市</dt><dd>{draft.city || "—"}</dd></div><div><dt>日期</dt><dd>{draft.startDate || "—"}<br/>{draft.endDate || "—"}</dd></div><div><dt>组别</dt><dd>{draft.groups.filter((group) => group.status === "active").map((group) => group.name).join(" / ") || "—"}</dd></div><div><dt>状态</dt><dd>{archived ? "已归档" : statusOptions.find(([value]) => value === draft.status)?.[1] ?? draft.status}</dd></div></dl>
        {!archived && <button className="event-v2-save" type="submit" disabled={working}>{working ? "正在保存…" : "保存赛事资料"}</button>}
        <Link href="/admin/events">返回赛事列表</Link>
      </aside>
    </form>
  </main>;
}
