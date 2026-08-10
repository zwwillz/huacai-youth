"use client";

import Link from "next/link";
import EventListClient, { type EventRow } from "./event-list-client";

type Props = { events: EventRow[] | null; canDelete: boolean };

export default function EventSettingsIndexView({ events, canDelete }: Props) {
  const loading = events === null;
  const rows = events ?? [];
  const totalCount = loading ? 0 : rows.length;
  const currentCount = loading ? 0 : rows.filter((event) => event.status !== "archived").length;
  const finishedCount = loading ? 0 : rows.filter((event) => event.status === "finished" || event.status === "archived").length;
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
        <h3>赛事状态概览</h3>
        <p>总赛事包含全部历史记录；当前赛事不包含已归档赛事。</p>
        <dl>
          <div><dt>赛事总数</dt><dd>{loading ? "—" : totalCount}</dd></div>
          <div><dt>当前赛事</dt><dd>{loading ? "—" : currentCount}</dd></div>
          <div><dt>已结束</dt><dd>{loading ? "—" : finishedCount}</dd></div>
          <div><dt>已归档</dt><dd>{loading ? "—" : archivedCount}</dd></div>
          <div><dt>前端隐藏</dt><dd>{loading ? "—" : hiddenCount}</dd></div>
        </dl>
        <div className="event-v2-summary-note"><strong>生命周期说明</strong><p>“当前赛事”指所有未归档赛事；已归档赛事仍计入赛事总数和已结束赛事，但不再计入当前赛事。隐藏只影响公众前端。</p></div>
      </aside>
    </div>
  </main>;
}
