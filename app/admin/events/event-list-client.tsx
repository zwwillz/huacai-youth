"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAdminActionDialog } from "../admin-action-dialog";
import { eventStatusLabel } from "../admin-status";

export type EventRow = { id: string; stationNo: number; shortTitle: string; city: string; venueName: string; startDate: string; endDate: string; status: string; publishStatus: string; publicationCount: number };
function LoadingEventCard({ index }: { index: number }) { return <article aria-busy="true"><header><span>第 — 站</span><b>状态读取中</b></header><h2>赛事名称正在读取</h2><p>城市 · 场馆正在读取</p><dl><div><dt>比赛时间</dt><dd>—</dd></div><div><dt>前端状态</dt><dd>正在读取</dd></div><div><dt>发布模块</dt><dd>— / 6</dd></div></dl><div className="event-settings-card-actions"><Link href="/admin/events" tabIndex={-1}>赛事设置 →</Link><Link href="/admin/content" tabIndex={-1}>内容发布 →</Link><Link href="/admin/competition" tabIndex={-1}>竞赛执行 →</Link></div><span hidden>{index}</span></article>; }

export default function EventListClient({ events, canDelete, loading = false }: { events: EventRow[]; canDelete: boolean; loading?: boolean }) {
  const router = useRouter();
  const [workingId, setWorkingId] = useState("");
  const [message, setMessage] = useState("");
  const { ask, dialog } = useAdminActionDialog();
  const remove = async (event: EventRow) => {
    if (loading) return;
    const ok = await ask({ title: `删除“${event.shortTitle}”`, description: "只有没有报名和比赛数据的误建赛事可以直接删除。这个操作不可撤销。", confirmLabel: "确认删除赛事", tone: "danger" });
    if (!ok) return;
    setWorkingId(event.id); setMessage("");
    try { const response = await fetch(`/api/admin/events/${encodeURIComponent(event.id)}`, { method: "DELETE" }); const payload = await response.json() as { error?: string }; if (!response.ok) throw new Error(payload.error || "赛事删除失败。"); setMessage("赛事已删除。"); router.refresh(); }
    catch (error) { setMessage(error instanceof Error ? error.message : "赛事删除失败。"); }
    finally { setWorkingId(""); }
  };
  return <>{message && <div className="event-settings-message">{message}</div>}<section className="event-settings-index-grid">{loading ? Array.from({ length: 4 }, (_, index) => <LoadingEventCard key={index} index={index} />) : events.map((event) => <article key={event.id}><header><span>第 {event.stationNo} 站</span><b>{eventStatusLabel(event.status)}</b></header><h2>{event.shortTitle}</h2><p>{event.city} · {event.venueName || "场馆待设置"}</p><dl><div><dt>比赛时间</dt><dd>{event.startDate} — {event.endDate}</dd></div><div><dt>前端状态</dt><dd>{event.publishStatus === "published" ? "已发布" : "草稿"}</dd></div><div><dt>发布模块</dt><dd>{event.publicationCount} / 6</dd></div></dl><div className="event-settings-card-actions"><Link href={`/admin/events/${event.id}`}>赛事设置 →</Link><Link href={`/admin/content/${event.id}`}>内容发布 →</Link><Link href={`/admin/competition?event=${encodeURIComponent(event.id)}`}>竞赛执行 →</Link></div>{canDelete && <div className="event-settings-danger"><button type="button" disabled={workingId === event.id} onClick={() => remove(event)}>{workingId === event.id ? "正在删除…" : "删除误建赛事"}</button><span>已有报名或比赛数据的赛事会被系统阻止删除。</span></div>}</article>)}</section>{!loading && dialog}</>;
}
