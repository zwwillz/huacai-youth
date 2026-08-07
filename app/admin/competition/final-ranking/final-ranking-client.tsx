"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { FinalRankingWorkspaceData } from "@/db/final-ranking-engine";

export default function FinalRankingClient({ initialData }: { initialData: FinalRankingWorkspaceData }) {
  const router = useRouter();
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const readOnly = initialData.viewerRole === "referee";

  async function post(action: "confirm" | "publish", batchId: string, label: string) {
    if (!window.confirm(action === "confirm" ? `确认${label}最终排名？确认后仍需单独点击发布，公众端才会切换为正式排名。` : `发布${label}最终排名到用户端？发布后公众排名页会自动切换为本站正式排名。`)) return;
    setBusy(`${action}-${batchId}`); setMessage("");
    try {
      const response = await fetch("/api/admin/competition/final-ranking", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action, batchId }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "操作失败。");
      setMessage(action === "confirm" ? `${label}最终排名已确认，尚未公开。` : `${label}最终排名已经发布，用户端会自动显示正式排名。`);
      router.refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : "操作失败。"); }
    finally { setBusy(""); }
  }

  return <main className="final-ranking-page">
    <section className="final-ranking-hero"><div><small>最终排名工作区</small><h2>{initialData.event.shortTitle}</h2><p>正赛全部赛果确认后，系统自动形成完整64人正赛排名：冠军、亚军、季军、殿军、8强、16强、32强和64强。先确认，再发布；未发布前用户端继续显示本站奖金列表和“待组委会发布”提示。</p></div><b>确认 ≠ 发布</b></section>
    {message && <p className="final-ranking-message">{message}</p>}
    <section className="final-ranking-groups">{initialData.groups.map((group) => {
      const status = group.batch?.status || "waiting";
      return <article className={`final-ranking-group ${status}`} key={group.groupId}>
        <header><div><span>{group.groupName}</span><h3>{group.rows.length ? "64人正赛最终排名预览" : "等待正赛全部完成"}</h3><p>{group.sourceReady ? "正赛第一阶段淘汰席位和正赛第二阶段32场比赛（含三、四名决赛）均已确认。" : `正赛第二阶段已确认 ${group.completedMatchCount}/${group.requiredMatchCount} 场；正赛第一阶段64强淘汰席位已确认 ${group.mainOneEliminationCount}/32。`}</p></div><b>{status === "published" ? "已发布" : status === "confirmed" ? "已确认待发布" : status === "draft" ? "草稿待确认" : "等待赛果"}</b></header>
        {group.rows.length > 0 ? <div className="final-ranking-table"><div className="head"><span>序号</span><span>名次</span><span>球员</span><span>奖金</span></div>{group.rows.map((row) => <div key={`${group.groupId}-${row.displayOrder}`}><span className={row.displayOrder <= 4 ? `medal m${row.displayOrder}` : "medal"}>{row.displayOrder}</span><b>{row.placementLabel}</b><strong>{row.playerName}</strong><em>{row.prizeDisplay || "—"}</em></div>)}</div> : <section className="final-ranking-empty"><strong>最终排名还没有产生</strong><p>当前公众端不会显示临时排名，只显示本站奖金列表。正赛赛果全部确认后，后台会自动生成64人正式排名草稿。</p></section>}
        <footer><div><strong>{group.batch ? `排名状态：${group.batch.status === "published" ? "已发布" : group.batch.status === "confirmed" ? "已确认" : "草稿"}` : "等待排名草稿"}</strong><p>只有“已发布”的排名才会被用户端读取；确认阶段仍仅后台可见。</p></div>{group.batch && !readOnly && <div className="final-ranking-actions">{group.batch.status === "draft" && <button disabled={Boolean(busy)} onClick={() => post("confirm", group.batch!.id, group.groupName)}>{busy === `confirm-${group.batch.id}` ? "确认中..." : "确认最终排名"}</button>}{group.batch.status === "confirmed" && <button className="publish" disabled={Boolean(busy)} onClick={() => post("publish", group.batch!.id, group.groupName)}>{busy === `publish-${group.batch.id}` ? "发布中..." : "发布到用户端"}</button>}</div>}</footer>
      </article>;
    })}</section>
    <section className="final-ranking-rules"><article><strong>后台确认</strong><p>锁定系统根据完整正赛赛果生成的64人排名，前端暂时不变。</p></article><article><strong>后台发布</strong><p>排名状态切换为已发布，用户端自动从奖金列表切换为本站正式排名。</p></article><article><strong>赛事结束</strong><p>少年组、青年组均发布64人正式排名后，赛事状态自动切换为已结束。</p></article></section>
  </main>;
}
