"use client";
/* eslint-disable @next/next/no-img-element */

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

const sponsorTypeOptions = [
  ["title", "冠名赞助"],
  ["sponsor", "合作伙伴"],
  ["equipment", "指定器材"],
  ["support", "支持品牌"],
] as const;

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
    venue: {
      name: data.event.venue.name,
      province: data.event.venue.province,
      city: data.event.venue.city,
      district: data.event.venue.district,
      address: data.event.venue.address,
      tableCount: data.event.venue.tableCount,
    },
    details: { ...data.event.details },
    sponsors: data.event.sponsors.map((sponsor) => ({ ...sponsor })),
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
  const sponsors = draft.sponsors ?? [];
  const isRegistrationStage = draft.status === "registration_open" || draft.status === "registration_closed";
  const isCompetitionStage = draft.status === "in_progress" || draft.status === "finished";
  const eventIsPublic = draft.publishStatus === "published";
  const modulePublished = (moduleType: string) => data.publicationStatuses[moduleType] === "published";

  const frontModules = [
    { name: "赛事概览", visible: eventIsPublic, note: "赛事发布后始终作为详情首页" },
    { name: "报名", visible: eventIsPublic && isRegistrationStage, note: draft.status === "registration_open" ? "显示报名入口、时间、费用和组别" : "保留报名须知并显示“报名已截止”" },
    { name: "竞赛规程", visible: eventIsPublic && modulePublished("regulation"), note: "内容发布后出现" },
    { name: "赛程", visible: eventIsPublic && isCompetitionStage && modulePublished("schedule"), note: "比赛阶段开始且赛程已发布后出现" },
    { name: "对阵", visible: eventIsPublic && isCompetitionStage && modulePublished("matches"), note: "比赛阶段开始且对阵已发布后出现" },
    { name: "排名", visible: eventIsPublic && isCompetitionStage && modulePublished("rankings"), note: "排名模块发布后出现" },
  ];

  const readiness = [
    { label: "赛事名称、日期与场馆", ok: Boolean(draft.fullTitle.trim() && draft.startDate && draft.endDate && draft.venue.name.trim()) },
    { label: "赛事主题图片", ok: Boolean(draft.coverImageKey?.trim()) },
    { label: "少年组 / 青年组参数", ok: draft.groups.length > 0 && draft.groups.every((group) => group.name.trim() && group.code.trim()) },
    { label: "赞助商 Logo 区域", ok: sponsors.some((sponsor) => sponsor.isPublished && sponsor.name.trim() && sponsor.logoKey?.trim()) },
    { label: "报名起止时间", ok: draft.status !== "registration_open" || Boolean(draft.registrationStartAt && draft.registrationEndAt) },
  ];

  const updateRoot = <K extends keyof EventManagementInput>(key: K, value: EventManagementInput[K]) => {
    setDraft((current) => ({ ...current, [key]: value }));
  };

  const updateSponsor = (index: number, patch: Partial<NonNullable<EventManagementInput["sponsors"]>[number]>) => {
    updateRoot("sponsors", sponsors.map((sponsor, sponsorIndex) => sponsorIndex === index ? { ...sponsor, ...patch } : sponsor));
  };

  const addSponsor = () => {
    updateRoot("sponsors", [...sponsors, {
      id: `draft_${Date.now()}`,
      name: "",
      sponsorType: "sponsor",
      logoKey: "",
      websiteUrl: "",
      sortOrder: sponsors.length + 1,
      isPublished: true,
    }]);
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
      setNotice("赛事完整设置已保存到 Supabase，包括主视觉、赞助商和报名阶段设置。");
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
        <span>赛事管理 / 完整设置 · Beta</span>
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
        <div className="event-management-tip"><strong>报名不是另一套赛事页面</strong><p>同一场赛事只维护一份主数据。报名中时，赛事详情在概览基础上增加“报名”入口和报名信息；赛程、对阵、排名没有发布前不显示空标签。</p></div>
      </aside>

      <section className="event-management-content">
        {notice && <div className="event-management-message success">✓ {notice}<button type="button" onClick={() => setNotice("")}>×</button></div>}
        {error && <div className="event-management-message error">! {error}<button type="button" onClick={() => setError("")}>×</button></div>}

        <section className="event-management-card">
          <header><div><small>01 · BASIC</small><h2>基本信息</h2><p>所有分站使用同一套字段和发布流程，避免不同分站后台结构不一致。</p></div><b>必填</b></header>
          <div className="event-management-grid">
            <label className="wide"><span>完整赛事名称</span><input value={draft.fullTitle} onChange={(e) => updateRoot("fullTitle", e.target.value)} required /></label>
            <label className="wide"><span>前端显示简称</span><input value={draft.shortTitle} onChange={(e) => updateRoot("shortTitle", e.target.value)} required /></label>
            <label><span>赛季年份</span><input type="number" min="2025" max="2100" value={draft.year} onChange={(e) => updateRoot("year", Number(e.target.value))} required /></label>
            <label><span>第几站</span><input type="number" min="1" value={draft.stationNo} onChange={(e) => updateRoot("stationNo", Number(e.target.value))} required /></label>
            <label><span>城市</span><input value={draft.city} onChange={(e) => updateRoot("city", e.target.value)} placeholder="例如：河北廊坊" required /></label>
            <label><span>赛事状态</span><select value={draft.status} onChange={(e) => updateRoot("status", e.target.value as EventManagementInput["status"])}>{statusOptions.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
            <label><span>比赛开始日期</span><input type="date" value={draft.startDate} onChange={(e) => updateRoot("startDate", e.target.value)} required /></label>
            <label><span>比赛结束日期</span><input type="date" value={draft.endDate} onChange={(e) => updateRoot("endDate", e.target.value)} required /></label>
            <label><span>前端发布状态</span><select value={draft.publishStatus} onChange={(e) => updateRoot("publishStatus", e.target.value as EventManagementInput["publishStatus"])}><option value="draft">草稿</option><option value="published">已发布</option></select></label>
            <label><span>URL 标识</span><input value={data.event.slug} disabled /></label>
            <label className="wide"><span>赛事简介</span><textarea rows={4} value={draft.summary || ""} onChange={(e) => updateRoot("summary", e.target.value)} placeholder="用于赛事概览的简要说明" /></label>
          </div>
        </section>

        <section className="event-management-card">
          <header><div><small>02 · VISUAL</small><h2>赛事主题图片与赞助商</h2><p>每个分站使用自己的主视觉。报名阶段和正式赛事详情沿用同一张主题图，避免重复维护两套页面。</p></div><b>发布前建议完善</b></header>
          <div className="event-brand-layout">
            <div className="event-theme-editor">
              <div className={draft.coverImageKey?.trim() ? "event-theme-preview has-image" : "event-theme-preview"}>
                {draft.coverImageKey?.trim() ? <img src={draft.coverImageKey} alt="赛事主题图片预览" /> : <div><span>图</span><strong>赛事主题图片</strong><small>建议 16:9 · 1600×900 以上</small></div>}
              </div>
              <label><span>主题图片地址 / 文件路径</span><input value={draft.coverImageKey || ""} onChange={(e) => updateRoot("coverImageKey", e.target.value)} placeholder="例如：/events/2026-jinan-cover.jpg" /></label>
              <p>当前 Beta 先保存图片地址；后续接入对象存储上传按钮时继续使用同一字段，不需要重新改赛事数据结构。移动端会自动裁切，关键信息建议放在画面中央安全区。</p>
            </div>
            <div className="event-publish-check"><header><strong>赛事发布前检查</strong><span>{readiness.filter((item) => item.ok).length} / {readiness.length}</span></header>{readiness.map((item) => <div key={item.label} className={item.ok ? "ok" : "pending"}><i>{item.ok ? "✓" : "!"}</i><span>{item.label}</span><b>{item.ok ? "已完成" : "待完善"}</b></div>)}</div>
          </div>
          <div className="event-sponsor-head"><div><strong>赞助商 Logo 区域</strong><span>按当前顺序展示在赛事概览底部；每站独立维护。</span></div><button type="button" onClick={addSponsor}>＋ 添加赞助商</button></div>
          <div className="event-sponsor-list">{sponsors.length ? sponsors.map((sponsor, index) => <article key={sponsor.id || index}>
            <div className="event-sponsor-preview">{sponsor.logoKey?.trim() ? <img src={sponsor.logoKey} alt={`${sponsor.name || "赞助商"} Logo`} /> : <span>LOGO</span>}</div>
            <div className="event-sponsor-fields">
              <label><span>品牌名称</span><input value={sponsor.name} onChange={(e) => updateSponsor(index, { name: e.target.value })} placeholder="例如：星牌" /></label>
              <label><span>赞助类型</span><select value={sponsor.sponsorType} onChange={(e) => updateSponsor(index, { sponsorType: e.target.value })}>{sponsorTypeOptions.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
              <label className="wide"><span>Logo 图片地址 / 文件路径</span><input value={sponsor.logoKey || ""} onChange={(e) => updateSponsor(index, { logoKey: e.target.value })} placeholder="例如：/sponsors/xingpai.png" /></label>
              <label className="wide"><span>品牌官网（可选）</span><input value={sponsor.websiteUrl || ""} onChange={(e) => updateSponsor(index, { websiteUrl: e.target.value })} placeholder="https://" /></label>
            </div>
            <div className="event-sponsor-actions"><label><input type="checkbox" checked={sponsor.isPublished} onChange={(e) => updateSponsor(index, { isPublished: e.target.checked })} />前端展示</label><button type="button" onClick={() => updateRoot("sponsors", sponsors.filter((_, sponsorIndex) => sponsorIndex !== index))}>移除</button></div>
          </article>) : <p className="event-management-empty">当前分站还没有单独配置赞助商 Logo。点击“添加赞助商”建立本站的合作伙伴展示区域。</p>}</div>
        </section>

        <section className="event-management-card">
          <header><div><small>03 · VENUE</small><h2>比赛场馆</h2><p>场馆地址与球台数量为之后排赛和台号管理提供基础。</p></div></header>
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
          <header><div><small>04 · REGISTRATION & LIFECYCLE</small><h2>报名与前端页面阶段</h2><p>赛事中心始终是同一场赛事；随着状态变化，逐步增加报名、赛程、对阵和排名内容。</p></div><b>{statusOptions.find(([value]) => value === draft.status)?.[1]}</b></header>
          <div className="event-management-grid event-registration-fields">
            <label><span>报名开始时间</span><input type="datetime-local" value={draft.registrationStartAt || ""} onChange={(e) => updateRoot("registrationStartAt", e.target.value)} /></label>
            <label><span>报名截止时间</span><input type="datetime-local" value={draft.registrationEndAt || ""} onChange={(e) => updateRoot("registrationEndAt", e.target.value)} /></label>
            <label className="wide"><span>报名、报到与费用说明</span><textarea rows={3} value={draft.details.signupNote || ""} onChange={(e) => updateRoot("details", { ...draft.details, signupNote: e.target.value })} placeholder="报名时间、报到时间、参赛费、食宿等说明" /></label>
          </div>
          <div className="event-lifecycle-note"><span>推荐逻辑</span><p><strong>报名中：</strong>赛事卡片标记“报名中”，点击仍进入同一赛事详情；概览上增加醒目的报名入口。<strong>没有内容的赛程 / 对阵 / 排名标签直接隐藏</strong>，而不是显示空页面。若用户通过旧链接直接访问未发布模块，再显示“尚未发布”的提示页。</p></div>
          <div className="event-module-preview"><header><div><strong>当前状态下的前端标签预览</strong><span>由“赛事状态 + 内容发布状态”共同决定</span></div></header><div>{frontModules.map((item) => <article className={item.visible ? "visible" : "hidden"} key={item.name}><i>{item.visible ? "显" : "隐"}</i><div><strong>{item.name}</strong><span>{item.note}</span></div><b>{item.visible ? "显示" : "暂不显示"}</b></article>)}</div></div>
        </section>

        <section className="event-management-card">
          <header><div><small>05 · DISPLAY</small><h2>赛事概览参数</h2><p>维护赛事详情页的结构化摘要；完整规程、文件和比赛内容仍由“内容发布”管理。</p></div></header>
          <div className="event-management-grid">
            <label><span>冠名 / 赞助展示</span><input value={draft.details.sponsorLabel || ""} onChange={(e) => updateRoot("details", { ...draft.details, sponsorLabel: e.target.value })} placeholder="例如：铧一 · 星牌 · 南匠" /></label>
            <label><span>赛事时长</span><input value={draft.details.durationLabel || ""} onChange={(e) => updateRoot("details", { ...draft.details, durationLabel: e.target.value })} placeholder="例如：11天" /></label>
            <label><span>资格赛日期说明</span><input value={draft.details.qualifierDateLabel || ""} onChange={(e) => updateRoot("details", { ...draft.details, qualifierDateLabel: e.target.value })} /></label>
            <label><span>正赛日期说明</span><input value={draft.details.mainDateLabel || ""} onChange={(e) => updateRoot("details", { ...draft.details, mainDateLabel: e.target.value })} /></label>
            <label><span>总奖金展示</span><input value={draft.details.totalPrizeLabel || ""} onChange={(e) => updateRoot("details", { ...draft.details, totalPrizeLabel: e.target.value })} placeholder="例如：¥350,400" /></label>
            <label><span>正赛规模展示</span><input value={draft.details.mainSizeLabel || ""} onChange={(e) => updateRoot("details", { ...draft.details, mainSizeLabel: e.target.value })} placeholder="例如：每组64人" /></label>
            <label className="wide"><span>年龄 / 监护说明</span><textarea rows={3} value={draft.details.minimumAgeNote || ""} onChange={(e) => updateRoot("details", { ...draft.details, minimumAgeNote: e.target.value })} /></label>
          </div>
        </section>

        <section className="event-management-card">
          <header><div><small>06 · GROUPS</small><h2>参赛组别</h2><p>当前系统默认少年组 U16 与青年组 U20；每个分站都使用相同的组别设置结构。</p></div><b>{draft.groups.length}组</b></header>
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
          <header><div><small>07 · ORGANIZATIONS</small><h2>赛事组织机构</h2><p>按照公众概览页当前使用的四类机构统一维护。</p></div></header>
          <div className="event-management-grid">{(Object.keys(organizationLabels) as Array<keyof typeof organizationLabels>).map((type) => <label className="wide" key={type}><span>{organizationLabels[type]}</span><textarea rows={2} value={draft.organizations[type] || ""} onChange={(e) => updateRoot("organizations", { ...draft.organizations, [type]: e.target.value })} placeholder="多个单位可用顿号、逗号分隔" /></label>)}</div>
        </section>

        {data.viewerRole === "system_admin" && <section className="event-management-card">
          <header><div><small>08 · MEMBERS</small><h2>组委会与裁判账号</h2><p>把已经创建的后台账号分配到本站。当前先记录分配关系，下一阶段再启用严格的“只看被分配赛事”权限。</p></div><b>{draft.memberIds?.length ?? 0}人</b></header>
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

        <footer className="event-management-footer"><div><strong>保存范围</strong><span>基本信息、主题图、赞助商、场馆、报名阶段、概览参数、组别、组织机构{data.viewerRole === "system_admin" ? "、赛事成员" : ""}</span></div><button type="submit" disabled={working}>{working ? "正在保存…" : "保存全部设置"}</button></footer>
      </section>
    </form>
  </main>;
}
