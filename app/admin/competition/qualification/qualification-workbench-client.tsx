"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import type { QualificationStage, QualificationWorkspaceData } from "@/db/qualification-engine";

type Props = { initialData: QualificationWorkspaceData };

function percent(bp: number) {
  return `${(bp / 100).toFixed(2)}%`;
}

function statusText(stage: QualificationStage) {
  if (stage.confirmed) return "晋级已确认";
  if (stage.readyToConfirm) return "可以确认晋级";
  return `等待分区决胜 ${stage.completedFinalCount}/${stage.divisionCount}`;
}

export default function QualificationWorkbenchClient({ initialData }: Props) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [selected, setSelected] = useState<Record<string, string[]>>(() => Object.fromEntries(
    initialData.stages.map((stage) => [stage.drawSessionId, stage.candidates.filter((candidate) => candidate.selected).map((candidate) => candidate.playerId)]),
  ));

  const stageMap = useMemo(() => new Map(initialData.stages.map((stage) => [stage.drawSessionId, stage])), [initialData.stages]);

  function toggleCandidate(stageId: string, playerId: string) {
    const stage = stageMap.get(stageId);
    if (!stage || stage.confirmed) return;
    setSelected((current) => {
      const values = new Set(current[stageId] ?? []);
      if (values.has(playerId)) values.delete(playerId);
      else values.add(playerId);
      return { ...current, [stageId]: [...values] };
    });
  }

  async function confirmStage(stage: QualificationStage) {
    const ids = selected[stage.drawSessionId] ?? [];
    if (ids.length !== stage.rateQualifierCount) {
      setMessage(`请确认 ${stage.rateQualifierCount} 名局胜率增补球员，当前选择 ${ids.length} 名。`);
      return;
    }
    if (!window.confirm(`确认${stage.groupName} · ${stage.phaseTitle}晋级名单？\n\n${stage.direct.length}名分区冠军直接晋级 + ${ids.length}名局胜率增补。确认后将锁定本阶段结果。`)) return;
    setBusyId(stage.drawSessionId);
    setMessage("");
    try {
      const response = await fetch("/api/admin/competition/qualification", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "confirm", drawSessionId: stage.drawSessionId, selectedRatePlayerIds: ids }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "晋级确认失败。");
      setMessage(stage.phaseCode === "qualifier-one"
        ? "晋级名单已确认，未晋级球员已经自动进入资格赛第二场参赛名单。"
        : "资格赛第二场晋级名单已确认。请继续在下方完成种子确认、缺额递补并锁定64人正赛名单。"
      );
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "晋级确认失败。");
    } finally {
      setBusyId(null);
    }
  }

  return <main className="qualification-page">
    <section className="qualification-hero">
      <div><small>资格赛晋级控制</small><h2>{initialData.event.shortTitle}</h2><p>分区决胜全部确认后，系统自动识别分区冠军和决胜负者，计算候补局胜率。组委会确认最终增补名单后，再生成下一阶段参赛名单。</p></div>
      <strong>16直晋 + 8增补</strong>
    </section>

    {message && <p className="qualification-message">{message}</p>}

    <section className="qualification-stage-list">
      {initialData.stages.map((stage) => {
        const selectedIds = selected[stage.drawSessionId] ?? [];
        const selectedNames = stage.candidates.filter((candidate) => selectedIds.includes(candidate.playerId)).map((candidate) => candidate.playerName);
        return <article className="qualification-stage" key={stage.drawSessionId}>
          <header>
            <div><span>{stage.groupName}</span><h3>{stage.phaseTitle}</h3><p>抽签 V{stage.drawVersion} · {stage.divisionCount} 个分区 · 每区 {stage.divisionSize} 人</p></div>
            <b className={stage.confirmed ? "confirmed" : stage.readyToConfirm ? "ready" : "waiting"}>{statusText(stage)}</b>
          </header>

          <div className="qualification-progress">
            <div><small>分区决胜</small><strong>{stage.completedFinalCount}<i>/ {stage.divisionCount}</i></strong></div>
            <div><small>直接晋级</small><strong>{stage.direct.length}<i>人</i></strong></div>
            <div><small>候补池</small><strong>{stage.candidates.length}<i>人</i></strong></div>
            <div><small>局胜率增补</small><strong>{stage.rateQualifierCount}<i>人</i></strong></div>
          </div>

          {stage.direct.length > 0 && <section className="qualification-direct">
            <div className="qualification-section-title"><div><small>分区冠军</small><h4>分区冠军 · 直接晋级</h4></div><span>{stage.direct.length} 人</span></div>
            <div className="qualification-name-grid">{stage.direct.map((player) => <div key={player.playerId}><span>第{player.divisionNo}区</span><strong>{player.playerName}</strong></div>)}</div>
          </section>}

          {stage.candidates.length > 0 && <section className="qualification-candidates">
            <div className="qualification-section-title"><div><small>局胜率候补</small><h4>分区决胜负者 · 局胜率候补</h4></div><span>默认前 {stage.rateQualifierCount} 名</span></div>
            <p className="qualification-formula">局胜率 = 本阶段已确认正常比赛的总胜局 ÷（总胜局 + 总负局）。同率时系统暂按净胜局、总胜局、分区顺序排序；组委会可以在确认前人工调整最终增补人选。</p>
            <div className="qualification-candidate-table">
              <div className="head"><span>选择</span><span>排名</span><span>球员</span><span>分区</span><span>胜局</span><span>负局</span><span>净胜局</span><span>局胜率</span></div>
              {stage.candidates.map((candidate) => {
                const checked = selectedIds.includes(candidate.playerId);
                return <label key={candidate.playerId} className={!candidate.eligible ? "ineligible" : checked ? "selected" : ""}>
                  <span><input type="checkbox" checked={checked} disabled={stage.confirmed || !candidate.eligible} onChange={() => toggleCandidate(stage.drawSessionId, candidate.playerId)} /></span>
                  <span>{candidate.eligible ? candidate.rankNo : "—"}</span>
                  <strong>{candidate.playerName}</strong>
                  <span>第{candidate.divisionNo}区</span>
                  <span>{candidate.gamesWon}</span><span>{candidate.gamesLost}</span><span>{candidate.netGames > 0 ? `+${candidate.netGames}` : candidate.netGames}</span>
                  <b>{percent(candidate.gameWinRateBp)}</b>
                </label>;
              })}
            </div>
          </section>}

          <footer>
            {stage.confirmed ? <>
              <div><strong>晋级名单已锁定</strong><p>{stage.direct.length + selectedIds.length} 人晋级。{stage.nextPhaseCode === "qualifier-two" ? `已自动生成 ${stage.nextPhaseEntryCount} 名资格赛第二场参赛球员。` : "请继续在下方完成种子确认、递补与正赛名单锁定。"}</p></div>
              {stage.nextPhaseCode === "qualifier-two" && <Link href={`/admin/competition/draw?event=${encodeURIComponent(stage.eventId)}&group=${encodeURIComponent(stage.groupId)}&phase=qualifier-two`}>进入资格赛第二场抽签 →</Link>}
            </> : <>
              <div><strong>{stage.readyToConfirm ? `当前选择：${selectedIds.length}/${stage.rateQualifierCount}` : "等待全部分区决胜赛果确认"}</strong><p>{selectedNames.length ? `增补人选：${selectedNames.join("、")}` : "系统会在分区决胜完成后自动生成候补排名。"}</p></div>
              <button type="button" disabled={!stage.readyToConfirm || selectedIds.length !== stage.rateQualifierCount || busyId === stage.drawSessionId || initialData.viewerRole === "referee"} onClick={() => confirmStage(stage)}>{busyId === stage.drawSessionId ? "正在确认..." : "确认本阶段晋级名单"}</button>
            </>}
          </footer>
        </article>;
      })}
    </section>

    {!initialData.stages.length && <section className="qualification-empty"><strong>还没有可计算晋级的资格赛签表</strong><p>请先完成资格赛抽签、生成完整签表，并通过比分录入确认到分区决胜。</p></section>}

    <section className="qualification-rule">
      <article><strong>资格赛第一场确认后</strong><p>系统自动从本场全部抽签球员中扣除已晋级球员，把其余球员生成“资格赛第二场参赛名单”，然后开放第二场独立抽签。</p></article>
      <article><strong>两场资格赛确认后</strong><p>下方继续处理上一站16强种子、年龄与参赛状态、局胜率递补。只有64人名单锁定后，才允许正赛第一阶段抽签。</p></article>
    </section>
  </main>;
}
