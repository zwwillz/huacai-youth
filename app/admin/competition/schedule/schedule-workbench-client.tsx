"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { ScheduleWorkspaceData } from "@/db/schedule-engine";

type Props = { initialData: ScheduleWorkspaceData };
type SlotDraft = { matchDate: string; startTime: string };

const DEFAULT_TIMES = ["09:00", "10:45", "13:30", "15:15", "17:00", "18:45", "20:30"];

function addDays(date: string, days: number) {
  const value = new Date(`${date}T12:00:00`);
  if (Number.isNaN(value.getTime())) return date;
  value.setDate(value.getDate() + days);
  return value.toISOString().slice(0, 10);
}

function slotLabel(date: string, time: string) {
  return `${date.slice(5).replace("-", "/")} ${time}`;
}

export default function ScheduleWorkbenchClient({ initialData }: Props) {
  const [data, setData] = useState(initialData);
  const [tableCount, setTableCount] = useState(initialData.tables.length || initialData.bracket.venueTableCount || 32);
  const [tableMode, setTableMode] = useState<"auto" | "manual">("auto");
  const [tvText, setTvText] = useState(initialData.tables.filter((table) => table.isTv).map((table) => table.positionNo).join(","));
  const [manualLabels, setManualLabels] = useState<string[]>(() => initialData.tables.length ? initialData.tables.map((table) => table.displayName) : Array.from({ length: initialData.bracket.venueTableCount || 32 }, (_, index) => `${index + 1}号台`));
  const [slotDrafts, setSlotDrafts] = useState<SlotDraft[]>(() => initialData.timeSlots.length ? initialData.timeSlots.map((slot) => ({ matchDate: slot.matchDate, startTime: slot.startTime })) : DEFAULT_TIMES.map((startTime) => ({ matchDate: initialData.bracket.eventStartDate, startTime })));
  const [minRestSlots, setMinRestSlots] = useState(initialData.schedule?.minRestSlots ?? 0);
  const [autoReferees, setAutoReferees] = useState(initialData.schedule?.refereeMode === "auto");
  const [selectedSlotId, setSelectedSlotId] = useState(initialData.timeSlots[0]?.id ?? "");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const tvPositions = useMemo(() => [...new Set(tvText.split(/[，,\s]+/).map((value) => Number(value)).filter((value) => Number.isInteger(value) && value >= 1 && value <= tableCount))], [tvText, tableCount]);
  const tablePreview = useMemo(() => {
    let normalNo = 0;
    return Array.from({ length: tableCount }, (_, index) => {
      const positionNo = index + 1;
      if (tableMode === "manual") return { positionNo, label: manualLabels[index] || `${positionNo}号台`, isTv: /^tv/i.test((manualLabels[index] || "").replaceAll("台", "")) };
      const tvIndex = tvPositions.indexOf(positionNo);
      if (tvIndex >= 0) return { positionNo, label: `TV${tvIndex + 1}台`, isTv: true };
      normalNo += 1;
      return { positionNo, label: `${normalNo}号台`, isTv: false };
    });
  }, [tableCount, tableMode, manualLabels, tvPositions]);

  const assignmentsBySlot = useMemo(() => {
    const map = new Map<string, typeof data.assignments>();
    for (const assignment of data.assignments) {
      const key = assignment.timeSlotId || "unassigned";
      const list = map.get(key) ?? [];
      list.push(assignment);
      map.set(key, list);
    }
    return map;
  }, [data.assignments]);

  const currentAssignments = assignmentsBySlot.get(selectedSlotId) ?? [];

  async function post(body: Record<string, unknown>) {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/competition/schedule", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...body, sessionId: data.drawSessionId }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "操作失败。");
      const next = result.data as ScheduleWorkspaceData;
      setData(next);
      if (next.timeSlots.length && !next.timeSlots.some((slot) => slot.id === selectedSlotId)) setSelectedSlotId(next.timeSlots[0].id);
      return next;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "操作失败。");
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function saveTables() {
    const next = await post({ action: "save_tables", totalCount: tableCount, mode: tableMode, tvPositions, manualLabels });
    if (next) {
      setManualLabels(next.tables.map((table) => table.displayName));
      setTvText(next.tables.filter((table) => table.isTv).map((table) => table.positionNo).join(","));
      setMessage("球台设置已保存。TV台只是显示名称与后台标记，不会改变签表关系。其余普通球台已按位置自动顺延编号。");
    }
  }

  async function saveSlots() {
    const next = await post({ action: "save_time_slots", slots: slotDrafts });
    if (next) {
      setSlotDrafts(next.timeSlots.map((slot) => ({ matchDate: slot.matchDate, startTime: slot.startTime })));
      setSelectedSlotId(next.timeSlots[0]?.id ?? "");
      setMessage(`已保存 ${next.timeSlots.length} 个比赛时间段。时间段可以跨多天设置。`);
    }
  }

  async function generate() {
    if (!window.confirm("确认根据当前时间段和球台自动编排赛程？\n\n系统会先排附加赛，再按32进16、16进8、8进4……逐轮安排；BYE自动晋级节点不会占用球台。")) return;
    const next = await post({ action: "generate", minRestSlots, autoAssignReferees: autoReferees });
    if (next) {
      setSelectedSlotId(next.timeSlots[0]?.id ?? "");
      setMessage(`自动排程完成，共安排 ${next.assignments.length} 场实际比赛。可以逐场人工调整时间、球台和裁判。`);
    }
  }

  async function clearSchedule() {
    if (!window.confirm("确认清空当前自动排程？签表和抽签结果不会删除。")) return;
    const next = await post({ action: "clear" });
    if (next) setMessage("赛程编排已清空，可以重新调整时间段、球台后再次生成。签表关系保持不变。");
  }

  async function updateAssignment(assignmentId: string, timeSlotId: string, tableId: string, refereeUserId: string) {
    const next = await post({ action: "update_assignment", assignmentId, timeSlotId: timeSlotId || null, tableId: tableId || null, refereeUserId: refereeUserId || null });
    if (next) setMessage("该场比赛已经人工调整并记录日志。裁判信息仅后台可见。之后公众端只映射比赛时间和台号。");
  }

  function changeManualLabel(index: number, value: string) {
    setManualLabels((current) => {
      const next = Array.from({ length: tableCount }, (_, item) => current[item] || `${item + 1}号台`);
      next[index] = value;
      return next;
    });
  }

  function addTime() {
    const last = slotDrafts[slotDrafts.length - 1] ?? { matchDate: data.bracket.eventStartDate, startTime: "09:00" };
    setSlotDrafts((current) => [...current, { ...last }]);
  }

  function addNextDayTemplate() {
    const latestDate = slotDrafts.map((slot) => slot.matchDate).sort().at(-1) || data.bracket.eventStartDate;
    const nextDate = addDays(latestDate, 1);
    setSlotDrafts((current) => [...current, ...DEFAULT_TIMES.map((startTime) => ({ matchDate: nextDate, startTime }))]);
  }

  return <main className="schedule-workbench">
    <section className="schedule-hero">
      <div><small>SCHEDULE ENGINE</small><h2>{data.bracket.eventTitle}</h2><p>{data.bracket.groupName} · {data.bracket.phaseTitle}。签表关系已经固定；这里负责比赛日期、时间段、台号和后台裁判分配。换时间、换球台不会改变抽签与晋级关系。</p></div>
      <Link href={`/admin/competition/bracket?session=${encodeURIComponent(data.drawSessionId)}`}>返回完整签表</Link>
    </section>

    <section className="schedule-steps">
      <article className={data.tables.length ? "done" : "active"}><span>01</span><b>球台设置</b><small>{data.tables.length ? `${data.tables.length}张已设置` : "待设置"}</small></article>
      <i>→</i><article className={data.timeSlots.length ? "done" : data.tables.length ? "active" : ""}><span>02</span><b>比赛时间段</b><small>{data.timeSlots.length ? `${data.timeSlots.length}个时段` : "待设置"}</small></article>
      <i>→</i><article className={data.schedule ? "done" : data.timeSlots.length ? "active" : ""}><span>03</span><b>自动排程</b><small>{data.schedule ? `${data.assignments.length}场` : "待生成"}</small></article>
      <i>→</i><article className={data.schedule ? "active" : ""}><span>04</span><b>人工调整</b><small>时间 / 台号 / 裁判</small></article>
    </section>

    {message && <p className="schedule-message">{message}</p>}

    <section className="schedule-layout">
      <div className="schedule-main">
        <section className="schedule-panel">
          <header><div><small>01 · TABLES</small><h3>球台设置</h3></div><span>赛事级设置</span></header>
          <div className="table-config-grid">
            <label><span>球台总数</span><input type="number" min={1} max={128} value={tableCount} disabled={Boolean(data.schedule)} onChange={(event) => { const count = Math.max(1, Math.min(128, Number(event.target.value) || 1)); setTableCount(count); setManualLabels((current) => Array.from({ length: count }, (_, index) => current[index] || `${index + 1}号台`)); }}/><small>场馆资料当前记录 {data.bracket.venueTableCount || "未设置"} 张，仅作参考。</small></label>
            <label><span>台号方式</span><select value={tableMode} disabled={Boolean(data.schedule)} onChange={(event) => setTableMode(event.target.value as "auto" | "manual")}><option value="auto">顺序编号 + TV台插入</option><option value="manual">全部手工填写台号</option></select><small>推荐使用“顺序编号 + TV台插入”，临场配置最快。</small></label>
            {tableMode === "auto" && <label className="table-tv-input"><span>TV台所在物理位置</span><input value={tvText} disabled={Boolean(data.schedule)} onChange={(event) => setTvText(event.target.value)} placeholder="例如：1 或 1,8"/><small>例如填“1,8”：第1位置显示TV1台、第8位置显示TV2台，其余普通台自动依次编号，不会出现断号。</small></label>}
          </div>
          <div className="table-preview">{tablePreview.map((table, index) => <div className={table.isTv ? "tv" : ""} key={table.positionNo}><span>位置 {table.positionNo}</span>{tableMode === "manual" ? <input value={manualLabels[index] || ""} disabled={Boolean(data.schedule)} onChange={(event) => changeManualLabel(index, event.target.value)}/> : <strong>{table.label}</strong>}{table.isTv && <b>TV</b>}</div>)}</div>
          <div className="schedule-actions"><button type="button" onClick={saveTables} disabled={busy || Boolean(data.schedule)}>{busy ? "保存中..." : "保存球台设置"}</button>{data.schedule && <small>已有赛程时先清空排程，才能修改球台结构，避免已有比赛失去台号。</small>}</div>
        </section>

        <section className="schedule-panel">
          <header><div><small>02 · TIME WINDOWS</small><h3>比赛日期与时间段</h3></div><span>可跨多天</span></header>
          <p className="schedule-help">每一个时间段代表一轮可同时开台的比赛波次。默认模板采用 09:00、10:45、13:30……；可以自由增加、删除或修改，不写死。</p>
          <div className="time-slot-editor">{slotDrafts.map((slot, index) => <div key={`${index}-${slot.matchDate}-${slot.startTime}`}><span>{index + 1}</span><label><small>日期</small><input type="date" value={slot.matchDate} disabled={Boolean(data.schedule)} onChange={(event) => setSlotDrafts((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, matchDate: event.target.value } : item))}/></label><label><small>开始时间</small><input type="time" value={slot.startTime} disabled={Boolean(data.schedule)} onChange={(event) => setSlotDrafts((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, startTime: event.target.value } : item))}/></label><button type="button" disabled={Boolean(data.schedule) || slotDrafts.length <= 1} onClick={() => setSlotDrafts((current) => current.filter((_, itemIndex) => itemIndex !== index))}>删除</button></div>)}</div>
          <div className="schedule-actions"><button className="secondary" type="button" disabled={Boolean(data.schedule)} onClick={addTime}>＋ 添加时间段</button><button className="secondary" type="button" disabled={Boolean(data.schedule)} onClick={addNextDayTemplate}>＋ 下一比赛日模板</button><button type="button" disabled={busy || Boolean(data.schedule)} onClick={saveSlots}>保存时间段</button></div>
        </section>

        <section className="schedule-panel">
          <header><div><small>03 · AUTO SCHEDULE</small><h3>自动排程</h3></div><span>{data.schedule ? "已生成草稿" : "未生成"}</span></header>
          <div className="schedule-metrics"><article><span>实际比赛</span><strong>{data.bracket.playableMatchCount}</strong><small>BYE不占球台</small></article><article><span>可用球台</span><strong>{data.tables.length}</strong><small>含TV台</small></article><article><span>时间段</span><strong>{data.timeSlots.length}</strong><small>跨比赛日累计</small></article><article><span>赛事裁判</span><strong>{data.referees.length}</strong><small>仅后台可见</small></article></div>
          <div className="schedule-options">
            <label><span>轮次之间预留空档</span><select value={minRestSlots} disabled={Boolean(data.schedule)} onChange={(event) => setMinRestSlots(Number(event.target.value))}><option value={0}>不额外空档</option><option value={1}>预留1个时间段</option><option value={2}>预留2个时间段</option></select><small>系统始终先完成前一轮波次再进入下一轮；这里是额外增加的全局缓冲。</small></label>
            <label className="referee-toggle"><input type="checkbox" checked={autoReferees} disabled={Boolean(data.schedule) || data.referees.length === 0} onChange={(event) => setAutoReferees(event.target.checked)}/><span><b>自动分配赛事裁判</b><small>同一时间段每名裁判最多自动分配1场；如果裁判少于同时开台数，其余比赛先留空，后续人工指定。</small></span></label>
          </div>
          <div className="schedule-actions">{!data.schedule ? <button type="button" disabled={busy || !data.tables.length || !data.timeSlots.length} onClick={generate}>{busy ? "正在编排..." : "自动生成赛程"}</button> : <><button className="danger" type="button" disabled={busy} onClick={clearSchedule}>清空排程并重新设置</button><span>生成于 {data.schedule.generatedAt}</span></>}</div>
        </section>

        {data.schedule && <section className="schedule-panel schedule-result-panel">
          <header><div><small>04 · MANUAL ADJUSTMENT</small><h3>赛程草稿与人工调整</h3></div><span>{data.assignments.length} 场</span></header>
          <div className="schedule-slot-tabs">{data.timeSlots.map((slot) => <button type="button" key={slot.id} className={selectedSlotId === slot.id ? "active" : ""} onClick={() => setSelectedSlotId(slot.id)}><b>{slotLabel(slot.matchDate, slot.startTime)}</b><small>{assignmentsBySlot.get(slot.id)?.length || 0}场</small></button>)}</div>
          <div className="schedule-match-list">{currentAssignments.length ? currentAssignments.map((assignment) => <ScheduleMatchRow key={assignment.id} assignment={assignment} data={data} busy={busy} onSave={updateAssignment}/>) : <div className="schedule-empty">这个时间段暂时没有比赛。</div>}</div>
        </section>}
      </div>

      <aside className="schedule-side">
        <section><small>台号设计</small><h3>物理位置 ≠ 显示台号</h3><p>推荐固定“物理位置1、2、3…”不变，显示台号可以变成TV1台、TV2台或普通1号台、2号台。这样插入TV台时，其余普通台可以自动连续编号。</p></section>
        <section><small>自动排程顺序</small><h3>附加赛 → 逐轮推进</h3><p>系统先排完附加赛，再统一排32进16，然后16进8、8进4、4进2、分区决胜。不会为了塞满空台而让后轮提前到依赖比赛之前。</p></section>
        <section><small>裁判信息</small><h3>只属于后台</h3><p>裁判分配不会映射到公众前端。以后公众赛程只显示比赛时间、台号、双方选手和状态；裁判姓名只供组委会和裁判组工作使用。</p></section>
      </aside>
    </section>
  </main>;
}

function ScheduleMatchRow({ assignment, data, busy, onSave }: { assignment: ScheduleWorkspaceData["assignments"][number]; data: ScheduleWorkspaceData; busy: boolean; onSave: (id: string, time: string, table: string, referee: string) => Promise<void> }) {
  const [timeSlotId, setTimeSlotId] = useState(assignment.timeSlotId || "");
  const [tableId, setTableId] = useState(assignment.tableId || "");
  const [refereeUserId, setRefereeUserId] = useState(assignment.refereeUserId || "");
  return <article className={assignment.isManual ? "manual" : ""}>
    <div className="schedule-match-main"><span>{assignment.matchCode}</span><strong>{assignment.playerAName || "待产生"} <i>VS</i> {assignment.playerBName || "待产生"}</strong><small>{assignment.divisionNo ? `第${assignment.divisionNo}区 · ` : ""}{assignment.roundName}{assignment.isManual ? " · 已人工调整" : ""}</small></div>
    <label><small>时间</small><select value={timeSlotId} onChange={(event) => setTimeSlotId(event.target.value)}>{data.timeSlots.map((slot) => <option key={slot.id} value={slot.id}>{slotLabel(slot.matchDate, slot.startTime)}</option>)}</select></label>
    <label><small>台号</small><select value={tableId} onChange={(event) => setTableId(event.target.value)}>{data.tables.map((table) => <option key={table.id} value={table.id}>{table.displayName}</option>)}</select></label>
    <label><small>裁判（后台）</small><select value={refereeUserId} onChange={(event) => setRefereeUserId(event.target.value)}><option value="">未指定</option>{data.referees.map((referee) => <option key={referee.id} value={referee.id}>{referee.displayName || referee.username}</option>)}</select></label>
    <button type="button" disabled={busy} onClick={() => onSave(assignment.id, timeSlotId, tableId, refereeUserId)}>保存调整</button>
  </article>;
}
