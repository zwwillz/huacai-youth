"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { MainRosterControlData, MainRosterControlGroup, SeedAttendanceStatus } from "@/db/main-competition-flow";

type Props = { initialData: MainRosterControlData };

const attendanceLabels: Record<string, string> = {
  pending: "待确认",
  confirmed: "确认参赛",
  not_attending: "不参赛",
  ineligible: "资格不符",
  removed: "取消资格",
};
const eligibilityLabels: Record<string, string> = {
  eligible: "年龄符合",
  ineligible: "年龄不符",
  unknown: "年龄待核验",
  unchecked: "年龄待核验",
};

function pct(bp: number | null) { return bp == null ? "—" : `${(bp / 100).toFixed(2)}%`; }

export default function MainRosterControlClient({ initialData }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const readOnly = initialData.viewerRole === "referee";

  async function post(key: string, body: Record<string, unknown>) {
    setBusy(key); setMessage("");
    try {
      const response = await fetch("/api/admin/competition/main-roster", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "操作失败。");
      router.refresh();
      return true;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "操作失败。");
      return false;
    } finally { setBusy(""); }
  }

  async function changeStatus(group: MainRosterControlGroup, seedEntryId: string, status: SeedAttendanceStatus) {
    let note = "";
    if (["not_attending", "ineligible", "removed"].includes(status)) {
      note = window.prompt("请填写原因，便于后续审计和递补：", status === "not_attending" ? "本站不参赛" : status === "ineligible" ? "年龄/资格不符合" : "组委会取消资格") || "";
      if (!note) return;
    }
    const ok = await post(`status-${seedEntryId}`, { action: "seed-status", eventId: initialData.event.id, groupId: group.groupId, seedEntryId, attendanceStatus: status, note });
    if (ok) setMessage("种子状态已更新。若产生空缺，请从局胜率递补池中选择球员补足。\n");
  }

  async function changeReplacement(group: MainRosterControlGroup, seedEntryId: string, playerId: string) {
    const action = playerId ? "assign-replacement" : "clear-replacement";
    const ok = await post(`replacement-${seedEntryId}`, { action, eventId: initialData.event.id, groupId: group.groupId, seedEntryId, playerId });
    if (ok) setMessage(playerId ? "递补球员已填入该种子席位。" : "已清除递补球员。\n");
  }

  async function lockRoster(group: MainRosterControlGroup) {
    if (!window.confirm(`确认锁定${group.groupName}正赛64人名单？\n\n锁定后才允许正赛第一阶段抽签；如果之后要修改名单，需要先作废抽签并解锁。`)) return;
    const ok = await post(`lock-${group.groupId}`, { action: "lock-roster", eventId: initialData.event.id, groupId: group.groupId });
    if (ok) setMessage(`${group.groupName}正赛64人名单已锁定，可以进入正赛第一阶段抽签。`);
  }

  return <section className="main-roster-control">
    <header className="main-roster-control-hero">
      <div><small>正赛名单控制</small><h2>种子确认 · 递补 · 64人名单锁定</h2><p>默认以上一站对应组别16强作为本站种子候选。年龄不符合、本站不参赛或被取消资格的席位，从两场资格赛未晋级候补中按局胜率顺序递补。后台确认后才进入正赛抽签。</p></div>
      <b>{initialData.previousEvent ? `种子来源：第${initialData.previousEvent.stationNo}站` : "首站 / 无上一站"}</b>
    </header>

    {message && <p className="main-roster-message">{message}</p>}

    <div className="main-roster-groups">{initialData.groups.map((group) => {
      const locked = group.currentLock?.status === "locked";
      const editable = !readOnly && !group.activeMainOneDraw;
      const winnerSide = group.advancement?.roster.filter((item) => item.sourceType === "winner_side_qualified") ?? [];
      const loserSide = group.advancement?.roster.filter((item) => item.sourceType === "loser_side_qualified") ?? [];
      return <article className="main-roster-group" key={group.groupId}>
        <header className="main-roster-group-head">
          <div><span>{group.groupCode}</span><h3>{group.groupName}</h3><p>{locked ? `64人名单已锁定 · V${group.currentLock?.versionNo}` : group.activeMainOneDraw ? "正赛第一阶段已进入抽签/比赛流程" : "完成种子确认与递补后锁定64人名单"}</p></div>
          <b className={locked ? "locked" : group.canLock ? "ready" : "waiting"}>{locked ? "已锁定" : group.canLock ? "可以锁定" : "准备中"}</b>
        </header>

        <section className="main-roster-summary">
          <div><small>资格赛第一场</small><strong>{group.qualifierOneCount}<i>/24</i></strong></div>
          <div><small>资格赛第二场</small><strong>{group.qualifierTwoCount}<i>/24</i></strong></div>
          <div><small>种子席位已解决</small><strong>{group.resolvedSeedCount}<i>/16</i></strong></div>
          <div><small>局胜率递补</small><strong>{group.replacementCount}<i>人</i></strong></div>
          <div><small>当前正赛名单</small><strong>{group.mainRosterCount}<i>/64</i></strong></div>
        </section>

        {!group.seedSeats.length && <section className="seed-empty">
          <div><strong>还没有种子候选名单</strong><p>{initialData.previousEvent ? `可读取“${initialData.previousEvent.shortTitle}”对应组别前16名，生成本站种子候选。` : "当前没有上一站可自动读取，请后续通过手工种子维护方式建立名单。"}</p></div>
          {group.canInitializeSeeds && !readOnly && <button disabled={busy === `init-${group.groupId}`} onClick={() => post(`init-${group.groupId}`, { action: "initialize-seeds", eventId: initialData.event.id, groupId: group.groupId })}>{busy === `init-${group.groupId}` ? "生成中..." : "读取上一站16强"}</button>}
        </section>}

        {group.seedSeats.length > 0 && <section className="seed-control">
          <div className="seed-control-title"><div><small>16个种子席位</small><h4>种子候选与递补</h4></div>{editable && <button onClick={() => post(`confirm-all-${group.groupId}`, { action: "confirm-all-seeds", eventId: initialData.event.id, groupId: group.groupId })} disabled={Boolean(busy)}>批量确认可参赛种子</button>}</div>
          <div className="seed-table">
            <div className="seed-row head"><span>种子位</span><span>来源</span><span>球员</span><span>年龄核验</span><span>参赛状态</span><span>空缺递补</span></div>
            {group.seedSeats.map((seat) => <div className={`seed-row ${seat.effectivePlayerId ? "resolved" : "missing"}`} key={seat.id}>
              <b>#{seat.seedNo}</b>
              <span>{seat.sourceDisplayOrder ? `上一站第${seat.sourceDisplayOrder}名` : seat.sourceType === "manual" ? "手工/测试种子" : "种子候选"}</span>
              <div><strong>{seat.playerName}</strong>{seat.birthDate && <small>{seat.birthDate}</small>}</div>
              <span className={`eligibility ${seat.eligibilityStatus}`}>{eligibilityLabels[seat.eligibilityStatus] || seat.eligibilityStatus}<small>{seat.eligibilityNote || ""}</small></span>
              <select value={seat.attendanceStatus} disabled={!editable || Boolean(busy)} onChange={(event) => changeStatus(group, seat.id, event.target.value as SeedAttendanceStatus)}>
                <option value="pending">待确认</option><option value="confirmed">确认参赛</option><option value="not_attending">不参赛</option><option value="ineligible">资格不符</option><option value="removed">取消资格</option>
              </select>
              <div className="replacement-cell">
                {seat.attendanceStatus === "confirmed" ? <span className="original-seat">原种子参赛</span> : <select value={seat.replacementPlayerId || ""} disabled={!editable || Boolean(busy)} onChange={(event) => changeReplacement(group, seat.id, event.target.value)}>
                  <option value="">选择局胜率递补</option>
                  {seat.replacementPlayerId && <option value={seat.replacementPlayerId}>{seat.replacementPlayerName} · {pct(seat.replacementMetricValue)}</option>}
                  {group.replacementPool.map((candidate) => <option key={candidate.playerId} value={candidate.playerId}>{candidate.playerName} · {candidate.phaseTitle} · {pct(candidate.gameWinRateBp)}</option>)}
                </select>}
                {seat.replacementPlayerName && <small>递补：{seat.replacementPlayerName} · {pct(seat.replacementMetricValue)} · 继承#{seat.seedNo}种子位</small>}
              </div>
            </div>)}
          </div>
          <p className="seed-rule-note">默认规则：缺席/年龄不符的种子席位由资格赛候补池按局胜率 → 净胜局 → 总胜局排序递补；递补球员继承该种子席位。所有人工调整都写入操作日志。</p>
        </section>}

        <section className="roster-lock-panel">
          <div><small>正赛第一阶段入口</small><h4>{locked ? `64人名单已锁定 · V${group.currentLock?.versionNo}` : "锁定64人正赛名单"}</h4><p>{group.activeMainOneDraw ? `已有正赛抽签 V${group.activeMainOneDraw.versionNo}（${group.activeMainOneDraw.status === "confirmed" ? "已确认" : "草稿"}），名单不可直接调整。` : group.canLock ? "48名资格赛晋级 + 16个已解决种子席位完整且无重复，可以锁定。" : `当前：资格赛${group.qualifierCount}/48，种子席位${group.resolvedSeedCount}/16，重复${group.duplicateCount}。`}</p></div>
          <div className="roster-lock-actions">
            {locked && <Link href={`/admin/competition/draw?event=${encodeURIComponent(initialData.event.id)}&group=${encodeURIComponent(group.groupId)}&phase=main-one`}>进入正赛第一阶段 →</Link>}
            {!locked && group.canLock && !readOnly && <button onClick={() => lockRoster(group)} disabled={Boolean(busy)}>锁定64人名单</button>}
            {locked && !group.activeMainOneDraw && !readOnly && <button className="danger" onClick={async () => { const reason = window.prompt("请输入解锁原因：", "名单调整"); if (reason) await post(`unlock-${group.groupId}`, { action: "unlock-roster", lockId: group.currentLock?.id, reason }); }}>解锁名单</button>}
          </div>
        </section>

        <section className={`main32-panel ${group.advancement ? "has-data" : "waiting"}`}>
          <header><div><small>正赛第一阶段 → 32强</small><h4>32强名单确认</h4><p>每组胜部2人、败部2人，共32人。只有组委会确认后，系统才正式生成正赛第二阶段名单并开放重新抽签。</p></div><b>{group.advancement ? `${group.advancement.winnerSideCount + group.advancement.loserSideCount}/32` : "0/32"}</b></header>
          {!group.advancement && <div className="main32-wait"><strong>等待正赛第一阶段完成</strong><p>随着后台确认比分，胜者/负者会自动沿双败线路推进。全部16场胜部晋级轮和16场败部晋级轮确认后，这里自动出现32强待确认名单。</p></div>}
          {group.advancement && <>
            <div className="main32-lists"><div><strong>胜部晋级 · 16人</strong><p>{winnerSide.map((item) => item.playerName).join("、")}</p></div><div><strong>败部晋级 · 16人</strong><p>{loserSide.map((item) => item.playerName).join("、")}</p></div></div>
            <footer><span>{group.advancement.status === "confirmed" ? "32强名单已确认，可进入正赛第二阶段抽签。" : "32强结果已由赛果自动汇总，等待组委会最终确认。"}</span>{group.advancement.status === "confirmed" ? <Link href={`/admin/competition/draw?event=${encodeURIComponent(initialData.event.id)}&group=${encodeURIComponent(group.groupId)}&phase=main-two`}>进入正赛第二阶段抽签 →</Link> : !readOnly && <button disabled={Boolean(busy)} onClick={async () => { if (window.confirm(`确认${group.groupName}32强名单并开放正赛第二阶段抽签？`)) await post(`main32-${group.groupId}`, { action: "confirm-main32", batchId: group.advancement?.id }); }}>确认32强名单</button>}</footer>
          </>}
        </section>
      </article>;
    })}</div>
  </section>;
}
