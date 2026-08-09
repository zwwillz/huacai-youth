"use client";

import Link from "next/link";
import EventListClient, { type EventRow } from "./event-list-client";

type Props = { events: EventRow[] | null; canDelete: boolean };

export default function EventSettingsIndexView({ events, canDelete }: Props) {
  const loading = events === null;
  const rows = events ?? [];
  const currentCount = loading ? 0 : rows.filter((event) => event.status !== "finished" && event.status !== "archived").length;
  const finishedCount = loading ? 0 : rows.filter((event) => event.status === "finished").length;
  const archivedCount = loading ? 0 : rows.filter((event) => event.status === "archived").length;
  const hiddenCount = loading ? 0 : rows.filter((event) => event.isHidden && event.status !== "archived").length;

  return <main className="event-v2-index" aria-busy={loading} style={loading ? { pointerEvents: "none" } : undefined}>
    <section className="event-v2-page-head">
      <div>
        <small>EVENT MANAGEMENT</small>
        <h2>赛事管理</h2>
        <p>创建赛事并维护赛事的基础主数据。只有赛事创建完成后，赛事运营和竞赛执行才会出现这场赛事。</p>
      </div>
      <Link className="event-v2-create" href="/admin/events/new">＋ 创建新赛事</Link>
    </section>

    <div className="event-v2-index-layout">
      <section className="event-v2-index-main"><EventListClient events={rows} canDelete={canDelete} loading={loading} /></section>
      <aside className="event-v2-index-summary">
        <small>赛事概况</small>
        <h3>当前赛事状态</h3>
        <p>这里仅统计赛事生命周期，不统计内容发布模块。</p>
        <dl>
          <div><dt>当前赛事</dt><dd>{loading ? "—" : currentCount}</dd></div>
          <div><dt>已结束</dt><dd>{loading ? "—" : finishedCount}</dd></div>
          <div><dt>已归档</dt><dd>{loading ? "—" : archivedCount}</dd></div>
          <div><dt>前端隐藏</dt><dd>{loading ? "—" : hiddenCount}</dd></div>
        </dl>
        <div className="event-v2-summary-note"><strong>生命周期说明</strong><p>隐藏只影响公众前端；已结束赛事仍可维护；归档后进入历史只读，系统管理员可以撤回归档。</p></div>
      </aside>
    </div>
  </main>;
}
