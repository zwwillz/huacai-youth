"use client";
/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { useMemo, useState } from "react";
import type { ContentManagementData, ContentManagementInput } from "@/db/content-management";
import type { EventManagementData, EventManagementInput } from "@/db/event-management";

type GroupName = "少年组" | "青年组";
type Tab = "overview" | "regulation";

const DEFAULT_RULE_STANDARD = "执行中国台球协会2026版《华彩十六球比赛规则和竞赛规定（试行）》。";

function toContentDraft(data: ContentManagementData): ContentManagementInput {
  return {
    eventId: data.event.id,
    summary: data.event.summary,
    competitionFormat: data.details.competitionFormat.map((row) => [...row]),
    drawRules: [...data.details.drawRules],
    prizes: {
      少年组: data.details.prizes.少年组.map((row) => [...row]),
      青年组: data.details.prizes.青年组.map((row) => [...row]),
    },
    documents: data.documents.map((row) => ({ documentType: row.documentType as "regulation" | "referee_list", title: row.title, url: row.url, isPublished: row.isPublished })),
    guides: data.guides.map((row) => ({ guideType: row.guideType as "transport" | "clothing", title: row.title, body: row.body, publishStatus: row.publishStatus as "draft" | "published" })),
  };
}

function toEventDraft(data: EventManagementData): EventManagementInput {
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
    sponsors: data.event.sponsors.map((row) => ({ ...row })),
    organizations: { ...data.event.organizations },
    groups: data.event.groups.map((row) => ({ ...row })),
    memberIds: [...data.event.memberIds],
  };
}

async function imageDimensions(file: File) {
  const bitmap = await createImageBitmap(file);
  const result = { width: bitmap.width, height: bitmap.height };
  bitmap.close();
  return result;
}

type UploadResponse = { data?: { url: string }; error?: string };

export default function ContentManagementClient({ initialData, initialEventData }: { initialData: ContentManagementData; initialEventData: EventManagementData }) {
  const [data, setData] = useState(initialData);
  const [eventData, setEventData] = useState(initialEventData);
  const [contentDraft, setContentDraft] = useState<ContentManagementInput>(() => toContentDraft(initialData));
  const [eventDraft, setEventDraft] = useState<EventManagementInput>(() => toEventDraft(initialEventData));
  const [tab, setTab] = useState<Tab>("overview");
  const [working, setWorking] = useState(false);
  const [uploading, setUploading] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const archived = eventDraft.status === "archived";
  const sponsors = eventDraft.sponsors ?? [];
  const regulationPublication = data.publications.find((item) => item.moduleType === "regulation");
  const regulationPublished = regulationPublication?.status === "published";
  const regulationDocument = contentDraft.documents.find((row) => row.documentType === "regulation");
  const organizationText = useMemo(() => Object.values(eventDraft.organizations).filter(Boolean).join(" · "), [eventDraft.organizations]);

  const updateEvent = <K extends keyof EventManagementInput>(key: K, value: EventManagementInput[K]) => setEventDraft((current) => ({ ...current, [key]: value }));
  const updateMeta = (index: number, value: string) => setContentDraft((current) => {
    const drawRules = [...(current.drawRules ?? [])];
    while (drawRules.length < 3) drawRules.push("");
    drawRules[index] = value;
    return { ...current, drawRules };
  });

  const syncContentSave = async (draft = contentDraft) => {
    const response = await fetch("/api/admin/content-management", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "save", data: draft }),
    });
    const payload = await response.json() as { data?: ContentManagementData; error?: string };
    if (!response.ok || !payload.data) throw new Error(payload.error || "内容保存失败。");
    setData(payload.data);
    setContentDraft(toContentDraft(payload.data));
    return payload.data;
  };

  const syncEventSave = async (draft = eventDraft) => {
    const response = await fetch("/api/admin/event-management", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(draft),
    });
    const payload = await response.json() as { data?: EventManagementData; error?: string };
    if (!response.ok || !payload.data) throw new Error(payload.error || "赛事概览保存失败。");
    setEventData(payload.data);
    setEventDraft(toEventDraft(payload.data));
    return payload.data;
  };

  const saveOverview = async (publish = false) => {
    if (archived) return;
    setWorking(true); setNotice(""); setError("");
    try {
      const nextEvent = { ...eventDraft, publishStatus: publish ? "published" as const : eventDraft.publishStatus };
      const nextContent = { ...contentDraft, summary: eventDraft.summary ?? "" };
      const [savedEvent] = await Promise.all([syncEventSave(nextEvent), syncContentSave(nextContent)]);
      setNotice(publish ? "赛事概览已保存并发布到公众端。" : "赛事概览草稿已保存。已发布赛事保持原发布状态。" );
      if (publish) setEventDraft(toEventDraft(savedEvent));
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "赛事概览保存失败。");
    } finally { setWorking(false); }
  };

  const saveRegulation = async () => {
    if (archived) return;
    setWorking(true); setNotice(""); setError("");
    try {
      const next = {
        ...contentDraft,
        summary: eventDraft.summary ?? "",
        drawRules: [contentDraft.drawRules?.[0] ?? "", contentDraft.drawRules?.[1] || DEFAULT_RULE_STANDARD, contentDraft.drawRules?.[2] ?? ""],
      };
      await syncContentSave(next);
      setNotice("竞赛规程概要已保存。完整细则以顶部上传的正式 PDF 为准。" );
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "竞赛规程保存失败。");
    } finally { setWorking(false); }
  };

  const toggleRegulation = async () => {
    if (archived || !regulationPublication) return;
    setWorking(true); setNotice(""); setError("");
    const status = regulationPublished ? "draft" : "published";
    try {
      const response = await fetch("/api/admin/content-management", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "publication", eventId: contentDraft.eventId, publicationId: regulationPublication.id, status }),
      });
      const payload = await response.json() as { data?: ContentManagementData; error?: string };
      if (!response.ok || !payload.data) throw new Error(payload.error || "发布操作失败。");
      setData(payload.data); setContentDraft(toContentDraft(payload.data));
      setNotice(status === "published" ? "竞赛规程概要已发布。" : "竞赛规程已撤回为草稿。" );
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "发布操作失败。");
    } finally { setWorking(false); }
  };

  const uploadAsset = async (file: File, target: string, assetType: string, onDone: (url: string) => void) => {
    if (!file.type.match(/^image\/(jpeg|png|webp)$/)) return setError("图片仅支持 JPG、PNG 或 WebP。");
    if (file.size > 5 * 1024 * 1024) return setError("图片不能超过 5MB。");
    setUploading(target); setNotice(""); setError("");
    try {
      const dimensions = await imageDimensions(file);
      const form = new FormData();
      form.append("eventId", contentDraft.eventId); form.append("assetType", assetType); form.append("width", String(dimensions.width)); form.append("height", String(dimensions.height)); form.append("file", file);
      const response = await fetch("/api/admin/assets", { method: "POST", body: form });
      const payload = await response.json() as UploadResponse;
      if (!response.ok || !payload.data?.url) throw new Error(payload.error || "图片上传失败。");
      onDone(payload.data.url);
      setNotice("图片已上传。保存当前模块后正式绑定到赛事。" );
    } catch (failure) { setError(failure instanceof Error ? failure.message : "图片上传失败。"); }
    finally { setUploading(""); }
  };

  const uploadPdf = async (file: File) => {
    if (file.type !== "application/pdf") return setError("完整竞赛规程请上传 PDF 文件。");
    if (file.size > 15 * 1024 * 1024) return setError("PDF 文件不能超过 15MB。");
    setUploading("regulation-pdf"); setNotice(""); setError("");
    try {
      const form = new FormData(); form.append("eventId", contentDraft.eventId); form.append("assetType", "document_regulation"); form.append("file", file);
      const response = await fetch("/api/admin/assets", { method: "POST", body: form });
      const payload = await response.json() as UploadResponse;
      if (!response.ok || !payload.data?.url) throw new Error(payload.error || "PDF 上传失败。");
      setContentDraft((current) => ({ ...current, documents: current.documents.map((row) => row.documentType === "regulation" ? { ...row, url: payload.data!.url, title: row.title || "完整竞赛规程", isPublished: true } : row) }));
      setNotice("完整竞赛规程 PDF 已上传，请保存竞赛规程完成绑定。" );
    } catch (failure) { setError(failure instanceof Error ? failure.message : "PDF 上传失败。"); }
    finally { setUploading(""); }
  };

  const updateSponsor = (index: number, patch: Partial<NonNullable<EventManagementInput["sponsors"]>[number]>) => updateEvent("sponsors", sponsors.map((row,i) => i === index ? { ...row, ...patch } : row));
  const addSponsor = () => updateEvent("sponsors", [...sponsors, { id: `draft_${Date.now()}`, name: "", sponsorType: "sponsor", logoKey: "", websiteUrl: "", sortOrder: sponsors.length + 1, isPublished: true }]);
  const updateFormat = (index: number, column: number, value: string) => setContentDraft((current) => ({ ...current, competitionFormat: current.competitionFormat.map((row,i) => i === index ? row.map((cell,c) => c === column ? value : cell) : row) }));
  const updatePrize = (group: GroupName, index: number, column: number, value: string) => setContentDraft((current) => ({ ...current, prizes: { ...current.prizes, [group]: current.prizes[group].map((row,i) => i === index ? [0,1,2].map((c) => c === column ? value : (row[c] ?? "")) : row) } }));
  const updateGuide = (guideType: "transport" | "clothing", value: string) => setContentDraft((current) => ({ ...current, guides: current.guides.map((row) => row.guideType === guideType ? { ...row, body: value } : row) }));

  return <main className="publishing-v2-page">
    <section className="publishing-v2-head">
      <div className="publishing-v2-head-copy"><small>CONTENT PUBLISHING</small><h2>内容发布</h2><p>完善公众端的赛事概览与竞赛规程。赛事基础主数据来自“赛事管理”，在这里读取但不重复修改。</p><div className="publishing-v2-tabs"><button className={tab === "overview" ? "active" : ""} type="button" onClick={() => setTab("overview")}>赛事概览</button><button className={tab === "regulation" ? "active" : ""} type="button" onClick={() => setTab("regulation")}>竞赛规程</button></div></div>
      <div className="publishing-v2-head-actions"><span className={tab === "overview" ? (eventDraft.publishStatus === "published" ? "published" : "draft") : (regulationPublished ? "published" : "draft")}>{tab === "overview" ? (eventDraft.publishStatus === "published" ? "概览已发布" : "概览草稿") : (regulationPublished ? "规程已发布" : "规程草稿")}</span>{!archived && tab === "overview" && <><button type="button" onClick={() => saveOverview(false)} disabled={working}>保存草稿</button><button className="primary" type="button" onClick={() => saveOverview(true)} disabled={working}>{working ? "处理中…" : "发布赛事概览"}</button></>}{!archived && tab === "regulation" && <><button type="button" onClick={saveRegulation} disabled={working}>保存草稿</button><button className="primary" type="button" onClick={toggleRegulation} disabled={working}>{regulationPublished ? "撤回发布" : "发布竞赛规程"}</button></>}</div>
    </section>

    {archived && <div className="publishing-v2-readonly">该赛事已经归档，赛事运营内容进入历史只读状态。</div>}
    {notice && <div className="publishing-v2-message success">✓ {notice}<button type="button" onClick={() => setNotice("")}>×</button></div>}
    {error && <div className="publishing-v2-message error">! {error}<button type="button" onClick={() => setError("")}>×</button></div>}

    {tab === "overview" ? <div className="publishing-v2-stack">
      <section className="publishing-v2-card inherited"><header><div><small>01 · MASTER DATA</small><h3>赛事基础信息</h3><p>以下内容从赛事管理同步，仅供查看。</p></div><Link href={`/admin/events/${eventDraft.eventId}`}>修改赛事基本信息 →</Link></header><div className="publishing-v2-read-grid"><div><span>完整赛事名称</span><strong>{eventDraft.fullTitle}</strong></div><div><span>赛季 / 站次</span><strong>{eventDraft.year}赛季 · 第{eventDraft.stationNo}站</strong></div><div><span>城市</span><strong>{eventDraft.city}</strong></div><div><span>比赛日期</span><strong>{eventDraft.startDate} — {eventDraft.endDate}</strong></div><div><span>参赛组别</span><strong>{eventDraft.groups.filter((row) => row.status === "active").map((row) => `${row.name} ${row.code}`).join(" · ")}</strong></div><div><span>赛事组织机构</span><strong>{organizationText || "待完善"}</strong></div></div></section>

      <section className="publishing-v2-card"><header><div><small>02 · DISPLAY</small><h3>前端展示信息</h3><p>前端简称和赛事简介用于赛事列表、移动端标题和概览首屏。</p></div></header><div className="publishing-v2-grid"><label className="wide"><span>前端显示简称</span><input disabled={archived} value={eventDraft.shortTitle} onChange={(e) => updateEvent("shortTitle", e.target.value)} /></label><label className="wide"><span>赛事简介</span><textarea disabled={archived} rows={5} value={eventDraft.summary || ""} onChange={(e) => updateEvent("summary", e.target.value)} placeholder="用一到两段话说明本站赛事重点" /></label></div></section>

      <section className="publishing-v2-card"><header><div><small>03 · VENUE & PARAMETERS</small><h3>比赛信息与主要参数</h3><p>用于公众端概要展示，不参与创建赛事。</p></div></header><div className="publishing-v2-grid"><label className="wide"><span>比赛场馆</span><input disabled={archived} value={eventDraft.venue.name} onChange={(e) => updateEvent("venue", { ...eventDraft.venue, name: e.target.value })} /></label><label><span>省 / 直辖市</span><input disabled={archived} value={eventDraft.venue.province || ""} onChange={(e) => updateEvent("venue", { ...eventDraft.venue, province: e.target.value })} /></label><label><span>区 / 县</span><input disabled={archived} value={eventDraft.venue.district || ""} onChange={(e) => updateEvent("venue", { ...eventDraft.venue, district: e.target.value })} /></label><label className="wide"><span>详细地址</span><input disabled={archived} value={eventDraft.venue.address || ""} onChange={(e) => updateEvent("venue", { ...eventDraft.venue, address: e.target.value })} /></label><label><span>赛事时长</span><input disabled={archived} value={eventDraft.details.durationLabel || ""} onChange={(e) => updateEvent("details", { ...eventDraft.details, durationLabel: e.target.value })} placeholder="例如：11天" /></label><label><span>总奖金</span><input disabled={archived} value={eventDraft.details.totalPrizeLabel || ""} onChange={(e) => updateEvent("details", { ...eventDraft.details, totalPrizeLabel: e.target.value })} placeholder="例如：¥350,400" /></label><label><span>资格赛日期说明</span><input disabled={archived} value={eventDraft.details.qualifierDateLabel || ""} onChange={(e) => updateEvent("details", { ...eventDraft.details, qualifierDateLabel: e.target.value })} /></label><label><span>正赛日期说明</span><input disabled={archived} value={eventDraft.details.mainDateLabel || ""} onChange={(e) => updateEvent("details", { ...eventDraft.details, mainDateLabel: e.target.value })} /></label><label className="wide"><span>正赛规模</span><input disabled={archived} value={eventDraft.details.mainSizeLabel || ""} onChange={(e) => updateEvent("details", { ...eventDraft.details, mainSizeLabel: e.target.value })} placeholder="例如：每组64人" /></label></div></section>

      <section className="publishing-v2-card"><header><div><small>04 · VISUAL & PARTNERS</small><h3>主题图与合作伙伴</h3><p>主题图用于赛事列表和概览首屏；合作伙伴按本站独立维护。</p></div><button type="button" disabled={archived} onClick={addSponsor}>＋ 添加合作伙伴</button></header><div className="publishing-v2-visual"><div className="publishing-v2-cover">{eventDraft.coverImageKey?.trim() ? <img src={eventDraft.coverImageKey} alt="赛事主题图" /> : <div><span>图</span><strong>尚未设置主题图</strong><small>未上传时使用默认视觉</small></div>}<label><input type="file" accept="image/jpeg,image/png,image/webp" disabled={archived || Boolean(uploading)} onChange={(e) => { const file=e.target.files?.[0]; if(file) void uploadAsset(file,"cover","cover",(url)=>updateEvent("coverImageKey",url)); e.currentTarget.value=""; }} />{uploading === "cover" ? "正在上传…" : "上传 / 更换主题图"}</label></div><div className="publishing-v2-sponsor-list">{sponsors.length ? sponsors.map((sponsor,index) => <article key={sponsor.id || index}><div className="publishing-v2-logo">{sponsor.logoKey?.trim() ? <img src={sponsor.logoKey} alt={sponsor.name || "合作伙伴"} /> : <span>LOGO</span>}</div><div className="publishing-v2-sponsor-fields"><input disabled={archived} value={sponsor.name} onChange={(e) => updateSponsor(index,{name:e.target.value})} placeholder="合作伙伴名称" /><select disabled={archived} value={sponsor.sponsorType} onChange={(e) => updateSponsor(index,{sponsorType:e.target.value})}><option value="title">冠名赞助</option><option value="sponsor">合作伙伴</option><option value="equipment">指定器材</option><option value="support">支持品牌</option></select><label className="mini-upload"><input type="file" accept="image/jpeg,image/png,image/webp" disabled={archived || Boolean(uploading)} onChange={(e)=>{const file=e.target.files?.[0];if(file) void uploadAsset(file,`sponsor-${index}`,"sponsor_logo",(url)=>updateSponsor(index,{logoKey:url}));e.currentTarget.value="";}} />{uploading === `sponsor-${index}` ? "上传中…" : "上传 Logo"}</label><button type="button" disabled={archived} onClick={() => updateEvent("sponsors", sponsors.filter((_,i) => i !== index))}>移除</button></div></article>) : <div className="publishing-v2-empty-inline">暂无合作伙伴，可按需添加。</div>}</div></div></section>

      <section className="publishing-v2-card"><header><div><small>05 · PARTICIPANT TIPS</small><h3>参赛提示</h3><p>保持简短，前端没有内容时对应提示不显示。</p></div></header><div className="publishing-v2-grid">{contentDraft.guides.map((guide) => <label className="wide" key={guide.guideType}><span>{guide.title}</span><textarea disabled={archived} rows={4} value={guide.body} onChange={(e) => updateGuide(guide.guideType as "transport" | "clothing", e.target.value)} placeholder={guide.guideType === "transport" ? "交通、住宿、报到等实用提示" : "资格赛、正赛服装要求等提示"} /></label>)}</div></section>
    </div> : <div className="publishing-v2-stack regulation">
      <section className="publishing-v2-pdf"><div><span>PDF</span><div><small>完整正式文件</small><h3>完整竞赛规程</h3><p>公众端的页面只展示核心概要；完整规则、细则和解释以正式 PDF 为准。</p></div></div><div className="publishing-v2-pdf-actions">{regulationDocument?.url ? <a href={regulationDocument.url} target="_blank" rel="noreferrer">查看当前 PDF ↗</a> : <em>尚未上传</em>}{!archived && <label><input type="file" accept="application/pdf" disabled={Boolean(uploading)} onChange={(e) => { const file=e.target.files?.[0];if(file) void uploadPdf(file);e.currentTarget.value=""; }} />{uploading === "regulation-pdf" ? "正在上传…" : regulationDocument?.url ? "更换 PDF" : "上传 PDF"}</label>}</div></section>

      <section className="publishing-v2-card"><header><div><small>01 · ENTRY REQUIREMENTS</small><h3>报名要求</h3><p>只保留用户报名时真正需要了解的资格要求，不展开报到、抽签等流程。</p></div></header><div className="publishing-v2-grid"><label className="wide"><span>报名要求概要</span><textarea disabled={archived} rows={6} value={contentDraft.drawRules?.[0] ?? ""} onChange={(e) => updateMeta(0,e.target.value)} placeholder="建议按行填写：年龄要求、禁赛限制、体检保险、未成年人陪同、跨组规则等" /></label></div></section>

      <section className="publishing-v2-card"><header><div><small>02 · RULE STANDARD</small><h3>比赛规则</h3><p>概要页面只说明采用的正式规则版本，不复制展开具体击球、暂停、限时等条款。</p></div></header><div className="publishing-v2-rule-standard"><strong>规则标准</strong><textarea disabled={archived} rows={3} value={contentDraft.drawRules?.[1] || DEFAULT_RULE_STANDARD} onChange={(e) => updateMeta(1,e.target.value)} /></div></section>

      <section className="publishing-v2-card"><header><div><small>03 · FORMAT</small><h3>赛制</h3><p>用列表概括各阶段赛制、局数和晋级方式。</p></div>{!archived && <button type="button" onClick={() => setContentDraft((current) => ({ ...current, competitionFormat:[...current.competitionFormat,["新阶段","","",""]] }))}>＋ 增加阶段</button>}</header><div className="publishing-v2-format"><div className="publishing-v2-format-head"><span>阶段</span><span>赛制 / 晋级</span><span>少年组</span><span>青年组</span><span /></div>{contentDraft.competitionFormat.map((row,index) => <div className="publishing-v2-format-row" key={index}>{[0,1,2,3].map((column) => <input disabled={archived} key={column} value={row[column] ?? ""} onChange={(e) => updateFormat(index,column,e.target.value)} />)}{!archived && <button type="button" onClick={() => setContentDraft((current) => ({ ...current, competitionFormat:current.competitionFormat.filter((_,i)=>i!==index) }))}>×</button>}</div>)}</div></section>

      <section className="publishing-v2-card"><header><div><small>04 · PRIZE</small><h3>奖励设置</h3><p>以奖金表格为主，奖杯、证书、球杆等作为辅助奖励填写。</p></div></header><div className="publishing-v2-prizes">{(["少年组","青年组"] as GroupName[]).map((group) => <article key={group}><header><div><strong>{group}</strong><span>{group === "少年组" ? "U16" : "U20"}</span></div>{!archived && <button type="button" onClick={() => setContentDraft((current) => ({ ...current, prizes:{...current.prizes,[group]:[...current.prizes[group],["名次","",""]]} }))}>＋ 增加名次</button>}</header><div className="publishing-v2-prize-head"><span>名次</span><span>奖金</span><span>其他奖励</span><span /></div>{contentDraft.prizes[group].map((row,index) => <div className="publishing-v2-prize-row" key={index}>{[0,1,2].map((column) => <input disabled={archived} key={column} value={row[column] ?? ""} onChange={(e) => updatePrize(group,index,column,e.target.value)} placeholder={column===0 ? "冠军 / 8强" : column===1 ? "¥50,000" : "奖杯、证书、球杆"} />)}{!archived && <button type="button" onClick={() => setContentDraft((current) => ({ ...current, prizes:{...current.prizes,[group]:current.prizes[group].filter((_,i)=>i!==index)} }))}>×</button>}</div>)}</article>)}</div><label className="publishing-v2-note"><span>奖励说明</span><textarea disabled={archived} rows={3} value={contentDraft.drawRules?.[2] ?? ""} onChange={(e) => updateMeta(2,e.target.value)} placeholder="例如：以上奖金均为税前奖金；需完成比赛方可领取对应名次奖金。" /></label></section>
    </div>}

    {!archived && <footer className="publishing-v2-footer"><div><strong>{tab === "overview" ? "赛事概览" : "竞赛规程"}</strong><span>{tab === "overview" ? "保存不会自动改变已经发布的赛事状态；首次公开请使用“发布赛事概览”。" : "概要保持简洁，完整规则始终以正式 PDF 为准。"}</span></div><button type="button" onClick={() => tab === "overview" ? saveOverview(false) : saveRegulation()} disabled={working}>{working ? "正在保存…" : "保存当前模块"}</button></footer>}
  </main>;
}
