"use client";

import Link from "next/link";
import EventListClient, { type EventRow } from "./event-list-client";

type Props = { events: EventRow[] | null; canDelete: boolean };

export default function EventSettingsIndexView({ events, canDelete }: Props) {
  const loading = events === null;
  return <main className="event-settings-index" aria-busy={loading} style={loading ? { pointerEvents: "none" } : undefined}>
    <header className="event-settings-index-head">
      <div><small>赛事管理</small><h1>赛事设置</h1><p>这里是所有后续业务的起点：先创建赛事，再进入本站的内容发布、报名审核、球员管理与竞赛执行。创建赛事本身不受“当前赛事”切换影响。</p></div>
      <div className="event-settings-index-head-actions"><Link className="event-settings-create" href="/admin/events/new">＋ 创建新赛事</Link><span>{loading ? "— 场赛事" : `${events.length} 场赛事`}</span></div>
    </header>
    <EventListClient events={events ?? []} canDelete={canDelete} loading={loading} />
  </main>;
}
