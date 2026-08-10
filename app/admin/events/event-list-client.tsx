"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAdminActionDialog } from "../admin-action-dialog";
import { eventStatusLabel } from "../admin-status";

export type EventRow = {
  id: string;
  year: number;
  stationNo: number;
  shortTitle: string;
  fullTitle: string;
  city: string;
  venueName: string;
  startDate: string;
  endDate: string;
  status: string;
  publishStatus: string;
  isHidden: boolean;
  groupNames: string;
};

type LifecycleAction = "hide" | "show" | "archive" | "restore";

function lifecycleClass(status: string) {
  if (status === "registration_open") return "status-registration";
  if (status === "in_progress") return "status-progress";
  if (status === "finished") return "status-finished";
  if (status === "registration_closed") return "status-closed";
  return "status-neutral";
}

function lifecycleStyle(status: string) {
  if (status === "registration_open") return { color: "#b73548", background: "#fff0f2" };
  if (status === "in_progress") return { color: "#23764a", background: "#eaf8ef" };
  if (status === "finished") return { color: "#6f6972", background: "#f0eef2" };
  if (status === "registration_closed") return { color: "#825e22", background: "#fff4df" };
  return { color: "#665d6b", background: "#f2eff4" };
}

const finishedStyle = { color: "#6f6972", background: "#f0eef2" };
const archivedStyle = { color: "#3567a8", background: "#eaf2ff" };
const hiddenStyle = { color: "#9b681f", background: "#fff0d5" };

function LoadingCard({ index }: { index: number }) {
  return <article className="event-v2-card loading" aria-busy="true"><div className="event-v2-card-top"><span>第 — 站</span><b>读取中</b></div><h3>赛事名称正在读取</h3><p>城市 · 比赛日期 · 参赛组别</p><div className="event-v2-card-actions"><span>赛事设置</span><span>赛事运营</span><span>竞赛执行</span></div><span hidden>{index}</span></article>;
}

export default function EventListClient({ events, canDelete, loading = false }: { events: EventRow[]; canDelete: boolean; loading?: boolean }) {
  const router = useRouter();
  const [workingId, setWorkingId] = useState("");
  const [message, setMessage] = useState("");
  const [openMoreId, setOpenMoreId] = useState("");
  const { ask, dialog } = useAdminActionDialog();

  useEffect(() => {
    const close = (event: PointerEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target?.closest(".event-v2-more")) setOpenMoreId("");
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, []);

  const lifecycle = async (event: EventRow, action: LifecycleAction) => {
    if (loading || workingId) return;
    setOpenMoreId("");
    if (action === "archive") {
      const ok = await ask({
        title: `归档“${event.shortTitle}”`,
        description: "归档后赛事进入历史只读状态，不能继续修改，也不能删除。系统管理员可以在需要时撤回归档。",
        confirmLabel: "确认归档",
        tone: "danger",
      });
      if (!ok) return;
    }
    if (action === "restore") {
      const ok = await ask({
        title: `撤回“${event.shortTitle}”归档`,
        description: "撤回后赛事恢复为“已结束”状态，可重新进入赛事管理和赛事运营进行维护。",
        confirmLabel: "撤回归档",
      });
      if (!ok) return;
    }
    setWorkingId(event.id); setMessage("");
    try {
      const response = await fetch(`/api/admin/events/${encodeURIComponent(event.id)}/lifecycle`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error || "赛事状态修改失败。");
      setMessage(action === "hide" ? "赛事已从公众前端隐藏。" : action === "show" ? "赛事已恢复公众前端显示。" : action === "restore" ? "赛事已撤回归档，恢复为已结束状态。" : "赛事已归档为历史只读状态。");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "赛事状态修改失败。");
    } finally { setWorkingId(""); }
  };

  const remove = async (event: EventRow) => {
    if (loading || workingId || event.publishStatus === "published") return;
    setOpenMoreId("");
    const ok = await ask({
      title: `删除“${event.shortTitle}”`,
      description: "删除只用于误建赛事。赛事必须先撤回前端发布，且尚未开始执行、没有报名或比赛数据、也未归档。这个操作不可撤销。",
      confirmLabel: "确认删除赛事",
      tone: "danger",
    });
    if (!ok) return;
    setWorkingId(event.id); setMessage("");
    try {
      const response = await fetch(`/api/admin/events/${encodeURIComponent(event.id)}`, { method: "DELETE" });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error || "赛事删除失败。");
      setMessage("误建赛事已删除。");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "赛事删除失败。");
    } finally { setWorkingId(""); }
  };

  const cards = loading ? Array.from({ length: 3 }, (_, index) => <LoadingCard key={index} index={index} />) : events.map((event) => {
    const archived = event.status === "archived";
    const busy = workingId === event.id;
    const moreOpen = openMoreId === event.id;
    const published = event.publishStatus === "published";
    return <article className={archived ? "event-v2-card archived" : "event-v2-card"} key={event.id}>
      <div className="event-v2-card-top">
        <div className="event-v2-card-tags"><span>第 {event.stationNo} 站</span><small>{event.year}赛季</small></div>
        <div className="event-v2-card-state">
          {archived ? <>
            <b className="status-finished" style={finishedStyle}>已结束</b>
            <em className="status-archived" style={archivedStyle}>已归档</em>
          </> : <b className={lifecycleClass(event.status)} style={lifecycleStyle(event.status)}>{eventStatusLabel(event.status)}</b>}
          {event.isHidden && <em className="status-hidden" style={hiddenStyle}>前端隐藏</em>}
        </div>
      </div>
      <h3>{event.fullTitle || event.shortTitle}</h3>
      <p className="event-v2-meta"><span>{event.city}</span><i /> <span>{event.startDate} — {event.endDate}</span>{event.groupNames && <><i /><span>{event.groupNames}</span></>}</p>

      <div className="event-v2-card-bottom">
        <div className="event-v2-card-actions">
          <Link className="primary" href={`/admin/events/${event.id}`}>{archived ? "查看赛事" : "编辑赛事"}</Link>
          {!archived && <Link href={`/admin/content/${event.id}`}>赛事运营</Link>}
          {!archived && <Link href={`/admin/competition?event=${encodeURIComponent(event.id)}`}>竞赛执行</Link>}
          {archived && canDelete && <button className="event-v2-restore" type="button" disabled={busy} onClick={() => lifecycle(event, "restore")}>撤回归档</button>}
        </div>
        {!archived && <div className={moreOpen ? "event-v2-more open" : "event-v2-more"}>
          <button className="event-v2-more-trigger" type="button" aria-expanded={moreOpen} onClick={() => setOpenMoreId((current) => current === event.id ? "" : event.id)}>更多</button>
          {moreOpen && <div>
            <button type="button" disabled={busy} onClick={() => lifecycle(event, event.isHidden ? "show" : "hide")}>{event.isHidden ? "恢复前端显示" : "隐藏赛事"}</button>
            <button type="button" disabled={busy || event.status !== "finished"} title={event.status !== "finished" ? "只有已结束赛事可以归档" : undefined} onClick={() => lifecycle(event, "archive")}>归档赛事</button>
            {canDelete && <button className="danger" type="button" disabled={busy || published} title={published ? "前端已发布赛事不能删除，请先在内容发布中撤回赛事概览" : undefined} onClick={() => remove(event)}>删除误建赛事</button>}
          </div>}
        </div>}
      </div>
    </article>;
  });

  return <>
    {message && <div className="event-v2-message">{message}</div>}
    <section className="event-v2-list">{cards}</section>
    {!loading && !events.length && <section className="event-v2-empty"><strong>还没有赛事</strong><p>创建第一场赛事后，赛事运营和竞赛执行才会建立对应工作空间。</p><Link href="/admin/events/new">创建新赛事</Link></section>}
    {!loading && dialog}
  </>;
}
