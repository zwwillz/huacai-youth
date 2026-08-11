"use client";

import { useState } from "react";
import { registrationTimeState } from "@/db/registration-time-policy.mjs";
import type { RegistrationPublishData, RegistrationTimeState } from "@/db/registration-publishing";

function toLocalInput(value: string) {
  if (!value) return "";
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value) && !/[zZ]|[+-]\d{2}:?\d{2}$/.test(value)) return value.slice(0, 16);
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.slice(0, 16);
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(date);
  const read = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value || "";
  return `${read("year")}-${read("month")}-${read("day")}T${read("hour")}:${read("minute")}`;
}
function eventStatusLabel(status: string) {
  const labels: Record<string, string> = { draft: "筹备中", upcoming: "即将开始", registration_open: "报名中", registration_closed: "报名截止", in_progress: "进行中", finished: "已结束", archived: "已归档", cancelled: "已取消" };
  return labels[status] || status;
}
function timeStateLabel(state: RegistrationTimeState) {
  if (state === "not_started") return "未开始";
  if (state === "open") return "报名中";
  if (state === "closed") return "已截止";
  return "未设置";
}
function validHttpUrl(value: string) {
  try { return ["http:", "https:"].includes(new URL(value).protocol); } catch { return false; }
}

type Props = { initialData: RegistrationPublishData; currentEventId: string };

export default function RegistrationPublishClient({ initialData, currentEventId }: Props) {
  const [data, setData] = useState(initialData);
  const [startAt, setStartAt] = useState(toLocalInput(initialData.registrationStartAt));
  const [endAt, setEndAt] = useState(toLocalInput(initialData.registrationEndAt));
  const [note, setNote] = useState(initialData.registrationNote);
  const [url, setUrl] = useState(initialData.registrationUrl);
  const [busy, setBusy] = useState<"save" | "publish" | "unpublish" | "">("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const localTimeState = registrationTimeState(startAt, endAt) as RegistrationTimeState;
  const localDirty = startAt !== toLocalInput(data.registrationStartAt) || endAt !== toLocalInput(data.registrationEndAt) || note !== data.registrationNote || url !== data.registrationUrl;

  function assertCurrentEvent() {
    if (currentEventId !== data.eventId) throw new Error("当前赛事上下文发生变化，请刷新页面后重试。");
  }
  function validatePublish() {
    if (data.eventStatus !== "registration_open") throw new Error("当前赛事尚未进入报名阶段，请先在赛事管理中将赛事状态调整为“报名中”。");
    if (!startAt || !endAt) throw new Error("请先填写完整的报名开始时间和报名截止时间。");
    if (localTimeState === "not_set") throw new Error("报名截止时间必须晚于报名开始时间。");
    if (localTimeState === "closed") throw new Error("当前报名截止时间已经过去，如需继续报名，请先调整截止时间。");
    if (!url.trim() || !validHttpUrl(url.trim())) throw new Error("报名期间必须填写有效报名入口。");
  }
  function applyData(next: RegistrationPublishData) {
    setData(next);
    setStartAt(toLocalInput(next.registrationStartAt));
    setEndAt(toLocalInput(next.registrationEndAt));
    setNote(next.registrationNote);
    setUrl(next.registrationUrl);
  }
  async function saveDraft() {
    const response = await fetch("/api/admin/registration-publish", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventId: data.eventId, action: "save", registrationStartAt: startAt, registrationEndAt: endAt, registrationNote: note, registrationUrl: url }),
    });
    const payload = await response.json() as { data?: RegistrationPublishData; error?: string };
    if (!response.ok || !payload.data) throw new Error(payload.error || "报名草稿保存失败。");
    applyData(payload.data);
    return payload.data;
  }
  async function submit(action: "save" | "publish" | "unpublish") {
    setBusy(action); setMessage(""); setError("");
    try {
      assertCurrentEvent();
      if (action === "publish") validatePublish();
      if (action === "save") {
        await saveDraft();
      } else {
        if (action === "publish") await saveDraft();
        assertCurrentEvent();
        const response = await fetch("/api/admin/registration-publish", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ eventId: data.eventId, action }),
        });
        const payload = await response.json() as { data?: RegistrationPublishData; error?: string };
        if (!response.ok || !payload.data) throw new Error(payload.error || "报名发布操作失败。");
        applyData(payload.data);
      }
      setMessage(action === "save" ? "报名设置草稿已保存。" : action === "publish" ? "报名信息已发布到用户端。" : "报名信息已从用户端撤回，后台草稿保留。" );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "报名发布操作失败。");
    } finally { setBusy(""); }
  }

  const publicationLabel = data.publicationStatus === "published" ? `已发布 V${data.versionNo}` : "未发布";
  return <main className="registration-publish-page">
    <section className="registration-publish-head">
      <div><small>REGISTRATION PUBLISHING</small><h2>报名发布</h2><p>当前赛事：{data.eventTitle}。赛事是否处于报名阶段由“赛事管理”维护；这里仅维护报名时间、说明、入口和用户端正式版本。</p></div>
      <div className={`registration-publication-state ${data.publicationStatus}`}><small>用户端</small><strong>{publicationLabel}</strong>{(data.hasUnpublishedChanges || localDirty) && <span>{localDirty ? "有未保存修改" : "有未发布修改"}</span>}</div>
    </section>

    {(message || error) && <div className={error ? "registration-feedback error" : "registration-feedback"}>{error || message}</div>}
    {data.eventStatus === "registration_open" && localTimeState === "closed" && <div className="registration-feedback warning">报名时间已经截止，建议将赛事状态调整为“报名截止”。</div>}

    <section className="registration-publish-card">
      <div className="registration-status-grid">
        <article><small>赛事当前阶段</small><strong>{eventStatusLabel(data.eventStatus)}</strong><span>来自赛事管理</span></article>
        <article><small>当前报名时间状态</small><strong>{timeStateLabel(localTimeState)}</strong><span>{startAt && endAt ? `${startAt.replace("T", " ")} ～ ${endAt.replace("T", " ")}` : "请填写完整报名时间"}</span></article>
        <article><small>用户端</small><strong>{publicationLabel}</strong><span>{data.hasUnpublishedChanges || localDirty ? "存在未发布修改" : "当前无待发布修改"}</span></article>
      </div>
      <div className="registration-form-grid">
        <label><span>报名开始时间</span><input type="datetime-local" value={startAt} onChange={(event) => setStartAt(event.target.value)} /><small>按赛事所在地北京时间填写。</small></label>
        <label><span>报名截止时间</span><input type="datetime-local" value={endAt} onChange={(event) => setEndAt(event.target.value)} /><small>到达截止时间后，公众端自动显示“报名已截止”并移除报名按钮。</small></label>
        <label className="wide"><span>报名入口 URL</span><input type="url" value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://..." /><small>发布正式报名信息时必须是有效的 http / https 外部报名入口。</small></label>
        <label className="wide"><span>报名说明</span><textarea rows={5} value={note} onChange={(event) => setNote(event.target.value)} placeholder="填写报名对象、费用、资料要求、咨询方式等简要说明。" /></label>
      </div>
      <footer><button className="secondary" disabled={Boolean(busy)} onClick={() => void submit("save")}>{busy === "save" ? "保存中…" : "保存草稿"}</button>{data.publicationStatus === "published" ? <button className="secondary" disabled={Boolean(busy)} onClick={() => void submit("unpublish")}>{busy === "unpublish" ? "撤回中…" : "撤回"}</button> : null}<button className="primary" disabled={Boolean(busy)} onClick={() => void submit("publish")}>{busy === "publish" ? "发布中…" : "发布到用户端"}</button></footer>
    </section>
  </main>;
}
