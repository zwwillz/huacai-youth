"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import type { CompetitionDashboardData } from "@/db/competition-dashboard";
import CompetitionContextBar from "./competition-context-bar";

const CACHE_TTL = 30_000;
const cache = new Map<string, { data: CompetitionDashboardData; at: number }>();
const phases = [
  { code: "qualifier-one", no: "01", title: "资格赛第一场", note: "一次抽签 · 完整分区签表", source: "已审核参赛名单" },
  { code: "qualifier-two", no: "02", title: "资格赛第二场", note: "独立抽签 · 第一场未晋级球员", source: "第一场晋级确认后自动生成" },
  { code: "main-one", no: "03", title: "正赛第一阶段", note: "64人 · 8组双败", source: "资格赛48人 + 16名种子 / 递补" },
  { code: "main-two", no: "04", title: "正赛第二阶段", note: "32强 · 重新抽签 · 单败", source: "正赛第一阶段确认后的32强" },
] as const;

function drawStatusLabel(status?: string) {
  if (!status) return "未抽签";
  if (status === "draft") return "抽签草稿";
  if (status === "confirmed") return "正式签表";
  if (status === "void") return "已作废";
  return "等待处理";
}

function replaceUrl(eventId: string, groupId: string) {
  const params = new URLSearchParams({ event: eventId });
  if (groupId) params.set("group", groupId);
  window.history.replaceState(window.history.state, "", `/admin/competition?${params.toString()}`);
}

export default function CompetitionOverviewClient({ initialData, initialGroupId }: { initialData: CompetitionDashboardData; initialGroupId: string }) {
  const [data, setData] = useState(initialData);
  const [selectedGroupId, setSelectedGroupId] = useState(initialGroupId || initialData.groups[0]?.id || "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const requestId = useRef(0);

  useEffect(() => { if (initialData.selectedEventId) cache.set(initialData.selectedEventId, { data: initialData, at: Date.now() }); }, [initialData]);

  useEffect(() => {
    const onSwitch = (event: Event) => {
      const detail = (event as CustomEvent<{ eventId?: string; previousEventId?: string; active?: string; competitionTool?: string }>).detail;
      if (detail?.active !== "competition" || detail.competitionTool !== "overview" || !detail.eventId || detail.eventId === data.selectedEventId) return;
      const eventId = detail.eventId;
      const previousEventId = detail.previousEventId || data.selectedEventId;
      const currentRequest = ++requestId.current;
      const cached = cache.get(eventId);
      setError("");
      if (cached && Date.now() - cached.at < CACHE_TTL) {
        setData(cached.data);
        const groupId = cached.data.groups[0]?.id || "";
        setSelectedGroupId(groupId);
        replaceUrl(eventId, groupId);
        setLoading(false);
        return;
      }
      setLoading(true);
      void fetch(`/api/admin/competition/overview?eventId=${encodeURIComponent(eventId)}`, { cache: "no-store" })
        .then(async (response) => {
          const payload = await response.json() as { data?: CompetitionDashboardData; error?: string };
          if (!response.ok || !payload.data) throw new Error(payload.error || "竞赛总览读取失败。");
          if (currentRequest !== requestId.current) return;
          cache.set(eventId, { data: payload.data, at: Date.now() });
          setData(payload.data);
          const groupId = payload.data.groups[0]?.id || "";
          setSelectedGroupId(groupId);
          replaceUrl(eventId, groupId);
        })
        .catch((failure) => {
          if (currentRequest !== requestId.current) return;
          setError(failure instanceof Error ? failure.message : "竞赛总览读取失败。");
          if (previousEventId) window.dispatchEvent(new CustomEvent("admin:event-switch-revert", { detail: { eventId: previousEventId } }));
        })
        .finally(() => { if (currentRequest === requestId.current) setLoading(false); });
    };
    window.addEventListener("admin:event-switch", onSwitch);
    return () => window.removeEventListener("admin:event-switch", onSwitch);
  }, [data.selectedEventId]);

  const selectedGroup = data.groups.find((group) => group.id === selectedGroupId) ?? data.groups[0];
  const currentEvent = data.events.find((event) => event.id === data.selectedEventId);
  const approvedCount = selectedGroup?.approvedCount ?? 0;
  const playoffCount = Math.max(0, approvedCount - 512);
  const byeCount = Math.max(0, 512 - approvedCount);
  const nextPhase = phases.find((phase) => selectedGroup?.draws[phase.code]?.status !== "confirmed");
  const nextDraw = nextPhase ? selectedGroup?.draws[nextPhase.code] : null;
  const nextAction = useMemo(() => !selectedGroup
    ? { title: "先选择比赛组别", detail: "少年组和青年组分别维护，选择后再处理当前阶段。", label: "选择组别", href: "/admin/competition" }
    : approvedCount === 0
      ? { title: `${selectedGroup.name}尚无已审核名单`, detail: "抽签必须使用已审核参赛名单；请先确认本站报名数据。", label: "查看赛事设置", href: `/admin/events/${encodeURIComponent(data.selectedEventId)}` }
      : nextPhase
        ? { title: `${nextPhase.title} · ${nextDraw?.status === "draft" ? "确认抽签草稿" : "生成抽签"}`, detail: `当前名单 ${approvedCount} 人。完成这一阶段后再进入赛程编排，避免跨阶段操作。`, label: nextDraw?.status === "draft" ? "继续确认抽签" : "进入抽签", href: `/admin/competition/draw?event=${encodeURIComponent(data.selectedEventId)}&group=${encodeURIComponent(selectedGroup.id)}&phase=${nextPhase.code}` }
        : { title: "当前组别签表均已确认", detail: "下一步进入赛程编排，设置比赛时间、球台、TV台和裁判。", label: "进入赛程编排", href: `/admin/competition/schedules?event=${encodeURIComponent(data.selectedEventId)}&group=${encodeURIComponent(selectedGroup.id)}` }, [approvedCount, data.selectedEventId, nextDraw?.status, nextPhase, selectedGroup]);

  const chooseGroup = (groupId: string) => {
    setSelectedGroupId(groupId);
    replaceUrl(data.selectedEventId, groupId);
  };

  return <div className={loading ? "admin-local-workspace is-refreshing" : "admin-local-workspace"}>
    {loading && <div className="admin-local-refresh"><i />正在切换竞赛赛事…</div>}
    {error && <div className="admin-local-error">{error}</div>}
    <main className="competition-workspace-page"><section className="competition-workspace-shell">
      {selectedGroup && <CompetitionContextBar eventId={data.selectedEventId} eventTitle={currentEvent?.shortTitle || "竞赛执行"} groups={data.groups} selectedGroupId={selectedGroup.id} basePath="/admin/competition" eyebrow="竞赛执行" title={`${selectedGroup.name} · 竞赛总览`} description="统一使用同一个组别上下文。组别切换现在只更新当前工作区，不再重新加载整个后台页面。" onGroupChange={chooseGroup} />}

      <section className="competition-next-task"><div><small>当前建议下一步</small><h2>{nextAction.title}</h2><p>{nextAction.detail}</p></div><Link prefetch={false} href={nextAction.href}>{nextAction.label} →</Link></section>

      {selectedGroup && <section className="competition-qualifier-summary">
        <article><small>当前报名审核</small><strong>{approvedCount}</strong><span>人</span></article>
        <article><small>资格赛标准签表</small><strong>512</strong><span>签位</span></article>
        <article><small>自动附加赛</small><strong>{playoffCount}</strong><span>场</span></article>
        <article><small>自动轮空</small><strong>{byeCount}</strong><span>个</span></article>
        <article><small>正赛第一阶段</small><strong>64</strong><span>人 · 8组双败</span></article>
        <article><small>正赛第二阶段</small><strong>32</strong><span>人 · 单败</span></article>
      </section>}

      <section className="competition-stage-board"><header><div><small>比赛阶段</small><h2>当前组别的四个阶段</h2><p>每个阶段都可以进入查看。尚未满足条件时页面不会消失，而是明确告诉你“还缺什么”和下一步应该去哪。</p></div></header>
        <div className="competition-stage-grid">{phases.map((phase) => {
          const draw = selectedGroup?.draws[phase.code];
          return <article key={phase.code} className="ready"><div className="competition-stage-no">{phase.no}</div><div className="competition-stage-copy"><span>{phase.note}</span><h3>{phase.title}</h3><p>名单来源：{phase.source}</p></div><dl><div><dt>抽签状态</dt><dd>{drawStatusLabel(draw?.status)}</dd></div>{draw && <><div><dt>版本</dt><dd>V{draw.versionNo}</dd></div><div><dt>抽签人数</dt><dd>{draw.entrantCount}</dd></div></>}</dl><Link prefetch={false} href={selectedGroup ? `/admin/competition/draw?event=${encodeURIComponent(data.selectedEventId)}&group=${encodeURIComponent(selectedGroup.id)}&phase=${phase.code}` : "/admin/competition"}>{draw ? "查看当前阶段 →" : "进入当前阶段 →"}</Link></article>;
        })}</div>
      </section>

      <section className="competition-flow compact-flow">
        <article className="available"><span>01</span><h2>抽签与签表</h2><p>按组别、阶段生成抽签。草稿只保存在后台，确认后再决定何时发布。</p><b>抽签</b></article><i>→</i>
        <article className="available"><span>02</span><h2>赛程编排</h2><p>只显示当前组别和阶段，设置时间、球台、TV台与裁判。</p><b><Link prefetch={false} href={`/admin/competition/schedules?event=${encodeURIComponent(data.selectedEventId)}&group=${encodeURIComponent(selectedGroup?.id || "")}`}>进入赛程</Link></b></article><i>→</i>
        <article className="available"><span>03</span><h2>比分录入</h2><p>默认只看最新待处理比赛，已确认比赛自动收起。</p><b><Link prefetch={false} href={`/admin/competition/scoring?event=${encodeURIComponent(data.selectedEventId)}&group=${encodeURIComponent(selectedGroup?.id || "")}`}>进入比分</Link></b></article><i>→</i>
        <article className="available"><span>04</span><h2>晋级</h2><p>按阶段完成资格赛晋级、种子递补、64人锁定和32强确认。</p><b><Link prefetch={false} href={`/admin/competition/qualification?event=${encodeURIComponent(data.selectedEventId)}&group=${encodeURIComponent(selectedGroup?.id || "")}`}>进入晋级</Link></b></article><i>→</i>
        <article className="available"><span>05</span><h2>最终排名</h2><p>自动生成 → 可人工调整 → 确认 → 发布到用户端。</p><b><Link prefetch={false} href={`/admin/competition/final-ranking?event=${encodeURIComponent(data.selectedEventId)}&group=${encodeURIComponent(selectedGroup?.id || "")}`}>进入排名</Link></b></article>
      </section>

      <section className="competition-principles"><article><strong>保存 ≠ 发布</strong><p>抽签、赛程和比分在后台保存或确认后，先作为后台正式数据；只有对应模块点击“发布到用户端”，公众页面才显示。</p></article><article><strong>默认只看当前任务</strong><p>比分隐藏已确认场次；赛程和晋级只处理当前组别、当前阶段，需要复核历史时再主动切换。</p></article><article><strong>未就绪也有明确入口</strong><p>阶段数据尚未产生时保留入口和签表结构，通过“等待上一阶段 / 待定 / 尚未排期”等友好状态说明下一步。</p></article></section>
    </section></main>
  </div>;
}
