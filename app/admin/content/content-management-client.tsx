"use client";

import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import type { ContentManagementData, ContentManagementInput } from "@/db/content-management";

type GroupName = "少年组" | "青年组";
type DocumentType = "regulation" | "referee_list";
type Draft = ContentManagementInput;

const moduleDescriptions: Record<string, string> = {
  overview: "赛事概览、主题信息、组织机构与参赛提示",
  regulation: "竞赛办法、抽签规则、奖金及完整规程文件",
  documents: "竞赛规程、裁判员名单等官方赛事文件",
  schedule: "由抽签与赛程引擎生成，包含签位、分组、球台和阶段结构",
  matches: "由赛程和比赛执行数据产生，可由裁判组调整球台、时间和状态",
  rankings: "由赛果和晋级关系生成，组委会确认后发布，也允许人工修正",
};

const staticModules = new Set(["overview", "regulation", "documents"]);
const dynamicModules = new Set(["schedule", "matches", "rankings"]);
const moduleOrder = ["overview", "regulation", "documents", "schedule", "matches", "rankings"];

function toDraft(data: ContentManagementData): Draft {
  return {
    eventId: data.event.id,
    summary: data.event.summary,
    competitionFormat: data.details.competitionFormat.map((row) => [...row]),
    drawRules: [...data.details.drawRules],
    prizes: {
      少年组: data.details.prizes.少年组.map((row) => [...row]),
      青年组: data.details.prizes.青年组.map((row) => [...row]),
    },
    documents: data.documents.map((row) => ({ documentType: row.documentType as DocumentType, title: row.title, url: row.url, isPublished: row.isPublished })),
    guides: data.guides.map((row) => ({ guideType: row.guideType as "transport" | "clothing", title: row.title, body: row.body, publishStatus: row.publishStatus as "draft" | "published" })),
  };
}

function formatTime(value: string) {
  if (!value) return "尚未发布";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("zh-CN", { hour12: false });
}

export default function ContentManagementClient({ initialData }: { initialData: ContentManagementData }) {
  const [data, setData] = useState(initialData);
  const [draft, setDraft] = useState<Draft>(() => toDraft(initialData));
  const [working, setWorking] = useState(false);
  const [uploading, setUploading] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const publications = useMemo(() => [...data.publications].sort((a, b) => moduleOrder.indexOf(a.moduleType) - moduleOrder.indexOf(b.moduleType)), [data.publications]);
  const staticPublications = publications.filter((item) => staticModules.has(item.moduleType));
  const dynamicPublications = publications.filter((item) => dynamicModules.has(item.moduleType));
  const staticPublishedCount = staticPublications.filter((item) => item.status === "published").length;

  const save = async (event?: FormEvent) => {
    event?.preventDefault(); setWorking(true); setNotice(""); setError("");
    try {
      const response = await fetch("/api/admin/content-management", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "save", data: draft }) });
      const payload = await response.json() as { data?: ContentManagementData; error?: string };
      if (!response.ok || !payload.data) throw new Error(payload.error || "内容保存失败。");
      setData(payload.data); setDraft(toDraft(payload.data));
      setNotice("静态内容草稿已保存。保存不会自动改变前端发布状态。" );
    } catch (failure) { setError(failure instanceof Error ? failure.message : "内容保存失败。"); }
    finally { setWorking(false); }
  };

  const togglePublication = async (publicationId: string, currentStatus: string) => {
    setWorking(true); setNotice(""); setError("");
    const status = currentStatus === "published" ? "draft" : "published";
    try {
      const response = await fetch("/api/admin/content-management", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "publication", eventId: draft.eventId, publicationId, status }) });
      const payload = await response.json() as { data?: ContentManagementData; error?: string };
      if (!response.ok || !payload.data) throw new Error(payload.error || "发布操作失败。");
      setData(payload.data); setDraft(toDraft(payload.data));
      setNotice(status === "published" ? "内容模块已经发布到公众端。" : "内容模块已撤回为草稿。" );
    } catch (failure) { setError(failure instanceof Error ? failure.message : "发布操作失败。"); }
    finally { setWorking(false); }
  };

  const updateDocument = (type: DocumentType, patch: Partial<Draft["documents"][number]>) => setDraft((current) => ({ ...current, documents: current.documents.map((row) => row.documentType === type ? { ...row, ...patch } : row) }));
  const updateFormat = (index: number, column: number, value: string) => setDraft((current) => ({ ...current, competitionFormat: current.competitionFormat.map((row, rowIndex) => rowIndex === index ? row.map((cell, cellIndex) => cellIndex === column ? value : cell) : row) }));
  const updatePrize = (group: GroupName, index: number, column: number, value: string) => setDraft((current) => ({ ...current, prizes: { ...current.prizes, [group]: current.prizes[group].map((row, rowIndex) => rowIndex === index ? row.map((cell, cellIndex) => cellIndex === column ? value : cell) : row) } }));

  const uploadPdf = async (type: DocumentType, file: File) => {
    if (file.type !== "application/pdf") return setError("赛事文件请上传 PDF。");
    if (file.size > 15 * 1024 * 1024) return setError("PDF 文件不能超过 15MB。");
    setUploading(type); setNotice(""); setError("");
    try {
      const form = new FormData(); form.append("eventId", draft.eventId); form.append("assetType", `document_${type}`); form.append("file", file);
      const response = await fetch("/api/admin/assets", { method: "POST", body: form });
      const payload = await response.json() as { data?: { url: string }; error?: string };
      if (!response.ok || !payload.data?.url) throw new Error(payload.error || "文件上传失败。");
      updateDocument(type, { url: payload.data.url }); setNotice("PDF 已上传，保存内容后绑定到当前赛事。" );
    } catch (failure) { setError(failure instanceof Error ? failure.message : "文件上传失败。"); }
    finally { setUploading(""); }
  };

  const documentReady = draft.documents.some((row) => row.isPublished && row.url.trim());
  const regulationReady = draft.competitionFormat.length > 0 && draft.drawRules.some((item) => item.trim()) && (draft.prizes.少年组.length > 0 || draft.prizes.青年组.length > 0);

  return <main className="content-workspace">
    <header className="content-topbar">
      <div><Link href="/admin">← 返回赛事后台</Link><span>内容发布 · 静态内容</span></div>
      <div className="content-top-actions"><Link href={`/admin/events/${draft.eventId}`}>赛事设置</Link><Link href={`/admin/content/${draft.eventId}/guides`}>参赛提示</Link><Link href="/admin/competition">竞赛执行</Link><Link href="/" target="_blank">查看公众前端 ↗</Link><button form="content-form" type="submit" disabled={working}>{working ? "正在保存…" : "保存静态内容"}</button></div>
    </header>

    <form id="content-form" onSubmit={save} className="content-layout">
      <aside className="content-sidebar">
        <small>当前赛事</small><h1>{data.event.shortTitle}</h1><p>{data.event.city}</p>
        <div className="content-progress"><div><strong>{staticPublishedCount}</strong><span>/ 3 静态模块已发布</span></div><i><b style={{ width: `${staticPublishedCount / 3 * 100}%` }} /></i></div>
        <nav><a href="#content-overview">赛事概览</a><a href="#content-regulation">竞赛规程</a><a href="#content-documents">赛事文件</a><a href="#content-guides">参赛提示</a><a href="#content-release">静态内容发布</a><a href="#competition-handoff">竞赛数据</a></nav>
        <div className="content-side-note"><strong>静态与动态分开</strong><p>这里维护不会频繁变化的赛事内容；签位、赛程、对阵、比分和排名统一交给“竞赛执行”。</p></div>
      </aside>

      <section className="content-main">
        {notice && <div className="content-message success">✓ {notice}<button type="button" onClick={() => setNotice("")}>×</button></div>}
        {error && <div className="content-message error">! {error}<button type="button" onClick={() => setError("")}>×</button></div>}

        <section className="content-head-card"><div><small>CONTENT PUBLISHING</small><h2>内容发布工作台</h2><p>赛事设置负责“这是什么比赛”，内容发布负责“组委会要告诉参赛者什么”，竞赛执行负责“比赛现在发生到哪里”。</p></div><span className={data.event.publishStatus === "published" ? "public" : "draft"}>{data.event.publishStatus === "published" ? "赛事已公开" : "赛事主页面为草稿"}</span></section>

        <section id="content-overview" className="content-card"><header><div><small>01 · OVERVIEW</small><h2>赛事概览内容</h2><p>这里只编辑赛事简介；日期、场馆、主题图、赞助商、组别等仍在“赛事设置”统一维护。</p></div><Link href={`/admin/events/${draft.eventId}`}>编辑赛事主资料 →</Link></header><label className="content-field"><span>赛事简介</span><textarea rows={5} value={draft.summary} onChange={(e) => setDraft((current) => ({ ...current, summary: e.target.value }))} placeholder="用一到两段文字说明本站赛事重点" /></label></section>

        <section id="content-regulation" className="content-card"><header><div><small>02 · REGULATION</small><h2>竞赛规程结构化内容</h2><p>赛制、抽签原则和奖金属于相对稳定的赛前规则；实际签位与赛程表不在这里维护。</p></div><b className={regulationReady ? "ready" : "pending"}>{regulationReady ? "内容较完整" : "需要补充"}</b></header>
          <div className="content-subhead"><div><strong>竞赛办法</strong><span>每行对应一个比赛阶段</span></div><button type="button" onClick={() => setDraft((current) => ({ ...current, competitionFormat: [...current.competitionFormat, ["新阶段", "", "", ""]] }))}>＋ 增加阶段</button></div>
          <div className="format-editor"><div className="format-editor-head"><span>阶段</span><span>赛制</span><span>少年组</span><span>青年组</span><span /></div>{draft.competitionFormat.map((row, index) => <div className="format-editor-row" key={index}>{[0,1,2,3].map((column) => <input key={column} value={row[column] ?? ""} onChange={(e) => updateFormat(index, column, e.target.value)} />)}<button type="button" onClick={() => setDraft((current) => ({ ...current, competitionFormat: current.competitionFormat.filter((_, rowIndex) => rowIndex !== index) }))}>×</button></div>)}</div>
          <div className="content-subhead spaced"><div><strong>种子与抽签原则</strong><span>这里写规则，不录入实际抽签结果</span></div><button type="button" onClick={() => setDraft((current) => ({ ...current, drawRules: [...current.drawRules, ""] }))}>＋ 增加规则</button></div>
          <div className="rule-editor">{draft.drawRules.map((rule, index) => <div key={index}><span>{String(index + 1).padStart(2, "0")}</span><textarea rows={2} value={rule} onChange={(e) => setDraft((current) => ({ ...current, drawRules: current.drawRules.map((item, itemIndex) => itemIndex === index ? e.target.value : item) }))} /><button type="button" onClick={() => setDraft((current) => ({ ...current, drawRules: current.drawRules.filter((_, itemIndex) => itemIndex !== index) }))}>×</button></div>)}</div>
          <div className="content-subhead spaced"><div><strong>奖金设置</strong><span>少年组、青年组分别维护</span></div></div>
          <div className="prize-editors">{(["少年组", "青年组"] as GroupName[]).map((group) => <article key={group}><header><div><strong>{group}</strong><span>{group === "少年组" ? "U16" : "U20"}</span></div><button type="button" onClick={() => setDraft((current) => ({ ...current, prizes: { ...current.prizes, [group]: [...current.prizes[group], ["名次", "金额"]] } }))}>＋ 增加名次</button></header>{draft.prizes[group].map((row, index) => <div className="prize-row" key={index}><input value={row[0] ?? ""} onChange={(e) => updatePrize(group, index, 0, e.target.value)} placeholder="冠军 / 8强"/><input value={row[1] ?? ""} onChange={(e) => updatePrize(group, index, 1, e.target.value)} placeholder="¥50,000 / ¥3,500/人"/><button type="button" onClick={() => setDraft((current) => ({ ...current, prizes: { ...current.prizes, [group]: current.prizes[group].filter((_, rowIndex) => rowIndex !== index) } }))}>×</button></div>)}</article>)}</div>
        </section>

        <section id="content-documents" className="content-card"><header><div><small>03 · DOCUMENTS</small><h2>赛事文件</h2><p>完整竞赛规程和裁判员名单支持直接上传 PDF。</p></div><b className={documentReady ? "ready" : "pending"}>{documentReady ? "已有公开文件" : "暂无公开文件"}</b></header><div className="document-grid">{draft.documents.map((document) => <article key={document.documentType}><span>PDF</span><div className="document-fields"><label><small>文件标题</small><input value={document.title} onChange={(e) => updateDocument(document.documentType, { title: e.target.value })} /></label><label><small>文件地址</small><input value={document.url} onChange={(e) => updateDocument(document.documentType, { url: e.target.value })} placeholder="上传后自动生成，也可填写外部 URL" /></label><div className="document-actions"><label className="file-upload"><input type="file" accept="application/pdf" disabled={Boolean(uploading)} onChange={(e) => { const file = e.target.files?.[0]; if (file) uploadPdf(document.documentType, file); e.currentTarget.value = ""; }} />{uploading === document.documentType ? "正在上传…" : "上传 PDF"}</label><label className="publish-check"><input type="checkbox" checked={document.isPublished} onChange={(e) => updateDocument(document.documentType, { isPublished: e.target.checked })} />在赛事文件区展示</label></div></div></article>)}</div></section>

        <section id="content-guides" className="content-card"><header><div><small>04 · PARTICIPANT GUIDE</small><h2>参赛友好提示</h2><p>不再固定只有“交通住宿”和“服装要求”。可以自由增加提示，并用正文、图片、双栏进行轻量排版。</p></div><Link href={`/admin/content/${draft.eventId}/guides`}>管理全部参赛提示 →</Link></header><div className="content-side-note"><strong>开放式提示内容</strong><p>例如：交通住宿、服装、报到检录、停车、餐饮、家长观赛、天气与临时通知。每一篇都能单独保存、排序和发布。</p></div></section>

        <section id="content-release" className="content-card publication-card"><header><div><small>05 · STATIC RELEASE</small><h2>静态内容发布控制</h2><p>这里只有概览、规程和赛事文件三个静态模块的发布开关。</p></div><b>{staticPublishedCount} / 3</b></header><div className="publication-list">{staticPublications.map((item) => <article key={item.id} className={item.status === "published" ? "published" : "draft"}><div className="publication-icon">{item.moduleTitle.slice(0,1)}</div><div><strong>{item.moduleTitle}</strong><p>{moduleDescriptions[item.moduleType]}</p><small>版本 {item.versionNo} · {formatTime(item.publishedAt)}</small></div><b>{item.status === "published" ? "已发布" : "草稿"}</b><button type="button" disabled={working} onClick={() => togglePublication(item.id, item.status)}>{item.status === "published" ? "撤回" : "发布"}</button></article>)}</div></section>

        <section id="competition-handoff" className="content-card publication-card"><header><div><small>06 · COMPETITION DATA</small><h2>赛程、对阵与排名移交竞赛执行</h2><p>这三类数据不再作为普通文章发布。后续由裁判组工作区统一维护和发布。</p></div><Link href="/admin/competition">进入竞赛执行规划 →</Link></header><div className="publication-list">{dynamicPublications.map((item) => <article key={item.id} className={item.status === "published" ? "published" : "draft"}><div className="publication-icon">{item.moduleTitle.slice(0,1)}</div><div><strong>{item.moduleTitle}</strong><p>{moduleDescriptions[item.moduleType]}</p><small>当前状态：{item.status === "published" ? "已公开" : "未公开"} · 后续由竞赛执行控制</small></div><b>{item.status === "published" ? "已发布" : "草稿"}</b><span /></article>)}</div></section>

        <footer className="content-savebar"><div><strong>静态内容草稿</strong><span>赛事设置、静态内容、竞赛数据三条线已经分开。</span></div><button type="submit" disabled={working}>{working ? "正在保存…" : "保存静态内容"}</button></footer>
      </section>
    </form>
  </main>;
}
