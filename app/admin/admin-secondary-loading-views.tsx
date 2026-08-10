"use client";

import type { GuideManagementData } from "@/db/guides";
import GuideManagementClient from "./content/[eventId]/guides/guide-management-client";

export function ContentIndexLoadingView() {
  return <main className="content-workspace" aria-busy="true" style={{ pointerEvents: "none" }}>
    <div className="content-layout">
      <aside className="content-sidebar">
        <small>当前赛事</small><h1>赛事内容正在读取</h1><p>正在进入内容发布</p>
        <dl className="content-side-status"><div><dt>赛事概览</dt><dd>读取中</dd></div><div><dt>竞赛规程</dt><dd>读取中</dd></div></dl>
        <div className="content-side-note"><strong>内容发布</strong><p>页面结构已经就绪，赛事资料读取完成后会直接填入赛事概览和竞赛规程。</p></div>
      </aside>
      <section className="content-main">
        <section className="content-head-card content-publishing-head"><div><small>CONTENT PUBLISHING</small><h2>内容发布</h2><p>赛事概览与竞赛规程正在读取。</p><div className="content-top-tabs"><button className="active" type="button">赛事概览</button><button type="button">竞赛规程</button></div></div><span className="draft">读取中</span></section>
        {[0,1,2].map((item) => <section className="content-card content-loading-card" key={item}><div className="content-loading-lines"><i /><i /><i /></div></section>)}
      </section>
    </div>
  </main>;
}

export function SchedulePublishLoadingView() {
  return <main className="content-workspace schedule-publish-workspace" aria-busy="true" style={{ pointerEvents: "none" }}>
    <div className="content-layout schedule-publish-layout">
      <aside className="content-sidebar schedule-publish-sidebar"><small>当前赛事</small><h1>赛事主赛程正在读取</h1><p>正在同步阶段资料</p><dl className="content-side-status"><div><dt>赛事主赛程</dt><dd>读取中</dd></div><div><dt>详细赛程表</dt><dd>读取中</dd></div><div><dt>阶段资料</dt><dd>—/4</dd></div></dl><div className="content-side-note"><strong>两层赛程</strong><p>主赛程与竞赛执行的具体赛程表会分别读取，页面结构会保持稳定。</p></div></aside>
      <section className="content-main schedule-publish-main"><section className="content-head-card schedule-publish-head"><div><small>MASTER SCHEDULE</small><h2>赛程发布</h2><p>阶段名称、比赛时间、晋级人数和赛制标签正在读取。</p></div><span className="draft">读取中</span></section><section className="schedule-publish-intro"><div><strong>公众端展示结构</strong><span>四个阶段正在加载。</span></div><b>读取中</b></section>{[0,1,2,3].map((item) => <section className="content-card schedule-stage-editor content-loading-card" key={item}><div className="content-loading-lines"><i /><i /><i /></div></section>)}</section>
    </div>
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
