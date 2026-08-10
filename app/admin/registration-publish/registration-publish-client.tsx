"use client";

import { useState } from "react";
import type { RegistrationBusinessState, RegistrationPublishData } from "@/db/registration-publishing";

function toLocalInput(value: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.slice(0, 16);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

export default function RegistrationPublishClient({ initialData }: { initialData: RegistrationPublishData }) {
  const [data, setData] = useState(initialData);
  const [state, setState] = useState<RegistrationBusinessState>(initialData.registrationState);
  const [startAt, setStartAt] = useState(toLocalInput(initialData.registrationStartAt));
  const [endAt, setEndAt] = useState(toLocalInput(initialData.registrationEndAt));
  const [note, setNote] = useState(initialData.registrationNote);
  const [url, setUrl] = useState(initialData.registrationUrl);
  const [busy, setBusy] = useState<"save" | "publish" | "unpublish" | "">("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function submit(action: "save" | "publish" | "unpublish") {
    setBusy(action); setMessage(""); setError("");
    try {
      if (action === "publish") {
        const saveResponse = await fetch("/api/admin/registration-publish", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ eventId: data.eventId, action: "save", registrationState: state, registrationStartAt: startAt, registrationEndAt: endAt, registrationNote: note, registrationUrl: url }),
        });
        const savePayload = await saveResponse.json() as { data?: RegistrationPublishData; error?: string };
        if (!saveResponse.ok || !savePayload.data) throw new Error(savePayload.error || "报名草稿保存失败。");
      }
      const response = await fetch("/api/admin/registration-publish", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(action === "save"
          ? { eventId: data.eventId, action, registrationState: state, registrationStartAt: startAt, registrationEndAt: endAt, registrationNote: note, registrationUrl: url }
          : { eventId: data.eventId, action }),
      });
      const payload = await response.json() as { data?: RegistrationPublishData; error?: string };
      if (!response.ok || !payload.data) throw new Error(payload.error || "报名发布操作失败。");
      setData(payload.data);
      setState(payload.data.registrationState);
      setStartAt(toLocalInput(payload.data.registrationStartAt));
      setEndAt(toLocalInput(payload.data.registrationEndAt));
      setNote(payload.data.registrationNote);
      setUrl(payload.data.registrationUrl);
      setMessage(action === "save" ? "报名设置草稿已保存。" : action === "publish" ? "报名信息已发布到用户端。" : "报名信息已从用户端撤回，后台草稿保留。" );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "报名发布操作失败。");
    } finally { setBusy(""); }
  }

  const stateLabel = state === "open" ? "报名中" : state === "closed" ? "已截止" : "未开放";
  return <main className="registration-publish-page">
    <section className="registration-publish-head">
      <div><small>REGISTRATION PUBLISHING</small><h2>报名发布</h2><p>当前赛事：{data.eventTitle}。后台保存仅更新草稿；点击“发布到用户端”后，公众概览才读取新的正式版本。</p></div>
      <div className={`registration-publication-state ${data.publicationStatus}`}><small>用户端状态</small><strong>{data.publicationStatus === "published" ? `已发布 V${data.versionNo}` : "未发布"}</strong>{data.hasUnpublishedChanges && <span>有未发布修改</span>}</div>
    </section>

    {(message || error) && <div className={error ? "registration-feedback error" : "registration-feedback"}>{error || message}</div>}

    <section className="registration-publish-card">
      <div className="registration-form-grid">
        <label><span>报名状态</span><select value={state} onChange={(event) => setState(event.target.value as RegistrationBusinessState)}><option value="not_open">未开放</option><option value="open">报名中</option><option value="closed">已截止</option></select><small>当前设置：{stateLabel}</small></label>
        <label><span>报名开始时间</span><input type="datetime-local" value={startAt} onChange={(event) => setStartAt(event.target.value)} /></label>
        <label><span>报名截止时间</span><input type="datetime-local" value={endAt} onChange={(event) => setEndAt(event.target.value)} /></label>
        <label className="wide"><span>报名入口 URL</span><input type="url" value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://..." /><small>第一版支持外部报名页面。状态为“报名中”时，发布前必须填写有效链接。</small></label>
        <label className="wide"><span>报名说明</span><textarea rows={5} value={note} onChange={(event) => setNote(event.target.value)} placeholder="填写报名对象、费用、资料要求、咨询方式等简要说明。" /></label>
      </div>
      <footer><button className="secondary" disabled={Boolean(busy)} onClick={() => void submit("save")}>{busy === "save" ? "保存中…" : "保存草稿"}</button>{data.publicationStatus === "published" ? <button className="secondary" disabled={Boolean(busy)} onClick={() => void submit("unpublish")}>{busy === "unpublish" ? "撤回中…" : "撤回"}</button> : null}<button className="primary" disabled={Boolean(busy)} onClick={() => void submit("publish")}>{busy === "publish" ? "发布中…" : "发布到用户端"}</button></footer>
    </section>
  </main>;
}
