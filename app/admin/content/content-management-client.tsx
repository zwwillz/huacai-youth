"use client";
/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { useMemo, useState } from "react";
import type { ContentManagementData, ContentManagementInput } from "@/db/content-management";
import type { EventManagementData, EventManagementInput } from "@/db/event-management";

type GroupName = "少年组" | "青年组";
type DocumentType = "regulation" | "referee_list";
type Tab = "overview" | "regulation";

const DEFAULT_RULE_STANDARD = "执行中国台球协会2026版《华彩十六球比赛规则和竞赛规定（试行）》，全程采用三角框摆球。";
const DEFAULT_COMMON_REQUIREMENT = "最低6周岁；未满14周岁须由成年人陪同，14至18周岁单独参赛须提供家长责任书。";
const documentMeta: Record<DocumentType, { title: string; note: string }> = {
  regulation: { title: "完整竞赛规程", note: "公众端概要页顶部提供完整文件查看与下载。" },
  referee_list: { title: "裁判组名单", note: "官方裁判名单可独立上传，并按需在公众端显示。" },
};

function toContentDraft(data: ContentManagementData): ContentManagementInput {
  return {
    eventId: data.event.id,
    summary: data.event.summary,
    competitionFormat: data.details.competitionFormat.map((row) => [...row]),
    drawRules: [...data.details.drawRules],
    ruleStandard: data.details.ruleStandard,
    prizeNote: data.details.prizeNote,
    prizes: {
      少年组: data.details.prizes.少年组.map((row) => [...row]),
      青年组: data.details.prizes.青年组.map((row) => [...row]),
    },
    documents: data.documents.map((row) => ({
      documentType: row.documentType as DocumentType,
      title: row.title,
      url: row.url,
      isPublished: row.isPublished,
    })),
    guides: data.guides.map((row) => ({
      guideType: row.guideType as "transport" | "clothing",
      title: row.title,
      body: row.body,
      publishStatus: row.publishStatus as "draft" | "published",
    })),
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
  const [contentDraft, setContentDraft] = useState<ContentManagementInput>(() => toContentDraft(initialData));
  const [eventDraft, setEventDraft] = useState<EventManagementInput>(() => toEventDraft(initialEventData));
  const [tab, setTab] = useState<Tab>("overview");
  const [working, setWorking] = useState(false);
  const [uploading, setUploading] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const archived = eventDraft.status === "archived";
  const sponsors = eventDraft.sponsors ?? [];
  const activeGroups = eventDraft.groups.filter((group) => group.status === "active");
  const regulationPublication = data.publications.find((item) => item.moduleType === "regulation");
  const regulationPublished = regulationPublication?.status === "published";
  const organizationText = useMemo(() => Object.values(eventDraft.organizations).filter(Boolean).join(" · "), [eventDraft.organizations]);

  const updateEvent = <K extends keyof EventManagementInput>(key: K, value: EventManagementInput[K]) => setEventDraft((current) => ({ ...current, [key]: value }));
  const updateGroup = (index: number, patch: Partial<EventManagementInput["groups"][number]>) => updateEvent("groups", eventDraft.groups.map((row, rowIndex) => rowIndex === index ? { ...row, ...patch } : row));
  const updateDocument = (type: DocumentType, patch: Partial<ContentManagementInput["documents"][number]>) => setContentDraft((current) => ({ ...current, documents: current.documents.map((row) => row.documentType === type ? { ...row, ...patch } : row) }));
  const updateGuide = (type: "transport" | "clothing", patch: Partial<ContentManagementInput["guides"][number]>) => setContentDraft((current) => ({ ...current, guides: current.guides.map((row) => row.guideType === type ? { ...row, ...patch } : row) }));
  const updateFormat = (index: number, column: number, value: string) => setContentDraft((current) => ({ ...current, competitionFormat: current.competitionFormat.map((row, rowIndex) => rowIndex === index ? row.map((cell, cellIndex) => cellIndex === column ? value : cell) : row) }));
  const updatePrize = (group: GroupName, index: number, column: number, value: string) => setContentDraft((current) => ({ ...current, prizes: { ...current.prizes, [group]: current.prizes[group].map((row, rowIndex) => rowIndex === index ? [0, 1, 2].map((cellIndex) => cellIndex === column ? value : (row[cellIndex] ?? "")) : row) } }));

  const syncContentSave = async (draft = contentDraft) => {
    const response = await fetch("/api/admin/content-management", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "save", data: draft }) });
    const payload = await response.json() as { data?: ContentManagementData; error?: string };
    if (!response.ok || !payload.data) throw new Error(payload.error || "内容保存失败。");
    setData(payload.data);
    setContentDraft(toContentDraft(payload.data));
    return payload.data;
  };

  const syncEventSave = async (draft = eventDraft) => {
    const response = await fetch("/api/admin/event-management", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(draft) });
    const payload = await response.json() as { data?: EventManagementData; error?: string };
    if (!response.ok || !payload.data) throw new Error(payload.error || "赛事资料保存失败。");
    setEventDraft(toEventDraft(payload.data));
    return payload.data;
  };

  const saveOverview = async (publication?: "published" | "draft") => {
    if (archived) return;
    setWorking(true); setNotice(""); setError("");
    try {
      const publishStatus = publication ?? eventDraft.publishStatus;
      const nextEvent = { ...eventDraft, publishStatus };
      await Promise.all([syncEventSave(nextEvent), syncContentSave({ ...contentDraft, summary: eventDraft.summary ?? "" })]);
      if (publication === "published") setNotice("赛事概览已保存并发布到公众端。");
      else if (publication === "draft") setNotice("赛事概览已取消发布，公众前端将不再显示本站；已填写内容仍保存在后台。");
      else setNotice("赛事概览已保存。");
    } catch (failure) { setError(failure instanceof Error ? failure.message : "赛事概览保存失败。"); }
    finally { setWorking(false); }
  };

  const saveRegulation = async () => {
    if (archived) return;
    setWorking(true); setNotice(""); setError("");
    try {
      const nextContent = { ...contentDraft, summary: eventDraft.summary ?? "", ruleStandard: contentDraft.ruleStandard.trim() || DEFAULT_RULE_STANDARD };
      await Promise.all([syncContentSave(nextContent), syncEventSave(eventDraft)]);
      setNotice(regulationPublished ? "竞赛规程已保存，公众端已同步更新。" : "竞赛规程已保存为后台草稿。");
    } catch (failure) { setError(failure instanceof Error ? failure.message : "竞赛规程保存失败。"); }
    finally { setWorking(false); }
  };

  const toggleRegulation = async () => {
    if (archived || !regulationPublication) return;
    setWorking(true); setNotice(""); setError("");
    const status = regulationPublished ? "draft" : "published";
    try {
      const nextContent = { ...contentDraft, summary: eventDraft.summary ?? "", ruleStandard: contentDraft.ruleStandard.trim() || DEFAULT_RULE_STANDARD };
      await Promise.all([syncContentSave(nextContent), syncEventSave(eventDraft)]);
      const response = await fetch("/api/admin/content-management", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "publication", eventId: contentDraft.eventId, publicationId: regulationPublication.id, status }) });
      const payload = await response.json() as { data?: ContentManagementData; error?: string };
      if (!response.ok || !payload.data) throw new Error(payload.error || "发布操作失败。");
      setData(payload.data); setContentDraft(toContentDraft(payload.data));
      setNotice(status === "published" ? "竞赛规程已保存并发布到公众端。" : "竞赛规程已撤回发布，公众端将显示待组委会发布提示；已填写内容仍保存在后台。");
    } catch (failure) { setError(failure instanceof Error ? failure.message : "发布操作失败。"); }
    finally { setWorking(false); }
  };

  const uploadAsset = async (file: File, target: string, assetType: string, onDone: (url: string) => void) => {
    if (!file.type.match(/^image\/(jpeg|png|webp)$/)) return setError("图片仅支持 JPG、PNG 或 WebP。");
    if (file.size > 5 * 1024 * 1024) return setError("图片不能超过5MB。");
    setUploading(target); setNotice(""); setError("");
    try {
      const dimensions = await imageDimensions(file);
      const form = new FormData();
      form.append("eventId", contentDraft.eventId); form.append("assetType", assetType); form.append("width", String(dimensions.width)); form.append("height", String(dimensions.height)); form.append("file", file);
      const response = await fetch("/api/admin/assets", { method: "POST", body: form });
      const payload = await response.json() as UploadResponse;
      if (!response.ok || !payload.data?.url) throw new Error(payload.error || "图片上传失败。");
      onDone(payload.data.url);
      if (assetType === "cover") {
        const ratio = dimensions.width / Math.max(1, dimensions.height);
        const warning = ratio < 0.68 || ratio > 0.86 ? " 当前图片不是接近3:4，前端会自动裁切，请重点检查手机端预览。" : " 图片比例适合作为赛事主题图。";
        setNotice(`主题图已上传（${dimensions.width}×${dimensions.height}）。${warning}`);
      } else setNotice(`Logo 已上传（${dimensions.width}×${dimensions.height}），保存赛事概览后正式绑定。`);
    } catch (failure) { setError(failure instanceof Error ? failure.message : "图片上传失败。"); }
    finally { setUploading(""); }
  };

  const uploadPdf = async (type: DocumentType, file: File) => {
    if (file.type !== "application/pdf") return setError("赛事文件请上传 PDF。");
    if (file.size > 15 * 1024 * 1024) return setError("PDF 文件不能超过15MB。");
    setUploading(`pdf-${type}`); setNotice(""); setError("");
    try {
      const form = new FormData(); form.append("eventId", contentDraft.eventId); form.append("assetType", `document_${type}`); form.append("file", file);
      const response = await fetch("/api/admin/assets", { method: "POST", body: form });
      const payload = await response.json() as UploadResponse;
      if (!response.ok || !payload.data?.url) throw new Error(payload.error || "PDF 上传失败。");
      updateDocument(type, { url: payload.data.url, title: documentMeta[type].title, isPublished: true });
      setNotice(`${documentMeta[type].title}已上传，请保存竞赛规程完成绑定。`);
    } catch (failure) { setError(failure instanceof Error ? failure.message : "PDF 上传失败。"); }
    finally { setUploading(""); }
  };

  const updateSponsor = (index: number, patch: Partial<NonNullable<EventManagementInput["sponsors"]>[number]>) => updateEvent("sponsors", sponsors.map((row, rowIndex) => rowIndex === index ? { ...row, ...patch } : row));
  const addSponsor = () => updateEvent("sponsors", [...sponsors, { id: `draft_${Date.now()}`, name: "", sponsorType: "sponsor", logoKey: "", websiteUrl: "", sortOrder: sponsors.length + 1, isPublished: true }]);
  const orderedDocuments = (["regulation", "referee_list"] as DocumentType[]).map((type) => contentDraft.documents.find((row) => row.documentType === type)).filter((row): row is ContentManagementInput["documents"][number] => Boolean(row));
  const regulationReady = Boolean(contentDraft.documents.find((row) => row.documentType === "regulation")?.url) && contentDraft.competitionFormat.length > 0;

  return <main className="content-workspace">
    <div className="content-layout">
      <aside className="content-sidebar">
        <small>当前赛事</small><h1>{eventDraft.shortTitle || eventDraft.fullTitle || "当前赛事"}</h1><p>{eventDraft.city || "城市待设置"} · 第 {eventDraft.stationNo} 站</p>
        <dl className="content-side-status"><div><dt>赛事概览</dt><dd className={eventDraft.publishStatus === "published" ? "ok" : ""}>{eventDraft.publishStatus === "published" ? "已发布" : "草稿"}</dd></div><div><dt>竞赛规程</dt><dd className={regulationPublished ? "ok" : ""}>{regulationPublished ? "已发布" : "草稿"}</dd></div></dl>
        <div className="content-side-note"><strong>运营提示</strong><p>赛事名称、年份、站次、城市和日期属于赛事管理主数据；这里负责公众展示内容。切换模块请使用页面顶部按钮。</p></div>
        <div className="content-side-note"><strong>发布原则</strong><p>保存只更新后台内容；发布决定公众端是否可见。撤回发布不会删除已经填写的数据。</p></div>
      </aside>

      <section className="content-main">
        {archived && <div className="content-message content-readonly">该赛事已经归档，赛事运营内容进入历史只读状态。</div>}
        {notice && <div className="content-message success">✓ {notice}<button type="button" onClick={() => setNotice("")}>×</button></div>}
        {error && <div className="content-message error">! {error}<button type="button" onClick={() => setError("")}>×</button></div>}

        <section className="content-head-card content-publishing-head"><div><small>CONTENT PUBLISHING</small><h2>内容发布</h2><p>组织并发布赛事概览与竞赛规程。基础主数据只读取一次，运营内容在这里继续完善。</p><div className="content-top-tabs"><button className={tab === "overview" ? "active" : ""} type="button" onClick={() => setTab("overview")}>赛事概览</button><button className={tab === "regulation" ? "active" : ""} type="button" onClick={() => setTab("regulation")}>竞赛规程</button></div></div><span className={(tab === "overview" ? eventDraft.publishStatus === "published" : regulationPublished) ? "public" : "draft"}>{tab === "overview" ? (eventDraft.publishStatus === "published" ? "概览已发布" : "概览草稿") : (regulationPublished ? "规程已发布" : "规程草稿")}</span></section>

        {tab === "overview" ? <>
          <section className="content-card"><header><div><small>01 · MASTER DATA</small><h2>赛事基础信息</h2><p>来自赛事管理的主数据只读展示。如果信息有误，请返回赛事管理修改。</p></div><Link href={`/admin/events/${eventDraft.eventId}`}>修改赛事基本信息 →</Link></header><div className="content-master-grid"><div className="wide"><span>完整赛事名称</span><strong>{eventDraft.fullTitle || "—"}</strong></div><div><span>赛季 / 站次</span><strong>{eventDraft.year}赛季 · 第 {eventDraft.stationNo} 站</strong></div><div><span>城市</span><strong>{eventDraft.city || "—"}</strong></div><div><span>比赛日期</span><strong>{eventDraft.startDate || "—"} — {eventDraft.endDate || "—"}</strong></div><div><span>参赛组别</span><strong>{activeGroups.map((group) => `${group.name} ${group.code}`).join(" · ") || "—"}</strong></div><div className="wide"><span>赛事组织机构</span><strong>{organizationText || "待完善"}</strong></div></div></section>

          <section className="content-card"><header><div><small>02 · DISPLAY</small><h2>前端展示信息</h2><p>前端简称用于赛事列表和移动端标题；赛事简介用于概览首屏。</p></div></header><div className="content-form-grid"><label className="wide content-field"><span>前端显示简称</span><input disabled={archived} value={eventDraft.shortTitle} onChange={(e) => updateEvent("shortTitle", e.target.value)} /></label><label className="wide content-field"><span>赛事简介</span><textarea disabled={archived} rows={5} value={eventDraft.summary || ""} onChange={(e) => updateEvent("summary", e.target.value)} placeholder="用一到两段话说明本站赛事重点" /></label></div></section>

          <section className="content-card"><header><div><small>03 · VENUE & PARAMETERS</small><h2>比赛信息与主要参数</h2><p>这些信息从创建赛事移到赛事运营，用于公众概览展示。</p></div></header><div className="content-form-grid"><label className="wide content-field"><span>比赛场馆</span><input disabled={archived} value={eventDraft.venue.name} onChange={(e) => updateEvent("venue", { ...eventDraft.venue, name: e.target.value })} /></label><label className="content-field"><span>省 / 直辖市</span><input disabled={archived} value={eventDraft.venue.province || ""} onChange={(e) => updateEvent("venue", { ...eventDraft.venue, province: e.target.value })} /></label><label className="content-field"><span>区 / 县</span><input disabled={archived} value={eventDraft.venue.district || ""} onChange={(e) => updateEvent("venue", { ...eventDraft.venue, district: e.target.value })} /></label><label className="wide content-field"><span>详细地址</span><input disabled={archived} value={eventDraft.venue.address || ""} onChange={(e) => updateEvent("venue", { ...eventDraft.venue, address: e.target.value })} /></label><label className="content-field"><span>赛事时长</span><input disabled={archived} value={eventDraft.details.durationLabel || ""} onChange={(e) => updateEvent("details", { ...eventDraft.details, durationLabel: e.target.value })} placeholder="例如：11天" /></label><label className="content-field"><span>总奖金</span><input disabled={archived} value={eventDraft.details.totalPrizeLabel || ""} onChange={(e) => updateEvent("details", { ...eventDraft.details, totalPrizeLabel: e.target.value })} placeholder="例如：¥350,400" /></label><label className="content-field"><span>资格赛日期说明</span><input disabled={archived} value={eventDraft.details.qualifierDateLabel || ""} onChange={(e) => updateEvent("details", { ...eventDraft.details, qualifierDateLabel: e.target.value })} /></label><label className="content-field"><span>正赛日期说明</span><input disabled={archived} value={eventDraft.details.mainDateLabel || ""} onChange={(e) => updateEvent("details", { ...eventDraft.details, mainDateLabel: e.target.value })} /></label><label className="wide content-field"><span>正赛规模</span><input disabled={archived} value={eventDraft.details.mainSizeLabel || ""} onChange={(e) => updateEvent("details", { ...eventDraft.details, mainSizeLabel: e.target.value })} placeholder="例如：每组64人" /></label></div></section>

          <section className="content-card"><header><div><small>04 · VISUAL & PARTNERS</small><h2>赛事主题图片与合作伙伴</h2><p>沿用原来的主题图与 Logo 管理方式，只是从赛事管理移动到赛事概览。</p></div></header><div className="event-brand-layout"><div className="event-theme-editor"><div className={eventDraft.coverImageKey?.trim() ? "event-theme-preview has-image" : "event-theme-preview"}>{eventDraft.coverImageKey?.trim() ? <img src={eventDraft.coverImageKey} alt="赛事主题图片预览" /> : <div><span>图</span><strong>未上传主题图</strong><small>前端使用统一默认视觉</small></div>}</div><div className="event-upload-row">{!archived && <label className="event-upload-button"><input type="file" accept="image/jpeg,image/png,image/webp" disabled={Boolean(uploading)} onChange={(e) => { const file = e.target.files?.[0]; if (file) void uploadAsset(file, "cover", "cover", (url) => updateEvent("coverImageKey", url)); e.currentTarget.value = ""; }} />{uploading === "cover" ? "正在上传…" : eventDraft.coverImageKey ? "更换主题图" : "上传主题图"}</label>}{!archived && eventDraft.coverImageKey && <button className="event-remove-image" type="button" onClick={() => updateEvent("coverImageKey", "")}>恢复默认视觉</button>}</div><div className="event-image-guide"><strong>主题图上传建议</strong><span>推荐3:4竖版 · JPG / PNG / WebP · 5MB以内</span><p>上传后用于赛事中心卡片和赛事概览。比例偏差较大时系统会提示，请重点检查人物、标题和 Logo 是否处于安全区域。</p></div></div><div><div className="event-sponsor-head"><div><strong>合作伙伴</strong><span>支持冠名赞助、合作伙伴、指定器材和支持品牌</span></div>{!archived && <button type="button" onClick={addSponsor}>＋ 添加合作伙伴</button>}</div><div className="event-sponsor-list">{sponsors.length ? sponsors.map((sponsor, index) => <article key={sponsor.id || index}><div className="event-sponsor-preview">{sponsor.logoKey?.trim() ? <img src={sponsor.logoKey} alt={sponsor.name || "合作伙伴"} /> : <span>LOGO</span>}</div><div className="event-sponsor-fields"><label><span>名称</span><input disabled={archived} value={sponsor.name} onChange={(e) => updateSponsor(index, { name: e.target.value })} /></label><label><span>类型</span><select disabled={archived} value={sponsor.sponsorType} onChange={(e) => updateSponsor(index, { sponsorType: e.target.value })}><option value="title">冠名赞助</option><option value="sponsor">合作伙伴</option><option value="equipment">指定器材</option><option value="support">支持品牌</option></select></label><label className="event-logo-upload wide"><span>品牌 Logo</span>{!archived && <span className="event-upload-button"><input type="file" accept="image/jpeg,image/png,image/webp" disabled={Boolean(uploading)} onChange={(e) => { const file = e.target.files?.[0]; if (file) void uploadAsset(file, `sponsor-${index}`, "sponsor_logo", (url) => updateSponsor(index, { logoKey: url })); e.currentTarget.value = ""; }} />{uploading === `sponsor-${index}` ? "上传中…" : "上传 Logo"}</span>}</label></div><div className="event-sponsor-actions"><label><input disabled={archived} type="checkbox" checked={Boolean(sponsor.isPublished)} onChange={(e) => updateSponsor(index, { isPublished: e.target.checked })} />前端展示</label>{!archived && <button type="button" onClick={() => updateEvent("sponsors", sponsors.filter((_, rowIndex) => rowIndex !== index))}>移除</button>}</div></article>) : <p className="event-management-empty">暂无合作伙伴，可按需添加。</p>}</div></div></div></section>

          <section className="content-card"><header><div><small>05 · PARTICIPANT TIPS</small><h2>参赛友好提示</h2><p>保留交通住宿、服装要求等提示，每项可以独立决定是否在公众端显示。</p></div></header><div className="guide-grid">{contentDraft.guides.map((guide) => <article key={guide.guideType}><header><span>{guide.guideType === "transport" ? "行" : "衣"}</span><div><strong>{guide.title}</strong><small>{guide.guideType === "transport" ? "交通 · 住宿 · 报到" : "资格赛 · 正赛服装要求"}</small></div></header><label><span>提示标题</span><input disabled={archived} value={guide.title} onChange={(e) => updateGuide(guide.guideType as "transport" | "clothing", { title: e.target.value })} /></label><label><span>提示内容</span><textarea disabled={archived} rows={5} value={guide.body} onChange={(e) => updateGuide(guide.guideType as "transport" | "clothing", { body: e.target.value })} /></label><label className="guide-status"><span>前端状态</span><select disabled={archived} value={guide.publishStatus} onChange={(e) => updateGuide(guide.guideType as "transport" | "clothing", { publishStatus: e.target.value as "draft" | "published" })}><option value="draft">暂不显示</option><option value="published">前端显示</option></select></label></article>)}</div></section>
        </> : <>
          <section className="content-card content-official-files"><header><div><small>OFFICIAL FILES</small><h2>官方赛事文件</h2><p>完整竞赛规程和裁判组名单并列管理，支持上传、更换、查看和单独控制公众端显示。</p></div><b className={regulationReady ? "ready" : "pending"}>{regulationReady ? "规程文件已就绪" : "请补充规程 PDF"}</b></header><div className="document-grid">{orderedDocuments.map((document) => { const type = document.documentType as DocumentType; const meta = documentMeta[type]; return <article key={type}><span>PDF</span><div className="document-fields"><div className="document-title-row"><div><strong>{meta.title}</strong><small>{meta.note}</small></div>{document.url && <a href={document.url} target="_blank" rel="noreferrer">查看当前文件 ↗</a>}</div><label><small>文件标题</small><input disabled={archived} value={document.title} onChange={(e) => updateDocument(type, { title: e.target.value })} /></label><div className="document-actions">{!archived && <label className="file-upload"><input type="file" accept="application/pdf" disabled={Boolean(uploading)} onChange={(e) => { const file = e.target.files?.[0]; if (file) void uploadPdf(type, file); e.currentTarget.value = ""; }} />{uploading === `pdf-${type}` ? "正在上传…" : document.url ? "更换 PDF" : "上传 PDF"}</label>}<label className="publish-check"><input disabled={archived} type="checkbox" checked={Boolean(document.isPublished)} onChange={(e) => updateDocument(type, { isPublished: e.target.checked })} />公众端显示</label></div></div></article>; })}</div></section>

          <section className="content-card"><header><div><small>01 · ENTRY REQUIREMENTS</small><h2>报名要求</h2><p>年龄规则按少年组、青年组分别维护，其他共同要求放在下方统一说明。</p></div></header><div className="content-age-grid">{eventDraft.groups.map((group, index) => <article key={group.id}><div><span>{group.code}</span><strong>{group.name}</strong></div><label className="content-field"><span>年龄规则说明</span><input disabled={archived} value={group.ageRuleText || ""} onChange={(e) => updateGroup(index, { ageRuleText: e.target.value })} placeholder={group.code === "U16" ? "例如：2010年7月10日（含）以后出生。" : "例如：2006年7月10日（含）以后出生。"} /></label></article>)}</div><label className="content-field content-common-note"><span>其他报名要求</span><textarea disabled={archived} rows={3} value={eventDraft.details.minimumAgeNote || DEFAULT_COMMON_REQUIREMENT} onChange={(e) => updateEvent("details", { ...eventDraft.details, minimumAgeNote: e.target.value })} /></label></section>

          <section className="content-card"><header><div><small>02 · RULES</small><h2>比赛规则</h2><p>概要页只说明采用的正式规则版本，不重复录入限时、暂停、迟到等完整条款。</p></div></header><label className="content-field"><span>规则标准</span><textarea disabled={archived} rows={3} value={contentDraft.ruleStandard || DEFAULT_RULE_STANDARD} onChange={(e) => setContentDraft((current) => ({ ...current, ruleStandard: e.target.value }))} /></label><div className="content-side-note content-inline-note"><strong>完整规则以 PDF 为准</strong><p>后台只维护规则标准的摘要，完整执行细则统一查看上方《完整竞赛规程》。</p></div></section>

          <section className="content-card"><header><div><small>03 · FORMAT</small><h2>赛制</h2><p>默认使用廊坊站的四阶段结构，可按本站实际赛制直接修改。</p></div>{!archived && <button className="content-add-button" type="button" onClick={() => setContentDraft((current) => ({ ...current, competitionFormat: [...current.competitionFormat, ["新阶段", "", "", ""]] }))}>＋ 增加阶段</button>}</header><div className="format-editor"><div className="format-editor-head"><span>阶段</span><span>赛制 / 晋级</span><span>少年组</span><span>青年组</span><span /></div>{contentDraft.competitionFormat.map((row, index) => <div className="format-editor-row" key={index}>{[0, 1, 2, 3].map((column) => <input disabled={archived} key={column} value={row[column] ?? ""} onChange={(e) => updateFormat(index, column, e.target.value)} />)}{!archived && <button type="button" onClick={() => setContentDraft((current) => ({ ...current, competitionFormat: current.competitionFormat.filter((_, rowIndex) => rowIndex !== index) }))}>×</button>}</div>)}</div></section>

          <section className="content-card"><header><div><small>04 · PRIZE</small><h2>奖励设置</h2><p>默认按廊坊站奖金结构填写，可直接调整名次、奖金和其他奖励。</p></div></header><div className="prize-editors">{(["少年组", "青年组"] as GroupName[]).map((group) => <article key={group}><header><div><strong>{group}</strong><span>{group === "少年组" ? "U16" : "U20"}</span></div>{!archived && <button type="button" onClick={() => setContentDraft((current) => ({ ...current, prizes: { ...current.prizes, [group]: [...current.prizes[group], ["名次", "", ""]] } }))}>＋ 增加名次</button>}</header><div className="prize-row prize-row-head"><span>名次</span><span>奖金</span><span>其他奖励</span><span /></div>{contentDraft.prizes[group].map((row, index) => <div className="prize-row with-reward" key={index}>{[0, 1, 2].map((column) => <input disabled={archived} key={column} value={row[column] ?? ""} onChange={(e) => updatePrize(group, index, column, e.target.value)} />)}{!archived && <button type="button" onClick={() => setContentDraft((current) => ({ ...current, prizes: { ...current.prizes, [group]: current.prizes[group].filter((_, rowIndex) => rowIndex !== index) } }))}>×</button>}</div>)}</article>)}</div><label className="content-field content-prize-note"><span>奖励说明</span><textarea disabled={archived} rows={3} value={contentDraft.prizeNote} onChange={(e) => setContentDraft((current) => ({ ...current, prizeNote: e.target.value }))} /></label></section>

          <section className="content-card"><header><div><small>05 · REGISTRATION & FEES</small><h2>报名与费用</h2><p>规程这里只维护参赛费和费用说明；报名入口、报名起止时间统一由“报名发布”管理。</p></div></header><div className="content-fee-grid">{eventDraft.groups.map((group, index) => <label className="content-field" key={group.id}><span>{group.name} · 单站参赛费（元）</span><input disabled={archived} type="number" min="0" value={group.registrationFeeYuan} onChange={(e) => updateGroup(index, { registrationFeeYuan: Number(e.target.value) })} /></label>)}</div><label className="content-field content-common-note"><span>报名与费用说明</span><textarea disabled={archived} rows={4} value={eventDraft.details.signupNote || ""} onChange={(e) => updateEvent("details", { ...eventDraft.details, signupNote: e.target.value })} placeholder="例如：一次报名可参加两场资格赛；参赛运动员交通、食宿等费用自理。" /></label></section>

          <section className="content-card"><header><div><small>06 · DRAW</small><h2>种子与抽签</h2><p>用简洁文字说明种子位、混抽和正赛阶段的抽签原则，实际签位仍由竞赛执行产生。</p></div></header><label className="content-field"><span>种子与抽签规则</span><textarea disabled={archived} rows={7} value={contentDraft.drawRules.join("\n")} onChange={(e) => setContentDraft((current) => ({ ...current, drawRules: e.target.value.split("\n") }))} placeholder="每行一条规则，例如：资格赛不设种子，全部混抽入位。" /></label></section>
        </>}

        {!archived && <footer className="content-savebar"><div><strong>{tab === "overview" ? "保存赛事概览" : "保存竞赛规程"}</strong><span>{tab === "overview" ? "保存不会改变当前发布状态；取消发布后内容仍会保留。" : "保存后，已发布的规程会同步更新公众端；撤回发布不会清空数据。"}</span></div><div className="content-save-actions"><button className="secondary" type="button" onClick={() => tab === "overview" ? saveOverview() : saveRegulation()} disabled={working}>{working ? "正在保存…" : "保存当前模块"}</button>{tab === "overview" ? (eventDraft.publishStatus === "published" ? <button className="secondary" style={{ color: "#a44352", borderColor: "#e1c4c9", background: "#fff5f6" }} type="button" onClick={() => saveOverview("draft")} disabled={working}>取消发布</button> : <button type="button" onClick={() => saveOverview("published")} disabled={working}>发布赛事概览</button>) : <button className={regulationPublished ? "secondary" : undefined} type="button" onClick={toggleRegulation} disabled={working}>{regulationPublished ? "撤回发布" : "发布竞赛规程"}</button>}</div></footer>}
      </section>
    </div>
  </main>;
}
