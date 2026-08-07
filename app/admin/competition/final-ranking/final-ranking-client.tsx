"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { FinalRankingRow, FinalRankingWorkspaceData } from "@/db/final-ranking-engine";

function tierLabel(order: number) {
  if (order === 1) return "冠军";
  if (order === 2) return "亚军";
  if (order === 3) return "季军";
  if (order === 4) return "殿军";
  if (order <= 8) return "8强";
  if (order <= 16) return "16强";
  if (order <= 32) return "32强";
  return "64强";
}

export default function FinalRankingClient({ initialData }: { initialData: FinalRankingWorkspaceData }) {
  const router = useRouter();
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [editing, setEditing] = useState(false);
  const group = initialData.groups[0];
  const [manualRows, setManualRows] = useState<FinalRankingRow[]>(() => group?.rows ?? []);
  const readOnly = initialData.viewerRole === "referee";

  async function post(action: "confirm" | "publish", batchId: string, label: string) {
    if (!window.confirm(action === "confirm" ? `确认${label}最终排名？\n\n确认后排名被锁定，不能继续用“人工调整”修改；仍需单独点击发布，用户端才会显示。` : `发布${label}最终排名到用户端？\n\n发布后用户端排名页会自动切换为本站正式排名。`)) return;
    setBusy(`${action}-${batchId}`); setMessage("");
    try {
      const response = await fetch("/api/admin/competition/final-ranking", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action, batchId }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "操作失败。");
      setMessage(action === "confirm" ? `${label}最终排名已确认并锁定，尚未公开。` : `${label}最终排名已经发布，用户端会自动显示正式排名。`);
      setEditing(false); router.refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : "操作失败。"); }
    finally { setBusy(""); }
  }

  function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= manualRows.length) return;
    setManualRows((current) => {
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next.map((row, rowIndex) => ({ ...row, displayOrder: rowIndex + 1, placementLabel: tierLabel(rowIndex + 1), isExactPlace: rowIndex < 4 }));
    });
  }

  async function saveManual() {
    if (!group?.batch) return;
    const reason = window.prompt("请填写人工调整原因。该说明会写入操作日志：", "组委会根据现场最终裁定调整名次");
    if (!reason) return;
    if (!window.confirm("确认保存人工调整后的64人排名草稿？\n\n这一步只保存后台草稿，不会发布到用户端。保存后仍需“确认最终排名”再“发布到用户端”。")) return;
    setBusy(`manual-${group.batch.id}`); setMessage("");
    try {
      const response = await fetch("/api/admin/competition/final-ranking", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "save-manual", batchId: group.batch.id, orderedPlayerIds: manualRows.map((row) => row.playerId), reason }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "人工调整保存失败。");
      setEditing(false); setMessage("人工调整已保存为后台排名草稿，尚未确认、尚未发布。" ); router.refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : "人工调整保存失败。"); }
    finally { setBusy(""); }
  }

  if (!group) return <main className="final-ranking-page"><section className="final-ranking-empty"><strong>当前组别还没有排名数据</strong><p>完成正赛后会自动生成最终排名草稿。</p></section></main>;
  const status = group.batch?.status || "waiting";
  const rows = editing ? manualRows : group.rows;
  const canEdit = !readOnly && group.batch?.status === "draft" && group.rows.length === 64;

  return <main className="final-ranking-page">
    {message && <p className="final-ranking-message">{message}</p>}
    <section className="final-ranking-groups"><article className={`final-ranking-group ${status}`}>
      <header><div><span>{group.groupName}</span><h3>{group.rows.length ? "64人正赛最终排名预览" : "等待正赛全部完成"}</h3><p>{group.sourceReady ? "系统已根据全部正式赛果自动生成排名。可以直接确认，也可以先触发人工调整。" : `正赛第二阶段已确认 ${group.completedMatchCount}/${group.requiredMatchCount} 场；正赛第一阶段64强淘汰席位已确认 ${group.mainOneEliminationCount}/32。`}</p></div><b>{status === "published" ? "已发布" : status === "confirmed" ? "已确认待发布" : status === "draft" ? (editing ? "人工调整中" : "草稿待确认") : "等待赛果"}</b></header>

      {rows.length > 0 ? <>
        {editing && <div className="final-ranking-edit-notice"><strong>人工调整模式</strong><p>使用上下按钮改变球员顺序。跨越第1、2、3、4、8、16、32名边界时，名次档位和奖金会在保存后自动重新计算。此操作不会修改原始比赛比分，只修改最终排名裁定，并完整记录日志。</p></div>}
        <div className={`final-ranking-table ${editing ? "editing" : ""}`}><div className="head"><span>序号</span><span>名次</span><span>球员</span><span>奖金</span>{editing && <span>调整</span>}</div>{rows.map((row, index) => <div key={`${group.groupId}-${row.playerId}`}><span className={row.displayOrder <= 4 ? `medal m${row.displayOrder}` : "medal"}>{row.displayOrder}</span><b>{editing ? tierLabel(index + 1) : row.placementLabel}</b><strong>{row.playerName}</strong><em>{editing ? (tierLabel(index + 1) === row.placementLabel ? row.prizeDisplay || "—" : "保存后重算") : row.prizeDisplay || "—"}</em>{editing && <span className="ranking-move"><button type="button" disabled={index === 0 || Boolean(busy)} onClick={() => move(index, -1)}>↑</button><button type="button" disabled={index === rows.length - 1 || Boolean(busy)} onClick={() => move(index, 1)}>↓</button></span>}</div>)}</div>
      </> : <section className="final-ranking-empty"><strong>最终排名还没有产生</strong><p>当前用户端不会显示临时排名，只显示本站奖金列表。正赛赛果全部确认后，后台会自动生成64人最终排名草稿。</p></section>}

      <footer><div><strong>{group.batch ? `排名状态：${group.batch.status === "published" ? "已发布" : group.batch.status === "confirmed" ? "已确认" : "草稿"}` : "等待排名草稿"}</strong><p>系统自动排名可人工修正；保存只是后台草稿，确认是锁定，发布才进入用户端。</p></div>{group.batch && !readOnly && <div className="final-ranking-actions">
        {group.batch.status === "draft" && !editing && <button className="secondary" disabled={Boolean(busy)} onClick={() => { setManualRows(group.rows); setEditing(true); }}>人工调整</button>}
        {group.batch.status === "draft" && editing && <><button className="secondary" disabled={Boolean(busy)} onClick={() => { setManualRows(group.rows); setEditing(false); }}>取消调整</button><button disabled={Boolean(busy)} onClick={saveManual}>{busy === `manual-${group.batch.id}` ? "保存中..." : "保存人工调整"}</button></>}
        {group.batch.status === "draft" && !editing && <button disabled={Boolean(busy)} onClick={() => post("confirm", group.batch!.id, group.groupName)}>{busy === `confirm-${group.batch.id}` ? "确认中..." : "确认最终排名"}</button>}
        {group.batch.status === "confirmed" && <button className="publish" disabled={Boolean(busy)} onClick={() => post("publish", group.batch!.id, group.groupName)}>{busy === `publish-${group.batch.id}` ? "发布中..." : "发布到用户端"}</button>}
      </div>}</footer>
    </article></section>
    <section className="final-ranking-rules"><article><strong>自动生成</strong><p>系统根据正式赛果形成完整64人排名草稿。</p></article><article><strong>人工调整</strong><p>仅草稿阶段可触发，必须填写调整原因，并写入操作日志。</p></article><article><strong>确认并发布</strong><p>确认后锁定；只有点击发布，用户端才显示本站正式排名。</p></article></section>
  </main>;
}
