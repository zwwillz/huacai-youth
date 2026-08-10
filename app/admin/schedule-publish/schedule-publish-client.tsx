"use client";

import { useMemo, useState } from "react";
import { SCHEDULE_GROUPS, type MasterScheduleStage, type ScheduleGroup, type SchedulePublishData } from "@/db/schedule-publish";

function cloneStages(stages: MasterScheduleStage[]) {
  return stages.map((stage) => ({ ...stage, tags: [...stage.tags] }));
}

function groupCode(group: ScheduleGroup) {
  return group === "少年组" ? "U16" : "U20";
}

export default function SchedulePublishClient({ initialData }: { initialData: SchedulePublishData }) {
  const [data, setData] = useState(initialData);
  const [activeGroup, setActiveGroup] = useState<ScheduleGroup>("少年组");
  const [stageDrafts, setStageDrafts] = useState<Record<ScheduleGroup, MasterScheduleStage[]>>(() => ({
    少年组: cloneStages(initialData.groups.少年组.stages),
    青年组: cloneStages(initialData.groups.青年组.stages),
  }));
  const [tagDrafts, setTagDrafts] = useState<Record<string, string>>({});
  const [working, setWorking] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const archived = data.event.status === "archived";
  const currentState = data.groups[activeGroup];
  const published = currentState.status === "published";
  const stages = stageDrafts[activeGroup];
  const detailedPublished = data.detailedSchedule.status === "published";
  const completion = useMemo(() => stages.filter((stage) => stage.title.trim() && stage.dateLabel.trim() && stage.advancementText.trim() && stage.raceLabel.trim()).length, [stages]);

  const updateStage = (index: number, patch: Partial<MasterScheduleStage>) => {
    setStageDrafts((current) => ({
      ...current,
      [activeGroup]: current[activeGroup].map((stage, rowIndex) => rowIndex === index ? { ...stage, ...patch } : stage),
    }));
  };

  const tagKey = (index: number) => `${activeGroup}-${index}`;

  const removeTag = (index: number, tagIndex: number) => {
    const stage = stages[index];
    if (!stage) return;
    updateStage(index, { tags: stage.tags.filter((_, current) => current !== tagIndex) });
  };

  const addTag = (index: number) => {
    const key = tagKey(index);
    const value = (tagDrafts[key] || "").trim();
    const stage = stages[index];
    if (!value || !stage || stage.tags.includes(value) || stage.tags.length >= 8) return;
    updateStage(index, { tags: [...stage.tags, value] });
    setTagDrafts((current) => ({ ...current, [key]: "" }));
  };

  const syncSave = async (group: ScheduleGroup) => {
    const response = await fetch("/api/admin/schedule-publish", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "save", data: { eventId: data.event.id, group, stages: stageDrafts[group] } }),
    });
    const payload = await response.json() as { data?: SchedulePublishData; error?: string };
    if (!response.ok || !payload.data) throw new Error(payload.error || `${group}主赛程保存失败。`);
    setData(payload.data);
    setStageDrafts((current) => ({ ...current, [group]: cloneStages(payload.data!.groups[group].stages) }));
    return payload.data;
  };

  const save = async () => {
    if (archived || working) return;
    setWorking(true); setNotice(""); setError("");
    try {
      const next = await syncSave(activeGroup);
      setNotice(next.groups[activeGroup].status === "published" ? `${activeGroup}主赛程已保存，公众端已同步更新。` : `${activeGroup}主赛程已保存为后台草稿。`);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : `${activeGroup}主赛程保存失败。`);
    } finally { setWorking(false); }
  };

  const togglePublication = async () => {
    if (archived || working) return;
    setWorking(true); setNotice(""); setError("");
    const group = activeGroup;
    const nextStatus = data.groups[group].status === "published" ? "draft" : "published";
    try {
      await syncSave(group);
      const response = await fetch("/api/admin/schedule-publish", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "publication", eventId: data.event.id, group, status: nextStatus }),
      });
      const payload = await response.json() as { data?: SchedulePublishData; error?: string };
      if (!response.ok || !payload.data) throw new Error(payload.error || `${group}主赛程发布状态更新失败。`);
      setData(payload.data);
      setStageDrafts((current) => ({ ...current, [group]: cloneStages(payload.data!.groups[group].stages) }));
      setNotice(nextStatus === "published" ? `${group}主赛程已发布到公众端。` : `${group}主赛程已取消发布，后台内容仍完整保留。`);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : `${group}主赛程发布失败。`);
    } finally { setWorking(false); }
  };

  return <main className="content-workspace schedule-publish-workspace">
    <div className="content-layout schedule-publish-layout">
      <aside className="content-sidebar schedule-publish-sidebar">
        <small>当前赛事</small>
        <h1>{data.event.shortTitle || data.event.fullTitle}</h1>
        <p>{data.event.city} · 第 {data.event.stationNo} 站</p>
        <dl className="content-side-status">
          <div><dt>少年组 U16</dt><dd className={data.groups.少年组.status === "published" ? "ok" : ""}>{data.groups.少年组.status === "published" ? "已发布" : "草稿"}</dd></div>
          <div><dt>青年组 U20</dt><dd className={data.groups.青年组.status === "published" ? "ok" : ""}>{data.groups.青年组.status === "published" ? "已发布" : "草稿"}</dd></div>
          <div><dt>详细赛程表</dt><dd className={detailedPublished ? "ok" : ""}>{detailedPublished ? "竞赛执行已发布" : "竞赛执行中"}</dd></div>
        </dl>
        <div className="content-side-note"><strong>按组别独立发布</strong><p>少年组和青年组分别维护、分别发布。修改一个组别不会覆盖另一个组别已经保存的主赛程。</p></div>
        <div className="content-side-note"><strong>详细赛程继续沿用原数据</strong><p>这里不修改签表、场次、球台和对阵。公众点击“查看赛程表”后仍进入竞赛执行原有的详细赛程页面。</p></div>
      </aside>

      <section className="content-main schedule-publish-main">
        {archived && <div className="content-message content-readonly">该赛事已经归档，赛程发布进入历史只读状态。</div>}
        {notice && <div className="content-message success">✓ {notice}<button type="button" onClick={() => setNotice("")}>×</button></div>}
        {error && <div className="content-message error">! {error}<button type="button" onClick={() => setError("")}>×</button></div>}

        <section className="content-head-card schedule-publish-head">
          <div><small>MASTER SCHEDULE</small><h2>赛程发布</h2><p>少年组与青年组分别维护阶段时间、晋级人数、抽签及赛制标签、局数和晋级说明。</p></div>
          <span className={published ? "public" : "draft"}>{groupCode(activeGroup)} · {published ? "已发布" : "草稿"}</span>
        </section>

        <nav className="schedule-group-switch" aria-label="选择赛程组别">
          {SCHEDULE_GROUPS.map((group) => <button type="button" className={activeGroup === group ? "active" : ""} onClick={() => { setActiveGroup(group); setNotice(""); setError(""); }} key={group}><b>{groupCode(group)}</b><span>{group}</span><em>{data.groups[group].status === "published" ? "已发布" : "草稿"}</em></button>)}
        </nav>

        <section className="schedule-publish-intro">
          <div><strong>{activeGroup} · {groupCode(activeGroup)} 主赛程</strong><span>当前只编辑{activeGroup}。四个阶段按比赛顺序展示，标签可以继续增加或删除。</span></div>
          <b>{completion === stages.length ? "阶段信息已完整" : `还有 ${stages.length - completion} 个阶段待完善`}</b>
        </section>

        {stages.map((stage, index) => <section className="content-card schedule-stage-editor" key={`${activeGroup}-${stage.code}`}>
          <header>
            <div><small>{stage.phaseNumber || String(index + 1).padStart(2, "0")} · {stage.code.toUpperCase()}</small><h2>{stage.title || "未命名阶段"}</h2><p>这一张卡片对应公众端{activeGroup}赛程中的一个阶段。</p></div>
            <span className="schedule-stage-order">阶段 {String(index + 1).padStart(2, "0")}</span>
          </header>

          <div className="schedule-stage-grid">
            <label className="content-field"><span>阶段名称</span><input disabled={archived} value={stage.title} onChange={(event) => updateStage(index, { title: event.target.value })} placeholder="例如：资格赛第一场" /></label>
            <label className="content-field"><span>比赛时间</span><input disabled={archived} value={stage.dateLabel} onChange={(event) => updateStage(index, { dateLabel: event.target.value })} placeholder="例如：7月25日—27日" /></label>
            <label className="content-field"><span>晋级人数 / 进程</span><input disabled={archived} value={stage.advancementText} onChange={(event) => updateStage(index, { advancementText: event.target.value })} placeholder="例如：N人 → 晋级24人" /></label>
            <label className="content-field"><span>阶段序号</span><input disabled={archived} value={stage.phaseNumber} onChange={(event) => updateStage(index, { phaseNumber: event.target.value })} placeholder="01" /></label>
            <label className="content-field wide"><span>{activeGroup}局数标签</span><input disabled={archived} value={stage.raceLabel} onChange={(event) => updateStage(index, { raceLabel: event.target.value })} placeholder={activeGroup === "少年组" ? "例如：9局5胜" : "例如：13局7胜"} /></label>
          </div>

          <div className="schedule-tag-editor">
            <div className="schedule-field-label"><strong>抽签及赛制标签</strong><span>保留现在的默认标签，可继续添加，例如“一次抽签到底 / 16区 / 单败 / 双败”。最多8个。</span></div>
            <div className="schedule-tags">{stage.tags.map((tag, tagIndex) => <span key={`${tag}-${tagIndex}`}>{tag}{!archived && <button type="button" aria-label={`删除标签${tag}`} onClick={() => removeTag(index, tagIndex)}>×</button>}</span>)}</div>
            {!archived && <div className="schedule-tag-add"><input value={tagDrafts[tagKey(index)] || ""} onChange={(event) => setTagDrafts((current) => ({ ...current, [tagKey(index)]: event.target.value }))} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addTag(index); } }} placeholder="输入一个标签" /><button type="button" disabled={!tagDrafts[tagKey(index)]?.trim() || stage.tags.length >= 8} onClick={() => addTag(index)}>＋ 添加标签</button></div>}
          </div>

          <label className="content-field schedule-qualification-note"><span>晋级说明</span><textarea disabled={archived} rows={3} value={stage.qualificationNote} onChange={(event) => updateStage(index, { qualificationNote: event.target.value })} placeholder="简要说明本阶段如何晋级到下一阶段" /></label>

          <div className="schedule-stage-preview">
            <div><b>{stage.dateLabel || "时间待定"}</b><strong>{stage.title || "阶段名称"}</strong><span>{stage.advancementText || "晋级人数待定"}</span></div>
            <div className="schedule-stage-preview-tags">{stage.tags.map((tag) => <em key={tag}>{tag}</em>)}<em>{stage.raceLabel || `${activeGroup}局数`}</em></div>
            <small>{stage.qualificationNote || "晋级说明待组委会补充。"}</small>
          </div>
        </section>)}

        {!archived && <footer className="content-savebar schedule-publish-savebar">
          <div><strong>{activeGroup}主赛程</strong><span>{published ? `保存后立即更新公众端${activeGroup}主赛程；青年组/少年组另一组不受影响。` : `先保存${activeGroup}草稿，确认完整后再单独发布。`}</span></div>
          <div className="content-save-actions"><button className="secondary" type="button" disabled={working} onClick={save}>{working ? "正在保存…" : `保存${activeGroup}赛程`}</button><button className={published ? "secondary schedule-unpublish" : undefined} type="button" disabled={working} onClick={togglePublication}>{published ? `取消${activeGroup}发布` : `发布${activeGroup}赛程`}</button></div>
        </footer>}
      </section>
    </div>
  </main>;
}
