"use client";

import { useMemo, useState } from "react";
import type { MasterScheduleStage, SchedulePublishData } from "@/db/schedule-publish";

function cloneStages(stages: MasterScheduleStage[]) {
  return stages.map((stage) => ({ ...stage, tags: [...stage.tags] }));
}

export default function SchedulePublishClient({ initialData }: { initialData: SchedulePublishData }) {
  const [data, setData] = useState(initialData);
  const [stages, setStages] = useState(() => cloneStages(initialData.stages));
  const [tagDrafts, setTagDrafts] = useState<Record<number, string>>({});
  const [working, setWorking] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const archived = data.event.status === "archived";
  const published = data.publication.status === "published";
  const detailedPublished = data.detailedSchedule.status === "published" && data.detailedSchedule.hasContent;
  const completion = useMemo(() => stages.filter((stage) => stage.title.trim() && stage.dateLabel.trim() && stage.advancementText.trim() && stage.u16RaceLabel.trim() && stage.u20RaceLabel.trim()).length, [stages]);

  const updateStage = (index: number, patch: Partial<MasterScheduleStage>) => {
    setStages((current) => current.map((stage, rowIndex) => rowIndex === index ? { ...stage, ...patch } : stage));
  };

  const removeTag = (index: number, tagIndex: number) => {
    const stage = stages[index];
    if (!stage) return;
    updateStage(index, { tags: stage.tags.filter((_, current) => current !== tagIndex) });
  };

  const addTag = (index: number) => {
    const value = (tagDrafts[index] || "").trim();
    const stage = stages[index];
    if (!value || !stage || stage.tags.includes(value) || stage.tags.length >= 8) return;
    updateStage(index, { tags: [...stage.tags, value] });
    setTagDrafts((current) => ({ ...current, [index]: "" }));
  };

  const syncSave = async () => {
    const response = await fetch("/api/admin/schedule-publish", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "save", data: { eventId: data.event.id, stages } }),
    });
    const payload = await response.json() as { data?: SchedulePublishData; error?: string };
    if (!response.ok || !payload.data) throw new Error(payload.error || "主赛程保存失败。");
    setData(payload.data);
    setStages(cloneStages(payload.data.stages));
    return payload.data;
  };

  const save = async () => {
    if (archived || working) return;
    setWorking(true); setNotice(""); setError("");
    try {
      const next = await syncSave();
      setNotice(next.publication.status === "published" ? "主赛程已保存，公众端已同步更新。" : "主赛程已保存为后台草稿。");
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "主赛程保存失败。");
    } finally { setWorking(false); }
  };

  const togglePublication = async () => {
    if (archived || working) return;
    setWorking(true); setNotice(""); setError("");
    const nextStatus = published ? "draft" : "published";
    try {
      await syncSave();
      const response = await fetch("/api/admin/schedule-publish", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "publication", eventId: data.event.id, status: nextStatus }),
      });
      const payload = await response.json() as { data?: SchedulePublishData; error?: string };
      if (!response.ok || !payload.data) throw new Error(payload.error || "主赛程发布状态更新失败。");
      setData(payload.data);
      setStages(cloneStages(payload.data.stages));
      setNotice(nextStatus === "published" ? "赛事主赛程已发布到公众端。具体赛程表仍以竞赛执行的发布状态为准。" : "赛事主赛程已取消发布，后台内容仍完整保留。公众端将显示待组委会发布提示。");
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "主赛程发布失败。");
    } finally { setWorking(false); }
  };

  return <main className="content-workspace schedule-publish-workspace">
    <div className="content-layout schedule-publish-layout">
      <aside className="content-sidebar schedule-publish-sidebar">
        <small>当前赛事</small>
        <h1>{data.event.shortTitle || data.event.fullTitle}</h1>
        <p>{data.event.city} · 第 {data.event.stationNo} 站</p>
        <dl className="content-side-status">
          <div><dt>赛事主赛程</dt><dd className={published ? "ok" : ""}>{published ? "已发布" : "草稿"}</dd></div>
          <div><dt>详细赛程表</dt><dd className={detailedPublished ? "ok" : ""}>{detailedPublished ? "已有公开赛程" : "正在编排"}</dd></div>
          <div><dt>阶段资料</dt><dd>{completion}/{stages.length}</dd></div>
        </dl>
        <div className="content-side-note"><strong>两层赛程</strong><p>这里发布的是公众首先看到的阶段主赛程。具体签表、对阵、球台和场次仍由“竞赛执行 → 赛程编排”产生并单独发布。</p></div>
        <div className="content-side-note"><strong>查看赛程表</strong><p>主赛程可以先发布。竞赛执行尚未形成可公开的具体场次时，公众点击“查看赛程表”会看到友好的“正在编排中”提示。</p></div>
      </aside>

      <section className="content-main schedule-publish-main">
        {archived && <div className="content-message content-readonly">该赛事已经归档，赛程发布进入历史只读状态。</div>}
        {notice && <div className="content-message success">✓ {notice}<button type="button" onClick={() => setNotice("")}>×</button></div>}
        {error && <div className="content-message error">! {error}<button type="button" onClick={() => setError("")}>×</button></div>}

        <section className="content-head-card schedule-publish-head">
          <div><small>MASTER SCHEDULE</small><h2>赛程发布</h2><p>维护公众端赛程首页的阶段信息：时间、名称、晋级人数、抽签与赛制标签、局数和晋级说明。详细签表与具体场次不在这里编辑。</p></div>
          <span className={published ? "public" : "draft"}>{published ? "主赛程已发布" : "主赛程草稿"}</span>
        </section>

        <section className="schedule-publish-intro">
          <div><strong>公众端展示结构</strong><span>四个阶段按比赛顺序展示，每个阶段都可以独立调整文字和标签。</span></div>
          <b>{completion === stages.length ? "阶段信息已完整" : `还有 ${stages.length - completion} 个阶段待完善`}</b>
        </section>

        {stages.map((stage, index) => <section className="content-card schedule-stage-editor" key={stage.code}>
          <header>
            <div><small>{stage.phaseNumber || String(index + 1).padStart(2, "0")} · {stage.code.toUpperCase()}</small><h2>{stage.title || "未命名阶段"}</h2><p>这一张卡片对应公众端赛程页中的一个阶段。</p></div>
            <span className="schedule-stage-order">阶段 {String(index + 1).padStart(2, "0")}</span>
          </header>

          <div className="schedule-stage-grid">
            <label className="content-field"><span>阶段名称</span><input disabled={archived} value={stage.title} onChange={(event) => updateStage(index, { title: event.target.value })} placeholder="例如：资格赛第一场" /></label>
            <label className="content-field"><span>比赛时间</span><input disabled={archived} value={stage.dateLabel} onChange={(event) => updateStage(index, { dateLabel: event.target.value })} placeholder="例如：7月25日—27日" /></label>
            <label className="content-field"><span>晋级人数 / 进程</span><input disabled={archived} value={stage.advancementText} onChange={(event) => updateStage(index, { advancementText: event.target.value })} placeholder="例如：N人 → 晋级24人" /></label>
            <label className="content-field"><span>阶段序号</span><input disabled={archived} value={stage.phaseNumber} onChange={(event) => updateStage(index, { phaseNumber: event.target.value })} placeholder="01" /></label>
            <label className="content-field"><span>少年组局数标签</span><input disabled={archived} value={stage.u16RaceLabel} onChange={(event) => updateStage(index, { u16RaceLabel: event.target.value })} placeholder="例如：9局5胜" /></label>
            <label className="content-field"><span>青年组局数标签</span><input disabled={archived} value={stage.u20RaceLabel} onChange={(event) => updateStage(index, { u20RaceLabel: event.target.value })} placeholder="例如：13局7胜" /></label>
          </div>

          <div className="schedule-tag-editor">
            <div className="schedule-field-label"><strong>抽签及赛制标签</strong><span>按需添加，例如“一次抽签到底 / 16区 / 单败 / 双败”。最多8个。</span></div>
            <div className="schedule-tags">{stage.tags.map((tag, tagIndex) => <span key={`${tag}-${tagIndex}`}>{tag}{!archived && <button type="button" aria-label={`删除标签${tag}`} onClick={() => removeTag(index, tagIndex)}>×</button>}</span>)}</div>
            {!archived && <div className="schedule-tag-add"><input value={tagDrafts[index] || ""} onChange={(event) => setTagDrafts((current) => ({ ...current, [index]: event.target.value }))} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addTag(index); } }} placeholder="输入一个标签" /><button type="button" disabled={!tagDrafts[index]?.trim() || stage.tags.length >= 8} onClick={() => addTag(index)}>＋ 添加标签</button></div>}
          </div>

          <label className="content-field schedule-qualification-note"><span>晋级说明</span><textarea disabled={archived} rows={3} value={stage.qualificationNote} onChange={(event) => updateStage(index, { qualificationNote: event.target.value })} placeholder="简要说明本阶段如何晋级到下一阶段" /></label>

          <div className="schedule-stage-preview">
            <div><b>{stage.dateLabel || "时间待定"}</b><strong>{stage.title || "阶段名称"}</strong><span>{stage.advancementText || "晋级人数待定"}</span></div>
            <div className="schedule-stage-preview-tags">{stage.tags.map((tag) => <em key={tag}>{tag}</em>)}<em>{stage.u16RaceLabel || "少年组局数"}</em></div>
            <small>{stage.qualificationNote || "晋级说明待组委会补充。"}</small>
          </div>
        </section>)}

        {!archived && <footer className="content-savebar schedule-publish-savebar">
          <div><strong>保存赛事主赛程</strong><span>{published ? "保存后会立即同步已发布的公众主赛程；具体赛程表不受这里的保存影响。" : "草稿可以先保存未完成内容；确认阶段时间和赛制信息完整后再正式发布。"}</span></div>
          <div className="content-save-actions"><button className="secondary" type="button" disabled={working} onClick={save}>{working ? "正在保存…" : "保存主赛程"}</button><button className={published ? "secondary schedule-unpublish" : undefined} type="button" disabled={working} onClick={togglePublication}>{published ? "取消发布" : "发布主赛程"}</button></div>
        </footer>}
      </section>
    </div>
  </main>;
}
