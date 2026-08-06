"use client";

import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import type { EventManagementData, EventManagementInput } from "@/db/event-management";

const statusOptions = [
  ["draft", "草稿"],
  ["registration_open", "报名中"],
  ["registration_closed", "报名截止"],
  ["in_progress", "比赛中"],
  ["finished", "已结束"],
  ["archived", "已归档"],
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
    summary: data.event.summary,
    status: data.event.status as EventManagementInput["status"],
    publishStatus: data.event.publishStatus as EventManagementInput["publishStatus"],
    venue: {
      name: data.event.venue.name,
      province: data.event.venue.province,
      city: data.event.venue.city,
      district: data.event.venue.district,
      address: data.event.venue.address,
      tableCount: data.event.venue.tableCount,
    },
    details: { ...data.event.details },
    organizations: { ...data.event.organizations },
    groups: data.event.groups.map((group) => ({ ...group })),
    memberIds: [...data.event.memberIds],
  };
}

function nullableNumber(value: string) {
  return value.trim() === "" ? null : Number(value);
}

export default function EventManagementClient({ initialData }: { initialData: EventManagementData }) {
  const [data, setData] = useState(initialData);
  const [draft, setDraft] = useState<EventManagementInput>(() => toDraft(initialData));
  const [working, setWorking] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const assignedAccounts = useMemo(() => new Set(draft.memberIds ?? []), [draft.memberIds]);

  const updateRoot = <K extends keyof EventManagementInput>(key: K, value: EventManagementInput[K]) => {
    setDraft((current) => ({ ...current, [key]: value }));
  };

  const save = async (event: FormEvent) => {
    event.preventDefault();
    setWorking(true);
    setNotice("");
    setError("");
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
      setNotice("赛事资料已保存到 Supabase。数据库预览版会读取这些最新资料。");
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "赛事资料保存失败。");
    } finally {
      setWorking(false);
    }
  };

  return <main className="event-management-page">
    <header className="event-management-topbar">
      <div>
        <Link href="/admin">← 返回赛事后台</Link>
        <span>赛事管理 / 完整设置</span>
      </div>
      <div className="event-management-actions">
        <Link href="/" target="_blank">查看公众前端 ↗</Link>
        <button form="event-management-form" type="submit" disabled={working}>{working ? "正在保存…" : "保存全部设置"}</button>
      </div>
    </header>

    <form id="event-management-form" className="event-management-layout" onSubmit={save}>
      <aside className="event-management-summary">
        <span className="event-management-station">第 {draft.stationNo} 站</span>
        <h1>{draft.shortTitle || "未命名赛事"}</h1>
        <p>{draft.city || "城市待设置"} · {draft.venue.name || "场馆待设置"}</p>
        <dl>
          <div><dt>比赛状态</dt><dd>{statusOptions.find(([value]) => value === draft.status)?.[1] ?? draft.status}</dd></div>
          <div><dt>前端状态</dt><dd>{draft.publishStatus === "published" ? "已发布" : "草稿"}</dd></div>
          <div><dt>组别</dt><dd>{draft.groups.length} 个</dd></div>
          <div><dt>后台成员</dt><dd>{draft.memberIds?.length ?? 0} 人</dd></div>
        </dl>
        <div className="event-management-tip"><strong>本页管理“赛事主数据”</strong><p>名称、日期、场馆、组别、组织机构和后台成员在这里维护。规程正文、文件、赛程、对阵和排名随后在“内容发布 / 竞赛执行”中维护。</p></div>
      </aside>

      <section className="event-management-content">
        {notice && <div className="event-management-message success">✓ {notice}<button type="button" onClick={() => setNotice("")}>×</button></div>}
        {error && <div className="event-management-message error">! {error}<button type="button" onClick={() => setError("")}>×</button></div>}

        <section className="event-management-card">
          <header><div><small>01 · BASIC</small><h2>基本信息</h2><p>公众赛事列表和赛事概览首先使用这些字段。</p></div><b>必填</b></header>
          <div className="event-management-grid">
            <label className="wide"><span>完整赛事名称</span><input value={draft.fullTitle} onChange={(e) => updateRoot("fullTitle", e.target.value)} required /></label>
            <label className="wide"><span>前端显示简称</span><input value={draft.shortTitle} onChange={(e) => updateRoot("shortTitle", e.target.value)} required /></label>
            <label><span>赛季年份</span><input type="number" min="2025" max="2100" value={draft.year} onChange={(e) => updateRoot("year", Number(e.target.value))} required /></label>
            <label><span>第几站</span><input type="number" min="1" value={draft.stationNo} onChange={(e) => updateRoot("stationNo", Number(e.target.value))} required /></label>
            <label><span>城市</span><input value={draft.city} onChange={(e) => updateRoot("city", e.target.value)} placeholder="例如：河北廊坊" required /></label>
            <label><span>赛事状态</span><select value={draft.status} onChange={(e) => updateRoot("status", e.target.value as EventManagementInput["status"])}>{statusOptions.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
            <label><span>比赛开始日期</span><input type="date" value={draft.startDate} onChange={(e) => updateRoot("startDate", e.target.value)} required /></label>
            <label><span>比赛结束日期</span><input type="date" value={draft.endDate} onChange={(e) => updateRoot("endDate", e.target.value)} required /></label>
            <label><span>报名开始时间</span><input type="datetime-local" value={draft.registrationStartAt || ""} onChange={(e) => updateRoot("registrationStartAt", e.target.value)} /></label>
            <label><span>报名截止时间</span><input type="datetime-local" value={draft.registrationEndAt || ""} onChange={(e) => updateRoot("registrationEndAt", e.target.value)} /></label>
            <label><span>前端发布状态</span><select value={draft.publishStatus} onChange={(e) => updateRoot("publishStatus", e.target.value as EventManagementInput["publishStatus"])}><option value="draft">草稿</option><option value="published">已发布</option></select></label>
            <label><span>URL 标识</span><input value={data.event.slug} disabled /></label>
            <label className="wide"><span>赛事简介</span><textarea rows={4} value={draft.summary || ""} onChange={(e) => updateRoot("summary", e.target.value)} placeholder="用于赛事概览的简要说明" /></label>
          </div>
        </section>

        <section className="event-management-card">
          <header><div><small>02 · VENUE</small><h2>比赛场馆</h2><p>场馆地址与球台数量为之后排赛和台号管理提供基础。</p></div></header>
          <div className="event-management-grid">
            <label className="wide"><span>场馆名称</span><input value={draft.venue.name} onChange={(e) => updateRoot("venue", { ...draft.venue, name: e.target.value })} required /></label>
            <label><span>省 / 直辖市</span><input value={draft.venue.province || ""} onChange={(e) => updateRoot("venue", { ...draft.venue, province: e.target.value })} /></label>
            <label><span>城市</span><input value={draft.venue.city || ""} onChange={(e) => updateRoot("venue", { ...draft.venue, city: e.target.value })} /></label>
            <label><span>区 / 县</span><input value={draft.venue.district || ""} onChange={(e) => updateRoot("venue", { ...draft.venue, district: e.target.value })} /></label>
            <label><span>可用球台数</span><input type="number" min="0" value={draft.venue.tableCount ?? 0} onChange={(e) => updateRoot("venue", { ...draft.venue, tableCount: Number(e.target.value) })} /></label>
            <label className="wide"><span>详细地址</span><input value={draft.venue.address || ""} onChange={(e) => updateRoot("venue", { ...draft.venue, address: e.target.value })} /></label>
          </div>
        </section>

        <section className="event-management-card">
          <header><div><small>03 · DISPLAY</small><h2>赛事概览参数</h2><p>先维护结构化摘要；更完整的竞赛规程与奖金明细放到下一步“内容发布”。</p></div></header>
          <div className="event-management-grid">
            <label><span>冠名 / 赞助展示</span><input value={draft.details.sponsorLabel || ""} onChange={(e) => updateRoot("details", { ...draft.details, sponsorLabel: e.target.value })} placeholder="例如：铧一 · 星牌 · 南匠" /></label>
            <label><span>赛事时长</span><input value={draft.details.durationLabel || ""} onChange={(e) => updateRoot("details", { ...draft.details, durationLabel: e.target.value })} placeholder="例如：11天" /></label>
            <label><span>资格赛日期说明</span><input value={draft.details.qualifierDateLabel || ""} onChange={(e) => updateRoot("details", { ...draft.details, qualifierDateLabel: e.target.value })} /></label>
            <label><span>正赛日期说明</span><input value={draft.details.mainDateLabel || ""} onChange={(e) => updateRoot("details", { ...draft.details, mainDateLabel: e.target.value })} /></label>
            <label><span>总奖金展示</span><input value={draft.details.totalPrizeLabel || ""} onChange={(e) => updateRoot("details", { ...draft.details, totalPrizeLabel: e.target.value })} placeholder="例如：¥350,400" /></label>
            <label><span>正赛规模展示</span><input value={draft.details.mainSizeLabel || ""} onChange={(e) => updateRoot("details", { ...draft.details, mainSizeLabel: e.target.value })} placeholder="例如：每组64人" /></label>
            <label className="wide"><span>年龄 / 监护说明</span><textarea rows={3} value={draft.details.minimumAgeNote || ""} onChange={(e) => updateRoot("details", { ...draft.details, minimumAgeNote: e.target.value })} /></label>
            <label className="wide"><span>报名、报到与费用说明</span><textarea rows={3} value={draft.details.signupNote || ""} onChange={(e) => updateRoot("details", { ...draft.details, signupNote: e.target.value })} /></label>
          </div>
        </section>

        <section className="event-management-card">
          <header><div><small>04 · GROUPS</small><h2>参赛组别</h2><p>当前系统默认少年组 U16 与青年组 U20；这里维护每组报名和正赛规模。</p></div><b>{draft.groups.length}组</b></header>
          <div className="event-group-list">{draft.groups.map((group, index) => <article key={group.id}>
            <header><span>{group.code}</span><div><strong>{group.name}</strong><small>{group.status === "active" ? "启用" : "停用"}</small></div></header>
            <div className="event-management-grid compact">
              <label><span>组别名称</span><input value={group.name} onChange={(e) => updateRoot("groups", draft.groups.map((row, i) => i === index ? { ...row, name: e.target.value } : row))} /></label>
              <label><span>组别代码</span><input value={group.code} onChange={(e) => updateRoot("groups", draft.groups.map((row, i) => i === index ? { ...row, code: e.target.value } : row))} /></label>
              <label className="wide"><span>前端年龄规则说明</span><input value={group.ageRuleText || ""} onChange={(e) => updateRoot("groups", draft.groups.map((row, i) => i === index ? { ...row, ageRuleText: e.target.value } : row))} placeholder="例如：2010年7月26日（含）以后出生" /></label>
              <label><span>出生日期下限</span><input type="date" value={group.birthDateFrom || ""} onChange={(e) => updateRoot("groups", draft.groups.map((row, i) => i === index ? { ...row, birthDateFrom: e.target.value } : row))} /></label>
              <label><span>出生日期上限</span><input type="date" value={group.birthDateTo || ""} onChange={(e) => updateRoot("groups", draft.groups.map((row, i) => i === index ? { ...row, birthDateTo: e.target.value } : row))} /></label>
              <label><span>最低年龄</span><input type="number" min="0" value={group.minimumAge ?? ""} onChange={(e) => updateRoot("groups", draft.groups.map((row, i) => i === index ? { ...row, minimumAge: nullableNumber(e.target.value) } : row))} /></label>
              <label><span>报名费（元）</span><input type="number" min="0" step="1" value={group.registrationFeeYuan} onChange={(e) => updateRoot("groups", draft.groups.map((row, i) => i === index ? { ...row, registrationFeeYuan: Number(e.target.value) } : row))} /></label>
              <label><span>报名人数上限</span><input type="number" min="1" value={group.registrationLimit ?? ""} onChange={(e) => updateRoot("groups", draft.groups.map((row, i) => i === index ? { ...row, registrationLimit: nullableNumber(e.target.value) } : row))} placeholder="不限制可留空" /></label>
              <label><span>正赛人数</span><input type="number" min="1" value={group.mainDrawSize ?? ""} onChange={(e) => updateRoot("groups", draft.groups.map((row, i) => i === index ? { ...row, mainDrawSize: nullableNumber(e.target.value) } : row))} /></label>
            </div>
          </article>)}</div>
        </section>

        <section className="event-management-card">
          <header><div><small>05 · ORGANIZATIONS</small><h2>赛事组织机构</h2><p>按照公众概览页当前使用的四类机构统一维护。</p></div></header>
          <div className="event-management-grid">{(Object.keys(organizationLabels) as Array<keyof typeof organizationLabels>).map((type) => <label className="wide" key={type}><span>{organizationLabels[type]}</span><textarea rows={2} value={draft.organizations[type] || ""} onChange={(e) => updateRoot("organizations", { ...draft.organizations, [type]: e.target.value })} placeholder="多个单位可用顿号、逗号分隔" /></label>)}</div>
        </section>

        {data.viewerRole === "system_admin" && <section className="event-management-card">
          <header><div><small>06 · MEMBERS</small><h2>组委会与裁判账号</h2><p>把已经创建的后台账号分配到本站。当前先记录分配关系，下一阶段再启用严格的“只看被分配赛事”权限。</p></div><b>{draft.memberIds?.length ?? 0}人</b></header>
          <div className="event-member-list">{data.assignableAccounts.length ? data.assignableAccounts.map((account) => {
            const checked = assignedAccounts.has(account.id);
            return <label className={checked ? "selected" : ""} key={account.id}>
              <input type="checkbox" checked={checked} disabled={account.status !== "active"} onChange={(e) => updateRoot("memberIds", e.target.checked ? [...(draft.memberIds ?? []), account.id] : (draft.memberIds ?? []).filter((id) => id !== account.id))} />
              <span>{account.displayName.slice(0, 1)}</span>
              <div><strong>{account.displayName}</strong><small>{account.username} · {account.role === "committee" ? "组委会" : "裁判"}</small></div>
              <b>{account.status === "active" ? (checked ? "已分配" : "未分配") : "账号停用"}</b>
            </label>;
          }) : <p className="event-management-empty">还没有可分配的组委会或裁判账号，请先在“账号与日志”中创建。</p>}</div>
        </section>}

        <footer className="event-management-footer"><div><strong>保存范围</strong><span>基本信息、场馆、概览参数、组别、组织机构{data.viewerRole === "system_admin" ? "、赛事成员" : ""}</span></div><button type="submit" disabled={working}>{working ? "正在保存…" : "保存全部设置"}</button></footer>
      </section>
    </form>
  </main>;
}
