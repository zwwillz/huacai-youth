"use client";

import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import type { ContentManagementData, ContentManagementInput } from "@/db/content-management";

type GroupName = "少年组" | "青年组";
type DocumentType = "regulation" | "referee_list";
type GuideType = "transport" | "clothing";

type Draft = ContentManagementInput;

const moduleDescriptions: Record<string, string> = {
  overview: "赛事概览、主题信息、组织机构与参赛提示",
  regulation: "竞赛办法、抽签规则、奖金及完整规程文件",
  documents: "竞赛规程、裁判员名单等官方赛事文件",
  schedule: "分阶段赛程；具体数据由竞赛执行模块维护",
  matches: "对阵与实时比赛数据；具体数据由竞赛执行模块维护",
  rankings: "最终名次与积分；具体数据由排名积分模块维护",
};

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
    documents: data.documents.map((row) => ({
      documentType: row.documentType as DocumentType,
      title: row.title,
      url: row.url,
      isPublished: row.isPublished,
    })),
    guides: data.guides.map((row) => ({
      guideType: row.guideType as GuideType,
      title: row.title,
      body: row.body,
      publishStatus: row.publishStatus as "draft" | "published",
    })),
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
  const publishedCount = publications.filter((item) => item.status === "published").length;

  const save = async (event?: FormEvent) => {
    event?.preventDefault();
    setWorking(true);
    setNotice("");
    setError("");
    try {
      const response = await fetch("/api/admin/content-management", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "save", data: draft }),
      });
      const payload = await response.json() as { data?: ContentManagementData; error?: string };
      if (!response.ok || !payload.data) throw new Error(payload.error || "内容保存失败。");
      setData(payload.data);
      setDraft(toDraft(payload.data));
      setNotice("内容草稿已保存。发布状态不会因为保存草稿而自动改变。");
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "内容保存失败。");
    } finally {
      setWorking(false);
    }
  };

  const togglePublication = async (publicationId: string, currentStatus: string) => {
    setWorking(true);
    setNotice("");
    setError("");
    const status = currentStatus === "published" ? "draft" : "published";
    try {
      const response = await fetch("/api/admin/content-management", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "publication", eventId: draft.eventId, publicationId, status }),
      });
      const payload = await response.json() as { data?: ContentManagementData; error?: string };
      if (!response.ok || !payload.data) throw new Error(payload.error || "发布操作失败。");
      setData(payload.data);
      setDraft(toDraft(payload.data));
      setNotice(status === "published" ? "模块已经发布到公众端。" : "模块已撤回为草稿；公众导航将按规则隐藏。" );
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "发布操作失败。");
    } finally {
      setWorking(false);
    }
  };

  const updateDocument = (type: DocumentType, patch: Partial<Draft["documents"][number]>) => {
    setDraft((current) => ({ ...current, documents: current.documents.map((row) => row.documentType === type ? { ...row, ...patch } : row) }));
  };

  const updateGuide = (type: GuideType, patch: Partial<Draft["guides"][number]>) => {
    setDraft((current) => ({ ...current, guides: current.guides.map((row) => row.guideType === type ? { ...row, ...patch } : row) }));
  };

  const uploadPdf = async (type: DocumentType, file: File) => {
    if (file.type !== "application/pdf") {
      setError("赛事文件请上传 PDF。");
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      setError("PDF 文件不能超过 15MB。");
      return;
    }
    setUploading(type);
    setNotice("");
    setError("");
    try {
      const form = new FormData();
      form.append("eventId", draft.eventId);
      form.append("assetType", `document_${type}`);
      form.append("file", file);
      const response = await fetch("/api/admin/assets", { method: "POST", body: form });
      const payload = await response.json() as { data?: { url: string }; error?: string };
      if (!response.ok || !payload.data?.url) throw new Error(payload.error || "文件上传失败。");
      updateDocument(type, { url: payload.data.url });
      setNotice("PDF 已上传。点击“保存全部内容”后会绑定到当前赛事。" );
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "文件上传失败。");
    } finally {
      setUploading("");
    }
  };

  const updateFormat = (index: number, column: number, value: string) => {
    setDraft((current) => ({ ...current, competitionFormat: current.competitionFormat.map((row, rowIndex) => rowIndex === index ? row.map((cell, cellIndex) => cellIndex === column ? value : cell) : row) }));
  };

  const addFormatRow = () => setDraft((current) => ({ ...current, competitionFormat: [...current.competitionFormat, ["新阶段", "", "", ""]] }));
  const removeFormatRow = (index: number) => setDraft((current) => ({ ...current, competitionFormat: current.competitionFormat.filter((_, rowIndex) => rowIndex !== index) }));

  const updatePrize = (group: GroupName, index: number, column: number, value: string) => {
    setDraft((current) => ({ ...current, prizes: { ...current.prizes, [group]: current.prizes[group].map((row, rowIndex) => rowIndex === index ? row.map((cell, cellIndex) => cellIndex === column ? value : cell) : row) } }));
  };
  const addPrize = (group: GroupName) => setDraft((current) => ({ ...current, prizes: { ...current.prizes, [group]: [...current.prizes[group], ["名次", "金额"]] } }));
  const removePrize = (group: GroupName, index: number) => setDraft((current) => ({ ...current, prizes: { ...current.prizes, [group]: current.prizes[group].filter((_, rowIndex) => rowIndex !== index) } }));

  const documentReady = draft.documents.some((row) => row.isPublished && row.url.trim());
  const regulationReady = draft.competitionFormat.length > 0 && draft.drawRules.some((item) => item.trim()) && (draft.prizes.少年组.length > 0 || draft.prizes.青年组.length > 0);

  return <main className="content-workspace">
    <header className="content-topbar">
      <div><Link href="/admin">← 返回赛事后台</Link><span>内容发布</span></div>
      <div className="content-top-actions"><Link href={`/admin/events/${draft.eventId}`}>赛事完整设置</Link><Link href="/" target="_blank">查看公众前端 ↗</Link><button form="content-form" type="submit" disabled={working}>{working ? "正在保存…" : "保存全部内容"}</button></div>
    </header>

    <form id="content-form" onSubmit={save} className="content-layout">
      <aside className="content-sidebar">
        <small>当前赛事</small><h1>{data.event.shortTitle}</h1><p>{data.event.city}</p>
        <div className="content-progress"><div><strong>{publishedCount}</strong><span>/ 6 模块已发布</span></div><i><b style={{ width: `${publishedCount / 6 * 100}%` }} /></i></div>
        <nav><a href="#content-overview">赛事概览</a><a href="#content-regulation">竞赛规程</a><a href="#content-documents">赛事文件</a><a href="#content-guides">参赛提示</a><a href="#content-release">模块发布</a></nav>
        <div className="content-side-note"><strong>编辑与发布分开</strong><p>“保存”只更新草稿数据；只有点击模块的“发布”按钮，公众端才显示对应入口。</p></div>
      </aside>

      <section className="content-main">
        {notice && <div className="content-message success">✓ {notice}<button type="button" onClick={() => setNotice("")}>×</button></div>}
        {error && <div className="content-message error">! {error}<button type="button" onClick={() => setError("")}>×</button></div>}

        <section className="content-head-card"><div><small>CONTENT PUBLISHING</small><h2>内容发布工作台</h2><p>赛事主数据只维护一份；这里负责规程正文、赛事文件、参赛提示，以及各模块是否正式对公众开放。</p></div><span className={data.event.publishStatus === "published" ? "public" : "draft"}>{data.event.publishStatus === "published" ? "赛事已公开" : "赛事主页面为草稿"}</span></section>

        <section id="content-overview" className="content-card">
          <header><div><small>01 · OVERVIEW</small><h2>赛事概览内容</h2><p>这段简介会出现在赛事详情页。日期、场馆、主题图、赞助商、组别等继续在“赛事完整设置”维护。</p></div><Link href={`/admin/events/${draft.eventId}`}>编辑赛事主资料 →</Link></header>
          <label className="content-field"><span>赛事简介</span><textarea rows={5} value={draft.summary} onChange={(e) => setDraft((current) => ({ ...current, summary: e.target.value }))} placeholder="用一到两段文字说明本站赛事重点" /></label>
        </section>

        <section id="content-regulation" className="content-card">
          <header><div><small>02 · REGULATION</small><h2>竞赛规程结构化内容</h2><p>这些数据直接组成公众端规程中的“竞赛办法、种子与抽签、奖金设置”。</p></div><b className={regulationReady ? "ready" : "pending"}>{regulationReady ? "内容较完整" : "需要补充"}</b></header>

          <div className="content-subhead"><div><strong>竞赛办法</strong><span>每行对应一个比赛阶段</span></div><button type="button" onClick={addFormatRow}>＋ 增加阶段</button></div>
          <div className="format-editor"><div className="format-editor-head"><span>阶段</span><span>赛制</span><span>少年组</span><span>青年组</span><span /></div>{draft.competitionFormat.length ? draft.competitionFormat.map((row, index) => <div className="format-editor-row" key={index}>{[0,1,2,3].map((column) => <input key={column} value={row[column] ?? ""} onChange={(e) => updateFormat(index, column, e.target.value)} placeholder={["例如：资格赛","例如：两场单败","例如：9局5胜","例如：13局7胜"][column]} />)}<button type="button" onClick={() => removeFormatRow(index)}>×</button></div>) : <p className="content-empty">还没有竞赛阶段。点击“增加阶段”开始录入。</p>}</div>

          <div className="content-subhead spaced"><div><strong>种子与抽签规则</strong><span>一行一条，前端按顺序显示</span></div><button type="button" onClick={() => setDraft((current) => ({ ...current, drawRules: [...current.drawRules, ""] }))}>＋ 增加规则</button></div>
          <div className="rule-editor">{draft.drawRules.length ? draft.drawRules.map((rule, index) => <div key={index}><span>{String(index + 1).padStart(2, "0")}</span><textarea rows={2} value={rule} onChange={(e) => setDraft((current) => ({ ...current, drawRules: current.drawRules.map((item, itemIndex) => itemIndex === index ? e.target.value : item) }))} /><button type="button" onClick={() => setDraft((current) => ({ ...current, drawRules: current.drawRules.filter((_, itemIndex) => itemIndex !== index) }))}>×</button></div>) : <p className="content-empty">还没有抽签规则。</p>}</div>

          <div className="content-subhead spaced"><div><strong>奖金设置</strong><span>少年组、青年组分别维护</span></div></div>
          <div className="prize-editors">{(["少年组", "青年组"] as GroupName[]).map((group) => <article key={group}><header><div><strong>{group}</strong><span>{group === "少年组" ? "U16" : "U20"}</span></div><button type="button" onClick={() => addPrize(group)}>＋ 增加名次</button></header>{draft.prizes[group].length ? draft.prizes[group].map((row, index) => <div className="prize-row" key={index}><input value={row[0] ?? ""} onChange={(e) => updatePrize(group, index, 0, e.target.value)} placeholder="冠军 / 8强"/><input value={row[1] ?? ""} onChange={(e) => updatePrize(group, index, 1, e.target.value)} placeholder="¥50,000 / ¥3,500/人"/><button type="button" onClick={() => removePrize(group, index)}>×</button></div>) : <p className="content-empty">暂无奖金数据。</p>}</article>)}</div>
        </section>

        <section id="content-documents" className="content-card">
          <header><div><small>03 · DOCUMENTS</small><h2>赛事文件</h2><p>竞赛规程和裁判员名单可以直接上传 PDF，也可以填写已有文件地址。</p></div><b className={documentReady ? "ready" : "pending"}>{documentReady ? "已有公开文件" : "暂无公开文件"}</b></header>
          <div className="document-grid">{draft.documents.map((document) => <article key={document.documentType}><span>PDF</span><div className="document-fields"><label><small>文件标题</small><input value={document.title} onChange={(e) => updateDocument(document.documentType, { title: e.target.value })} /></label><label><small>文件地址</small><input value={document.url} onChange={(e) => updateDocument(document.documentType, { url: e.target.value })} placeholder="上传后自动生成，也可填写外部 URL" /></label><div className="document-actions"><label className="file-upload"><input type="file" accept="application/pdf" disabled={Boolean(uploading)} onChange={(e) => { const file = e.target.files?.[0]; if (file) uploadPdf(document.documentType, file); e.currentTarget.value = ""; }} />{uploading === document.documentType ? "正在上传…" : "上传 PDF"}</label><label className="publish-check"><input type="checkbox" checked={document.isPublished} onChange={(e) => updateDocument(document.documentType, { isPublished: e.target.checked })} />在赛事文件区展示</label></div></div></article>)}</div>
        </section>

        <section id="content-guides" className="content-card">
          <header><div><small>04 · PARTICIPANT GUIDE</small><h2>参赛友好提示</h2><p>交通住宿和服装要求属于赛事详情的辅助信息，各自可独立保存和发布。</p></div></header>
          <div className="guide-grid">{draft.guides.map((guide) => <article key={guide.guideType}><header><span>{guide.guideType === "transport" ? "行" : "装"}</span><div><strong>{guide.title}</strong><small>{guide.publishStatus === "published" ? "前端展示" : "草稿"}</small></div></header><label><span>标题</span><input value={guide.title} onChange={(e) => updateGuide(guide.guideType, { title: e.target.value })} /></label><label><span>正文</span><textarea rows={7} value={guide.body} onChange={(e) => updateGuide(guide.guideType, { body: e.target.value })} placeholder={guide.guideType === "transport" ? "交通路线、停车、推荐住宿、距离与联系方式……" : "比赛服装、鞋履、Logo、现场着装要求……"} /></label><label className="guide-status"><span>发布状态</span><select value={guide.publishStatus} onChange={(e) => updateGuide(guide.guideType, { publishStatus: e.target.value as "draft" | "published" })}><option value="draft">草稿</option><option value="published">发布</option></select></label></article>)}</div>
        </section>

        <section id="content-release" className="content-card publication-card">
          <header><div><small>05 · RELEASE</small><h2>模块发布控制</h2><p>没有发布的模块不出现在正常公众导航中。赛程、对阵、排名的业务数据在其他后台模块维护，这里只负责最后的公开开关。</p></div><b>{publishedCount} / 6</b></header>
          <div className="publication-list">{publications.map((item) => <article key={item.id} className={item.status === "published" ? "published" : "draft"}><div className="publication-icon">{item.moduleTitle.slice(0,1)}</div><div><strong>{item.moduleTitle}</strong><p>{moduleDescriptions[item.moduleType] || "赛事内容模块"}</p><small>版本 {item.versionNo} · {formatTime(item.publishedAt)}</small></div><b>{item.status === "published" ? "已发布" : "草稿"}</b><button type="button" disabled={working} onClick={() => togglePublication(item.id, item.status)}>{item.status === "published" ? "撤回" : "发布"}</button></article>)}</div>
        </section>

        <footer className="content-savebar"><div><strong>内容草稿</strong><span>保存后仍可继续修改；模块发布状态单独控制。</span></div><button type="submit" disabled={working}>{working ? "正在保存…" : "保存全部内容"}</button></footer>
      </section>
    </form>
  </main>;
}
