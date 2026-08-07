"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import type { DrawSessionDetail, DrawWorkspaceData } from "@/db/draw-engine";

type Props = { initialData: DrawWorkspaceData };

function statusLabel(status: string) {
  if (status === "draft") return "抽签草稿";
  if (status === "confirmed") return "已确认";
  if (status === "void") return "已作废";
  return status;
}

function phaseHref(eventId: string, groupId: string, phase: string) {
  return `/admin/competition/draw?event=${encodeURIComponent(eventId)}&group=${encodeURIComponent(groupId)}&phase=${encodeURIComponent(phase)}`;
}

export default function DrawWorkbenchClient({ initialData }: Props) {
  const router = useRouter();
  const [bracketSize, setBracketSize] = useState(initialData.settings.bracketSize);
  const [divisionSize, setDivisionSize] = useState(initialData.settings.divisionSize);
  const [rateQualifierCount, setRateQualifierCount] = useState(initialData.settings.rateQualifierCount);
  const [session, setSession] = useState<DrawSessionDetail | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [division, setDivision] = useState(1);

  const entrantCount = initialData.plan.entrantCount;
  const divisionCount = bracketSize > 0 && divisionSize > 0 && bracketSize % divisionSize === 0 ? bracketSize / divisionSize : 0;
  const directQualifierCount = divisionCount;
  const playoffMatchCount = Math.max(0, entrantCount - bracketSize);
  const playoffPlayerCount = playoffMatchCount * 2;
  const byeCount = Math.max(0, bracketSize - entrantCount);
  const directEntryCount = entrantCount > bracketSize ? entrantCount - playoffPlayerCount : entrantCount;
  const totalQualifierCount = directQualifierCount + Math.max(0, rateQualifierCount);
  const canConfigure = initialData.selectedPhase === "qualifier-one" || initialData.selectedPhase === "qualifier-two";
  const canCreate = canConfigure && initialData.plan.sourceReady && entrantCount >= 2 && divisionCount > 0 && !initialData.latestSession?.id;

  const visibleSlots = useMemo(() => session?.slots.filter((slot) => slot.divisionNo === division) ?? [], [session, division]);
  const prelimById = useMemo(() => new Map((session?.prelimMatches ?? []).map((match) => [match.id, match])), [session]);

  async function post(body: Record<string, unknown>) {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/competition/draw", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "操作失败。");
      return result.data;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "操作失败。");
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function generateBracket(sessionId: string) {
    try {
      const response = await fetch("/api/admin/competition/bracket", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "generate", sessionId }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "完整签表生成失败。");
      return true;
    } catch (error) {
      setMessage(`抽签已经确认，但完整签表自动生成失败：${error instanceof Error ? error.message : "请进入完整签表页面重试。"}`);
      return false;
    }
  }

  async function createDraw() {
    if (!window.confirm(`确认使用当前阶段的 ${entrantCount} 名球员生成抽签草稿？\n\n本阶段只抽签一次，签表将从当前人数一路运行到每区冠军；最后由${directQualifierCount}名分区冠军直接晋级，并从分区决胜轮负者中按局胜率增补 ${rateQualifierCount} 人。`)) return;
    const data = await post({
      action: "create",
      eventId: initialData.event.id,
      groupId: initialData.selectedGroupId,
      phaseCode: initialData.selectedPhase,
      bracketSize,
      divisionSize,
      rateQualifierCount,
      seedsEnabled: false,
      seedTargetCount: 0,
      seedFillRule: "game_win_rate",
    });
    if (data) {
      setSession(data as DrawSessionDetail);
      setDivision(1);
      setMessage("抽签草稿已经生成并写入数据库。现场大屏只负责揭晓动画，不会再次随机。");
      router.refresh();
    }
  }

  async function loadSession() {
    if (!initialData.latestSession?.id) return;
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(`/api/admin/competition/draw?sessionId=${encodeURIComponent(initialData.latestSession.id)}`);
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "读取抽签失败。");
      setSession(result.data as DrawSessionDetail);
      setDivision(1);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "读取抽签失败。");
    } finally {
      setBusy(false);
    }
  }

  async function confirmDraw() {
    if (!session || !window.confirm("确认把当前抽签版本设为正式签表？确认后需要先作废才能重新抽签。确认后系统会自动生成完整分区比赛关系。")) return;
    const data = await post({ action: "confirm", sessionId: session.session.id });
    if (data) {
      const confirmed = data as DrawSessionDetail;
      setSession(confirmed);
      const generated = await generateBracket(confirmed.session.id);
      if (generated) setMessage("本次抽签已经正式确认，并已自动生成完整分区签表和每一场比赛关系。下一步再给这些比赛安排时间、球台和裁判。");
      router.refresh();
    }
  }

  async function voidDraw() {
    if (!session) return;
    const reason = window.prompt("请输入作废原因。该原因会进入操作日志：", "");
    if (!reason) return;
    const data = await post({ action: "void", sessionId: session.session.id, reason });
    if (data) {
      setMessage("抽签版本已作废，可以重新生成新版本。旧版完整签表会保留为历史版本，不会被作为当前正式数据使用。");
      setSession(null);
      router.refresh();
    }
  }

  return <main className="draw-workbench">
    <section className="draw-workbench-hero">
      <div><small>DRAW ENGINE · FIRST RELEASE</small><h2>{initialData.phaseTitle} · {initialData.groups.find((group) => group.id === initialData.selectedGroupId)?.name}</h2><p>资格赛每场只进行一次抽签。抽签完成后，同一张签表从标准签表一路比赛到每区冠军，不在中间轮次重新抽签。</p></div>
      <Link href={`/admin/competition?event=${encodeURIComponent(initialData.event.id)}&group=${encodeURIComponent(initialData.selectedGroupId)}`}>返回竞赛执行</Link>
    </section>

    <section className="draw-stage-tabs">
      {initialData.groups.map((group) => <Link key={group.id} className={group.id === initialData.selectedGroupId ? "active" : ""} href={phaseHref(initialData.event.id, group.id, initialData.selectedPhase)}><b>{group.name}</b><span>{group.approvedCount} 人已审核</span></Link>)}
    </section>

    <section className="draw-phase-tabs">
      {(["qualifier-one", "qualifier-two", "main-one", "main-two"] as const).map((phase, index) => <Link key={phase} className={phase === initialData.selectedPhase ? "active" : ""} href={phaseHref(initialData.event.id, initialData.selectedGroupId, phase)}><span>0{index + 1}</span><b>{["资格赛第一场", "资格赛第二场", "正赛第一阶段", "正赛第二阶段"][index]}</b></Link>)}
    </section>

    {!initialData.plan.sourceReady && <section className="draw-notice"><strong>当前阶段先不开放正式抽签</strong><p>{initialData.plan.sourceNote}</p></section>}

    <section className="draw-layout">
      <div className="draw-main-column">
        <section className="draw-panel">
          <header><div><small>01 · DRAW SETTINGS</small><h3>抽签参数</h3></div><span>{canConfigure ? "资格赛规则" : "规则预览"}</span></header>
          <div className="draw-form-grid">
            <label><span>标准签表容量</span><select value={bracketSize} disabled={!canConfigure || Boolean(initialData.latestSession)} onChange={(event) => setBracketSize(Number(event.target.value))}><option value={256}>256</option><option value={512}>512</option><option value={1024}>1024</option></select><small>实际人数高于容量时自动生成附加赛；低于容量时自动生成轮空。</small></label>
            <label><span>每个分区人数</span><select value={divisionSize} disabled={!canConfigure || Boolean(initialData.latestSession)} onChange={(event) => setDivisionSize(Number(event.target.value))}><option value={16}>16人 / 区</option><option value={32}>32人 / 区</option><option value={64}>64人 / 区</option></select><small>华彩资格赛默认32人一个分区，512签表即16个分区。</small></label>
            <label><span>局胜率增补人数</span><input type="number" min={0} max={64} value={rateQualifierCount} disabled={!canConfigure || Boolean(initialData.latestSession)} onChange={(event) => setRateQualifierCount(Number(event.target.value))}/><small>默认从各区决胜轮负者中按局胜率排序，取前8名增补晋级。</small></label>
            <label><span>种子选手</span><input value={initialData.selectedPhase.startsWith("qualifier") ? "资格赛不启用" : "正赛可配置"} disabled/><small>正赛第一阶段将支持种子直接进入；种子缺席时按局胜率候补，后续接入正赛名单时生效。</small></label>
          </div>
        </section>

        <section className="draw-panel draw-plan-panel">
          <header><div><small>02 · AUTO CALCULATION</small><h3>系统自动计算</h3></div><span>无需人工计算轮空 / 附加赛</span></header>
          <div className="draw-metrics">
            <article><span>实际人数</span><strong>{entrantCount}</strong><small>当前阶段参赛名单</small></article>
            <article><span>附加赛</span><strong>{playoffMatchCount}</strong><small>{playoffMatchCount ? `${playoffPlayerCount}人参加 · ${directEntryCount}人直入标准签表` : "无需附加赛"}</small></article>
            <article><span>轮空</span><strong>{byeCount}</strong><small>{byeCount ? `自动分散到${divisionCount}个分区` : "无轮空"}</small></article>
            <article><span>分区</span><strong>{divisionCount}</strong><small>{divisionSize}人 / 区</small></article>
            <article><span>直接晋级</span><strong>{directQualifierCount}</strong><small>每区冠军1人</small></article>
            <article><span>局胜率增补</span><strong>{rateQualifierCount}</strong><small>各区决胜轮负者统一排名</small></article>
          </div>
          <div className="draw-rule-line"><b>最终资格赛晋级：</b><span>{directQualifierCount} 名分区冠军 + {rateQualifierCount} 名局胜率增补 = <strong>{totalQualifierCount} 人</strong></span></div>
        </section>

        <section className="draw-panel">
          <header><div><small>03 · DRAW VERSION</small><h3>正式抽签</h3></div>{initialData.latestSession && <span>V{initialData.latestSession.versionNo} · {statusLabel(initialData.latestSession.status)}</span>}</header>
          {!initialData.latestSession && <div className="draw-create-box"><div><strong>锁定名单后生成结果</strong><p>服务器会一次性完成随机抽签并保存结果。动画页面只读取这份已经保存的结果，因此刷新、断网或重新打开大屏都不会改变签位。</p></div><button type="button" disabled={!canCreate || busy} onClick={createDraw}>{busy ? "正在生成..." : "生成抽签草稿"}</button></div>}
          {initialData.latestSession && !session && <div className="draw-create-box"><div><strong>已有抽签版本</strong><p>创建时间 {initialData.latestSession.createdAt} · 随机承诺 {initialData.latestSession.randomCommitment.slice(0, 16)}…</p></div><button type="button" disabled={busy} onClick={loadSession}>{busy ? "读取中..." : "查看抽签结果"}</button></div>}
          {message && <p className="draw-message">{message}</p>}
        </section>

        {session && <section className="draw-panel draw-results-panel">
          <header><div><small>04 · RESULT PREVIEW</small><h3>V{session.session.versionNo} 抽签结果</h3></div><span className={`draw-status ${session.session.status}`}>{statusLabel(session.session.status)}</span></header>
          <div className="draw-results-actions"><Link target="_blank" href={`/admin/competition/draw/${session.session.id}/screen`}>打开抽签大屏 ↗</Link>{session.session.status === "confirmed" && <Link href={`/admin/competition/bracket?session=${encodeURIComponent(session.session.id)}&event=${encodeURIComponent(session.session.eventId)}`}>完整分区签表 →</Link>}{session.session.status === "draft" && initialData.viewerRole !== "referee" && <><button type="button" disabled={busy} onClick={confirmDraw}>确认正式签表</button><button className="danger" type="button" disabled={busy} onClick={voidDraw}>作废并重抽</button></>}{session.session.status === "confirmed" && initialData.viewerRole !== "referee" && <button className="danger" type="button" disabled={busy} onClick={voidDraw}>作废正式签表</button>}</div>
          <div className="draw-result-summary"><span>参赛 {session.session.entrantCount}</span><span>{session.session.divisionCount} 个分区</span><span>附加赛 {session.session.playoffMatchCount} 场</span><span>轮空 {session.session.byeCount}</span><span>随机承诺 {session.session.randomCommitment.slice(0, 12)}…</span></div>
          <div className="draw-division-tabs">{Array.from({ length: session.session.divisionCount }, (_, index) => index + 1).map((item) => <button type="button" key={item} className={division === item ? "active" : ""} onClick={() => setDivision(item)}>第{item}区</button>)}</div>
          <div className="draw-slot-table">{visibleSlots.map((slot) => {
            const prelim = slot.prelimMatchId ? prelimById.get(slot.prelimMatchId) : null;
            return <div key={slot.slotNo}><span>{String(slot.slotNo).padStart(3, "0")}</span><b>{slot.slotType === "bye" ? "BYE / 轮空" : slot.slotType === "playoff_winner" ? `附加赛${prelim?.matchNo ?? ""}胜者` : slot.playerName}</b><small>{slot.slotType === "playoff_winner" && prelim ? `${prelim.playerAName} vs ${prelim.playerBName}` : `区内签位 ${slot.divisionSlotNo}`}</small></div>;
          })}</div>
        </section>}
      </div>

      <aside className="draw-side-column">
        <section><small>本轮规则确认</small><h3>一次抽签到底</h3><p>资格赛第一场 / 第二场都不是每轮重抽。名单锁定后只抽一次，之后在同一张分区签表中连续比赛到每区冠军。</p></section>
        <section><small>32强负者增补</small><h3>局胜率前8</h3><p>16个分区各产生1名决胜轮负者，共16人进入候补池。系统会自动计算局胜率并排序，默认取前8名，由组委会最终确认。</p></section>
        <section><small>种子与候补</small><h3>从第一版预留</h3><p>正赛第一阶段支持设置是否启用种子以及种子名额。若种子不到场，缺额优先从资格赛候补池按局胜率顺序增补。</p></section>
        <section><small>赛程层</small><h3>时间稍后配置</h3><p>签表关系不绑定时间。单独设置 09:00、10:45、13:30 等比赛时段，再结合球台和裁判自动编排，临时换台不会改变签表。</p></section>
      </aside>
    </section>
  </main>;
}
