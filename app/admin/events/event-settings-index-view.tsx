"use client";

import Link from "next/link";
import EventListClient, { type EventRow } from "./event-list-client";

type Props = { events: EventRow[] | null; canDelete: boolean };

export default function EventSettingsIndexView({ events, canDelete }: Props) {
  const loading = events === null;
  const activeCount = loading ? 0 : events.filter((event) => event.status !== "archived").length;
  const archivedCount = loading ? 0 : events.filter((event) => event.status === "archived").length;

  return <main className="event-v2-index" aria-busy={loading} style={loading ? { pointerEvents: "none" } : undefined}>
    <section className="event-v2-page-head">
      <div>
        <small>EVENT MANAGEMENT</small>
        <h2>赛事管理</h2>
        <p>创建赛事并维护赛事的基础主数据。只有赛事创建完成后，赛事运营和竞赛执行才会出现这场赛事。</p>
      </div>
      <div className="event-v2-head-actions">
        <div className="event-v2-head-count"><strong>{loading ? "—" : activeCount}</strong><span>当前赛事</span>{!loading && archivedCount > 0 && <em>{archivedCount} 场已归档</em>}</div>
        <Link className="event-v2-create" href="/admin/events/new">＋ 创建新赛事</Link>
      </div>
    </section>

    <EventListClient events={events ?? []} canDelete={canDelete} loading={loading} />
  </main>;
}
