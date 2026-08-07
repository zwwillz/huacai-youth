"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import type { DrawSessionDetail } from "@/db/draw-engine";

type MainData = {
  viewerRole: string;
  event: { id: string; shortTitle: string };
  groups: Array<{ id: string; name: string; code: string }>;
  selectedGroupId: string;
  selectedPhase: "main-one" | "main-two";
  phaseTitle: string;
  sourceCount: number;
  sourceReady: boolean;
  sourceNote: string;
  seedCount: number;
  latestSession: null | { id: string; versionNo: number; status: string; entrantCount: number; createdAt: string; confirmedAt: string | null };
};

function href(eventId: string, groupId: string, phase: string) {
  return `/admin/competition/draw?event=${encodeURIComponent(eventId)}&group=${encodeURIComponent(groupId)}&phase=${encodeURIComponent(phase)}`;
}

export default function MainStageWorkbenchClient({ initialData }: { initialData: MainData }) {
  const router = useRouter();
  const [session, setSession] = useState<DrawSessionDetail | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const selectedGroup = initialData.groups.find((item) => item.id === initialData.selectedGroupId);
  const groups = useMemo(() => {
    if (!session) return [] as Array<{ no: number; slots: DrawSessionDetail["slots"] }>;
    const max = initialData.selectedPhase === "main-one" ? 8 : 1;
    return Array.from({ length: max }, (_, index) => ({ no: index + 1, slots: session.slots.filter((slot) => slot.divisionNo === index + 1) }));
  }, [session, initialData.selectedPhase]);

  async function post(body: Record<string, unknown>) {
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/admin/competition/draw", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "操作失败。");
      return result.data as DrawSessionDetail;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "操作失败。");
      return null;
    } finally { setBusy(false); }
  }

  async function load() {
    if (!initialData.latestSession?.id) return;
    setBusy(true); setMessage("");
    try {
      const response = await fetch(`/api/admin/competition/draw?sessionId=${encodeURIComponent(initialData.latestSession.id)}`);
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "抽签读取失败。");
      setSession(result.data as DrawSessionDetail);
    } catch (error) { setMessage(error instanceof Error ? error.message : "抽签读取失败。"); }
    finally { setBusy(false); }
  }

  async function create() {
    const text = initialData.selectedPhase === "main-one"
      ? "确认使用当前64人正赛名单生成抽签草稿？16名种子会按蛇形分散到8个组，其余48人随机入位。"
      : "确认使用当前32强名单生成抽签草稿？16名胜部晋级球员进入种子位，16名败部晋级球员随机入位。";
    if (!window.confirm(text)) return;
    const data = await post({ action: "create", eventId: initialData.event.id, groupId: initialData.selectedGroupId, phaseCode: initialData.selectedPhase });
    if (data) { setSession(data); setMessage("抽签草稿已经生成。请检查签位后再确认正式签表。"); router.refresh(); }
  }

  async function confirm() {
    if (!session || !window.confirm("确认当前抽签成为正式签表？确认后系统会生成完整比赛关系。")) return;
    const data = await post({ action: "confirm", sessionId: session.session.id });
    if (!data) return;
    setSession(data);
    try {
      const response = await fetch("/api/admin/competition/bracket", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "generate", sessionId: data.session.id }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "比赛关系生成失败。");
      setMessage(initialData.selectedPhase === "main-one" ? "正赛第一阶段正式签表已确认：8组双败比赛关系已经生成。" : "正赛第二阶段正式签表已确认：32强单败至冠军及三、四名决赛关系已经生成。");
      router.refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : "比赛关系生成失败。"); }
  }

  async function voidDraw() {
    const id = session?.session.id || initialData.latestSession?.id;
    if (!id) return;
    const reason = window.prompt("请输入作废原因：", "");
    if (!reason) return;
    const data = await post({ action: "void", sessionId: id, reason });
    if (data) { setSession(null); setMessage("原抽签已经作废，可以重新抽签。"); router.refresh(); }
  }

  const visible = session || null;
  return <main className="main-stage-workbench">
    <section className="main-stage-hero"><div><small>正赛抽签引擎</small><h2>{initialData.phaseTitle} · {selectedGroup?.name}</h2><p>{initialData.selectedPhase === "main-one" ? "64人分8组，每组8人双败；每组胜部2人、败部2人，共32人晋级。" : "32强重新抽签，16名胜部晋级球员进入种子位，16名败部晋级球员混抽，单败至冠军。"}</p></div><strong>{initialData.sourceCount}/{initialData.selectedPhase === "main-one" ? 64 : 32}</strong></section>

    <nav className="main-stage-group-tabs">{initialData.groups.map((group) => <Link key={group.id} className={group.id === initialData.selectedGroupId ? "active" : ""} href={href(initialData.event.id, group.id, initialData.selectedPhase)}>{group.name}</Link>)}</nav>
    <nav className="main-stage-phase-tabs"><Link href={href(initialData.event.id, initialData.selectedGroupId, "qualifier-one")}>资格赛第一场</Link><Link href={href(initialData.event.id, initialData.selectedGroupId, "qualifier-two")}>资格赛第二场</Link><Link className={initialData.selectedPhase === "main-one" ? "active" : ""} href={href(initialData.event.id, initialData.selectedGroupId, "main-one")}>正赛第一阶段</Link><Link className={initialData.selectedPhase === "main-two" ? "active" : ""} href={href(initialData.event.id, initialData.selectedGroupId, "main-two")}>正赛第二阶段</Link></nav>

    <section className={`main-stage-ready ${initialData.sourceReady ? "ready" : "waiting"}`}><div><small>名单状态</small><h3>{initialData.sourceReady ? "可以正式抽签" : "等待上一阶段结果"}</h3><p>{initialData.sourceNote}</p></div>{initialData.selectedPhase === "main-one" && <b>种子 {initialData.seedCount}/16</b>}</section>

    <section className="main-stage-action"><div><small>抽签版本</small><h3>{initialData.latestSession ? `V${initialData.latestSession.versionNo} · ${initialData.latestSession.status === "confirmed" ? "已确认" : initialData.latestSession.status === "draft" ? "草稿" : "已作废"}` : "尚未生成"}</h3><p>正式抽签结果与动画展示分离，页面刷新不会重新随机。</p></div><div className="main-stage-buttons">{!initialData.latestSession && <button disabled={!initialData.sourceReady || busy || initialData.viewerRole === "referee"} onClick={create}>{busy ? "生成中..." : "生成抽签草稿"}</button>}{initialData.latestSession && !session && <button disabled={busy} onClick={load}>查看抽签结果</button>}{initialData.latestSession?.status === "confirmed" && <><Link href={`/admin/competition/bracket?session=${encodeURIComponent(initialData.latestSession.id)}&event=${encodeURIComponent(initialData.event.id)}`}>查看完整签表</Link><Link href={`/admin/competition/schedule?session=${encodeURIComponent(initialData.latestSession.id)}`}>赛程与球台</Link></>}</div></section>

    {message && <p className="main-stage-message">{message}</p>}

    {visible && <section className="main-stage-draw"><header><div><small>抽签结果</small><h3>V{visible.session.versionNo} · {visible.session.status === "confirmed" ? "正式签表" : "抽签草稿"}</h3></div><div>{visible.session.status === "draft" && initialData.viewerRole !== "referee" && <button onClick={confirm} disabled={busy}>确认正式签表</button>}{initialData.viewerRole !== "referee" && <button className="danger" onClick={voidDraw} disabled={busy}>作废重抽</button>}</div></header>{initialData.selectedPhase === "main-one" ? <div className="main-stage-groups">{groups.map((group) => <article key={group.no}><h4>第{group.no}组</h4><div>{group.slots.map((slot) => <p key={slot.slotNo}><span>{String(slot.slotNo).padStart(2,"0")}</span><strong>{slot.playerName}</strong><b>{slot.slotType === "seed" ? "种子" : ""}</b></p>)}</div></article>)}</div> : <div className="main-two-slots">{visible.slots.map((slot) => <p key={slot.slotNo}><span>{String(slot.slotNo).padStart(2,"0")}</span><strong>{slot.playerName}</strong><b>{slot.slotType === "seed" ? "胜部种子位" : "败部混抽"}</b></p>)}</div>}</section>}
  </main>;
}
