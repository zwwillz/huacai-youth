"use client";

import Link from "next/link";
import type { GuideManagementData } from "@/db/guides";
import GuideManagementClient from "./content/[eventId]/guides/guide-management-client";

export function ContentIndexLoadingView() {
  return <main className="event-settings-index" aria-busy="true" style={{ pointerEvents: "none" }}>
    <header className="event-settings-index-head"><div><small>静态内容发布</small><h1>选择赛事</h1><p>赛事创建后，才会进入本站的内容发布。这里维护赛事简介、竞赛规程、赛事文件和参赛友好提示；赛程签表、对阵、比分和排名交给“竞赛执行”。</p></div><span>— 场赛事</span></header>
    <section className="event-settings-index-grid">{Array.from({ length: 4 }, (_, index) => <article key={index}><header><span>第 — 站</span><b>状态读取中</b></header><h2>赛事名称正在读取</h2><p>城市 · 场馆正在读取</p><dl><div><dt>比赛时间</dt><dd>—</dd></div><div><dt>赛事状态</dt><dd>正在读取</dd></div><div><dt>前端状态</dt><dd>正在读取</dd></div></dl><div className="event-settings-card-actions"><Link href="/admin/content" tabIndex={-1}>进入内容发布 →</Link><Link href="/admin/content" tabIndex={-1}>参赛提示 →</Link><Link href="/admin/events" tabIndex={-1}>赛事设置 →</Link></div></article>)}</section>
  </main>;
}

export function GuidesLoadingView({ eventId = "" }: { eventId?: string }) {
  const data: GuideManagementData = {
    event: { id: eventId, shortTitle: "当前赛事", city: "城市读取中" },
    guides: [
      { id: "loading-transport", guideType: "transport", title: "交通住宿攻略", publishStatus: "draft", sortOrder: 0, blocks: [{ id: "loading-p1", type: "paragraph", text: "正文内容正在读取…" }] },
      { id: "loading-clothing", guideType: "clothing", title: "服装要求", publishStatus: "draft", sortOrder: 1, blocks: [{ id: "loading-p2", type: "paragraph", text: "正文内容正在读取…" }] },
    ],
  };
  return <div aria-busy="true" style={{ pointerEvents: "none" }}><GuideManagementClient initialData={data} /></div>;
}

export function RegistrationsLoadingView() {
  return <main className="admin-simple-page" aria-busy="true"><section className="admin-simple-head"><small>CURRENT EVENT</small><h2>报名审核</h2><p>当前赛事正在读取。报名审核后续会在这里处理报名资料、组别、审核状态和缴费/确认状态。当前先统一到新的后台结构。</p></section><section className="admin-simple-card"><div className="admin-simple-empty">报名数据正在补齐。</div></section></main>;
}

export function GlobalRankingsLoadingView() {
  return <main className="admin-simple-page" aria-busy="true"><section className="admin-simple-head"><small>GLOBAL RANKING</small><h2>排名积分</h2><p>排名积分是全局工作区，不被顶部“当前赛事”绑定。这里会包含系列总积分榜、分站排名和积分流水。</p></section><section className="admin-simple-card"><h3>已建立赛事</h3><div className="admin-simple-table">{Array.from({ length: 4 }, (_, index) => <div className="admin-simple-row" key={index}><div><b>第 — 站</b><br/><small>赛事名称正在读取</small></div><span>—</span><span>状态读取中</span></div>)}</div></section></main>;
}
