"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type {
  PlayerEventStats,
  SnookerCalendarEvent,
  SnookerDashboardSnapshot,
  SnookerEvent,
  SnookerMatch,
  SnookerPlayer,
} from "@/lib/snooker/domain";
import styles from "./snooker-data-center.module.css";
import priority from "./snooker-priority.module.css";

type MainView = "home" | "matches" | "players" | "data";
type Theme = "green" | "red";
type PlayerFilter = "全部" | "中国" | "TOP16";
type EventTab = "overview" | "schedule" | "data";
type EventListMode = "recent" | "calendar";
type DetailState =
  | { type: "event"; slug: string; tab: EventTab }
  | { type: "match"; matchId: string; eventSlug: string }
  | { type: "player"; playerId: string };

type SourceHealth = {
  online: boolean;
  accepted: boolean;
  eventAccepted: boolean;
  liveAccepted: boolean;
  source: string;
  fetchedAt: string;
  latencyMs: number;
  parsedRoundCount: number;
  parsedMatchCount: number;
  overlayCount: number;
  changedCount?: number;
  pollingSeconds: number;
  liveScore?: string | null;
  appliedFinalScore?: string;
  matchId?: string | null;
  message: string;
};

type DashboardResponse = {
  ok?: boolean;
  snapshot?: SnookerDashboardSnapshot;
  databaseEvents?: SnookerEvent[];
  sourceHealth?: SourceHealth;
};

const navItems: Array<{ id: MainView; label: string; icon: string }> = [
  { id: "home", label: "首页", icon: "⌂" },
  { id: "matches", label: "赛事", icon: "◫" },
  { id: "players", label: "球员", icon: "◎" },
  { id: "data", label: "数据", icon: "▥" },
];

const playerFilters: PlayerFilter[] = ["全部", "中国", "TOP16"];

function initials(name: string) {
  return name.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase();
}

function formatDateRange(start: string, end: string) {
  const s = new Date(`${start}T00:00:00+08:00`);
  const e = new Date(`${end}T00:00:00+08:00`);
  const sm = s.getMonth() + 1;
  const sd = s.getDate();
  const em = e.getMonth() + 1;
  const ed = e.getDate();
  return sm === em ? `${sm}月${sd}日—${ed}日` : `${sm}月${sd}日—${em}月${ed}日`;
}

function formatBirthday(value?: string) {
  if (!value) return "—";
  const date = new Date(`${value}T00:00:00Z`);
  return `${date.getUTCFullYear()}年${date.getUTCMonth() + 1}月${date.getUTCDate()}日`;
}

function bestOfLabel(bestOf: number) {
  return `${bestOf}局${Math.floor(bestOf / 2) + 1}胜`;
}

function chinaToday() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function addDateDays(value: string, days: number) {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function isActiveOn(item: SnookerCalendarEvent, today: string) {
  return item.startDate <= today && item.endDate >= today;
}

function playerMap(snapshot: SnookerDashboardSnapshot) {
  return new Map(snapshot.players.map((player) => [player.id, player]));
}

function allMatches(event: SnookerEvent) {
  return event.rounds.flatMap((round) => round.matches);
}

function finalOf(event?: SnookerEvent) {
  return event?.rounds.find((round) => round.key === "final")?.matches[0];
}

function matchRealtimeSignature(match: SnookerMatch) {
  return JSON.stringify({
    score1: match.score1,
    score2: match.score2,
    status: match.status,
    winnerId: match.winnerId ?? null,
    frames: (match.frames ?? []).map((frame) => [frame.frameNo, frame.score1, frame.score2, frame.break1 ?? null, frame.break2 ?? null]),
  });
}

function realtimeSignature(snapshot: SnookerDashboardSnapshot) {
  return JSON.stringify(allMatches(snapshot.event).map((match) => [match.id, matchRealtimeSignature(match)]));
}

function matchSignatureMap(snapshot: SnookerDashboardSnapshot) {
  return new Map(allMatches(snapshot.event).map((match) => [match.id, matchRealtimeSignature(match)]));
}

function initialMatchUpdateTimes(snapshot: SnookerDashboardSnapshot) {
  return Object.fromEntries(
    allMatches(snapshot.event)
      .filter((match) => match.status === "live" || match.status === "session-break")
      .map((match) => [match.id, snapshot.event.snapshotAt]),
  );
}

function currentEventStats(playerId: string, event: SnookerEvent): PlayerEventStats | null {
  const matches = allMatches(event).filter((match) => match.player1Id === playerId || match.player2Id === playerId);
  if (!matches.length) return null;
  let wins = 0;
  let losses = 0;
  let frameWins = 0;
  let frameLosses = 0;
  for (const match of matches) {
    const isP1 = match.player1Id === playerId;
    const selfScore = isP1 ? match.score1 : match.score2;
    const opponentScore = isP1 ? match.score2 : match.score1;
    if (selfScore !== null) frameWins += selfScore;
    if (opponentScore !== null) frameLosses += opponentScore;
    if (match.winnerId === playerId) wins += 1;
    else if (match.status === "completed" || match.status === "walkover") losses += 1;
  }
  const roundOrder = event.rounds.map((round) => round.key);
  const bestMatch = [...matches].sort((a, b) => roundOrder.indexOf(a.roundKey) - roundOrder.indexOf(b.roundKey))[0];
  return {
    playerId,
    eventId: event.id,
    played: wins + losses,
    wins,
    losses,
    frameWins,
    frameLosses,
    bestRoundKey: bestMatch.roundKey,
    bestRoundLabelZh: bestMatch.roundLabelZh,
    isActive: matches.some((match) => match.status === "live" || match.status === "session-break" || match.status === "upcoming"),
    matches,
  };
}

function SectionHeader({ eyebrow, title, action }: { eyebrow?: string; title: string; action?: string }) {
  return <div className={styles.sectionHeader}><div>{eyebrow ? <small>{eyebrow}</small> : null}<h2>{title}</h2></div>{action ? <span>{action}</span> : null}</div>;
}

function PlayerAvatar({ player, size = "md" }: { player: SnookerPlayer; size?: "sm" | "md" | "lg" | "xl" }) {
  return <span className={`${styles.avatar} ${styles[`avatar_${size}`]}`} aria-label={player.nameZh}>{initials(player.nameEn)}</span>;
}

function StatusPill({ status, label }: { status: string; label: string }) {
  return <span className={`${styles.statusPill} ${styles[`status_${status}`] ?? ""}`}>{label}</span>;
}

function MatchListRow({ match, players, onOpen }: { match: SnookerMatch; players: Map<string, SnookerPlayer>; onOpen: () => void }) {
  const p1 = players.get(match.player1Id);
  const p2 = players.get(match.player2Id);
  if (!p1 || !p2) return null;
  const score = match.status === "walkover" ? "W : O" : `${match.score1 ?? "-"} : ${match.score2 ?? "-"}`;
  return (
    <button className={`${styles.matchRow} ${priority.horizontalMatchRow}`} onClick={onOpen}>
      <div className={styles.matchRowMeta}>
        <span>{match.timeLabelZh ?? match.roundLabelZh}</span><span>{bestOfLabel(match.bestOf)}</span>
        <StatusPill status={match.status} label={match.status === "session-break" ? "进行中" : match.statusLabelZh} />
      </div>
      <div className={priority.matchVersusRow}>
        <span className={`${priority.matchPlayerLeft} ${match.winnerId === p1.id ? styles.winnerName : ""}`}>{p1.nameZh}{match.winnerId === p1.id ? <em>胜</em> : null}</span>
        <b>{score}</b>
        <span className={`${priority.matchPlayerRight} ${match.winnerId === p2.id ? styles.winnerName : ""}`}>{match.winnerId === p2.id ? <em>胜</em> : null}{p2.nameZh}</span>
      </div>
      <small className={styles.tapHint}>查看完整比分 ›</small>
    </button>
  );
}

function CalendarCard({ item, onOpen, interactive = true }: { item: SnookerCalendarEvent; onOpen?: () => void; interactive?: boolean }) {
  const content = <>
    <div className={styles.calendarDate}><b>{new Date(`${item.startDate}T00:00:00+08:00`).getMonth() + 1}/{new Date(`${item.startDate}T00:00:00+08:00`).getDate()}</b><small>{item.statusLabelZh}</small></div>
    <div><span><StatusPill status={item.status} label={item.typeZh} /></span><strong>{item.nameZh}</strong><small>{item.nameEn}</small><p>{formatDateRange(item.startDate, item.endDate)} · {item.countryZh} {item.cityZh}{item.winnerZh ? ` · 冠军 ${item.winnerZh}` : ""}</p></div>
    {interactive ? <em>›</em> : null}
  </>;
  if (!interactive) return <article className={`${priority.calendarStaticCard} ${item.current ? priority.calendarStaticCurrent : ""}`}>{content}</article>;
  return <button className={item.current ? styles.calendarCurrent : ""} onClick={onOpen}>{content}</button>;
}

export default function SnookerDataCenter({
  initialSnapshot,
  initialDatabaseEvents,
  initialSourceHealth,
  buildMark,
  initialView = "home",
}: {
  initialSnapshot: SnookerDashboardSnapshot;
  initialDatabaseEvents: SnookerEvent[];
  initialSourceHealth?: SourceHealth | null;
  buildMark: string;
  initialView?: "home" | "matches" | "data";
}) {
  const router = useRouter();
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [databaseEvents, setDatabaseEvents] = useState(initialDatabaseEvents);
  const [activeView, setActiveView] = useState<MainView>(initialView);
  const [detail, setDetail] = useState<DetailState | null>(null);
  const [theme, setTheme] = useState<Theme>("green");
  const [sourceHealth, setSourceHealth] = useState<SourceHealth | null>(initialSourceHealth ?? null);
  const [refreshing, setRefreshing] = useState(false);
  const [eventListMode, setEventListMode] = useState<EventListMode>("recent");
  const [playerFilter, setPlayerFilter] = useState<PlayerFilter>("全部");
  const [playerQuery, setPlayerQuery] = useState("");
  const [lastUpdatedAt, setLastUpdatedAt] = useState(initialSnapshot.event.snapshotAt);
  const [matchUpdatedAt, setMatchUpdatedAt] = useState<Record<string, string>>(() => initialMatchUpdateTimes(initialSnapshot));
  const realtimeSignatureRef = useRef(realtimeSignature(initialSnapshot));
  const matchSignaturesRef = useRef(matchSignatureMap(initialSnapshot));

  const hasLiveMatch = useMemo(() => databaseEvents.some((event) => allMatches(event).some((match) => match.status === "live" || match.status === "session-break")), [databaseEvents]);

  const refresh = useCallback(async () => {
    if (typeof document !== "undefined" && document.hidden) return;
    setRefreshing(true);
    try {
      const response = await fetch(`/api/snooker/v1/dashboard?ts=${Date.now()}`, { cache: "no-store", headers: { "cache-control": "no-cache" } });
      const data = await response.json() as DashboardResponse;
      if (response.ok && data.ok && data.snapshot) {
        const changedAt = data.sourceHealth?.fetchedAt ?? new Date().toISOString();
        const nextSignature = realtimeSignature(data.snapshot);
        if (nextSignature !== realtimeSignatureRef.current) {
          realtimeSignatureRef.current = nextSignature;
          setLastUpdatedAt(changedAt);
        }
        const nextMatchSignatures = matchSignatureMap(data.snapshot);
        const changedMatchIds: string[] = [];
        for (const [matchId, signature] of nextMatchSignatures) if (matchSignaturesRef.current.get(matchId) !== signature) changedMatchIds.push(matchId);
        matchSignaturesRef.current = nextMatchSignatures;
        if (changedMatchIds.length) setMatchUpdatedAt((current) => {
          const next = { ...current };
          for (const matchId of changedMatchIds) next[matchId] = changedAt;
          return next;
        });
        setSnapshot(data.snapshot);
        if (data.databaseEvents) setDatabaseEvents(data.databaseEvents);
      }
      if (data.sourceHealth) setSourceHealth(data.sourceHealth);
    } catch {
      setSourceHealth(null);
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (!hasLiveMatch) return;
    const timer = window.setInterval(() => void refresh(), 30_000);
    const onVisibility = () => { if (!document.hidden) void refresh(); };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [hasLiveMatch, refresh]);

  const players = useMemo(() => playerMap(snapshot), [snapshot]);
  const event = snapshot.event;
  const eventDetailsBySlug = useMemo(() => new Map(databaseEvents.map((item) => [item.slug, item])), [databaseEvents]);
  const today = chinaToday();
  const seasonCalendar = useMemo(() => [...snapshot.calendar].filter((item) => item.season === "2026/27").sort((a, b) => a.startDate.localeCompare(b.startDate)), [snapshot.calendar]);
  const mainSeasonEvents = useMemo(() => seasonCalendar.filter((item) => item.typeZh !== "资格赛"), [seasonCalendar]);
  const activeEventCard = mainSeasonEvents.find((item) => isActiveOn(item, today));
  const graceEventCard = [...mainSeasonEvents].reverse().find((item) => item.endDate < today && addDateDays(item.endDate, 1) === today);
  const firstUpcomingMain = mainSeasonEvents.find((item) => item.startDate > today);
  const featuredEventCard = activeEventCard ?? graceEventCard ?? firstUpcomingMain ?? [...mainSeasonEvents].reverse()[0];
  const nextEventCard = featuredEventCard ? mainSeasonEvents.find((item) => item.startDate > featuredEventCard.startDate) : firstUpcomingMain;
  const firstUpcomingAny = seasonCalendar.find((item) => item.startDate > today);
  const recentEvents = useMemo(() => seasonCalendar
    .filter((item) => item.endDate < today || isActiveOn(item, today) || item.id === firstUpcomingAny?.id)
    .filter((item) => item.id !== featuredEventCard?.id)
    .sort((a, b) => b.startDate.localeCompare(a.startDate)), [seasonCalendar, today, firstUpcomingAny?.id, featuredEventCard?.id]);
  const featuredLabel = activeEventCard?.id === featuredEventCard?.id ? "当前赛事" : graceEventCard?.id === featuredEventCard?.id ? "刚刚结束" : "下一站";
  const featuredEyebrow = featuredLabel === "当前赛事" ? "CURRENT TOURNAMENT" : featuredLabel === "刚刚结束" ? "LATEST TOURNAMENT" : "NEXT TOURNAMENT";

  const latestCompletedDetail = useMemo(() => [...databaseEvents]
    .filter((item) => item.endDate < today && Boolean(finalOf(item)))
    .sort((a, b) => b.endDate.localeCompare(a.endDate))[0], [databaseEvents, today]);
  const activeDetail = activeEventCard ? eventDetailsBySlug.get(activeEventCard.slug) : undefined;
  const scoreEvent = activeDetail ?? (!activeEventCard ? latestCompletedDetail : undefined);
  const scoreEventMatches = scoreEvent ? allMatches(scoreEvent) : [];
  const scoreMatch = scoreEvent
    ? scoreEventMatches.find((match) => match.status === "live" || match.status === "session-break")
      ?? scoreEventMatches.find((match) => match.status === "upcoming")
      ?? finalOf(scoreEvent)
    : undefined;

  const rankingRows = useMemo(() => snapshot.rankings.map((row) => ({ ...row, player: players.get(row.playerId)! })).filter((row) => row.player), [snapshot.rankings, players]);
  const chinaTop16 = rankingRows.filter((row) => row.player.countryCode === "CN" || row.player.countryCode === "CHN");
  const filteredPlayers = useMemo(() => {
    const needle = playerQuery.trim().toLowerCase();
    return [...snapshot.players]
      .sort((a, b) => (a.currentRank ?? 999) - (b.currentRank ?? 999) || a.nameEn.localeCompare(b.nameEn))
      .filter((player) => {
        if (playerFilter === "中国" && player.countryCode !== "CN" && player.countryCode !== "CHN") return false;
        if (playerFilter === "TOP16" && (player.currentRank === null || player.currentRank > 16)) return false;
        if (!needle) return true;
        return `${player.nameZh} ${player.shortNameZh} ${player.nameEn} ${player.nationalityZh}`.toLowerCase().includes(needle);
      });
  }, [snapshot.players, playerFilter, playerQuery]);

  const openEvent = (slug: string, tab: EventTab = "overview") => { setDetail({ type: "event", slug, tab }); window.scrollTo({ top: 0, behavior: "smooth" }); };
  const openMatch = (matchId: string, eventSlug = event.slug) => { setDetail({ type: "match", matchId, eventSlug }); window.scrollTo({ top: 0, behavior: "smooth" }); };
  const openPlayer = (playerIdValue: string) => { const target = players.get(playerIdValue); router.push(target?.slug ? `/snooker/players/${target.slug}` : "/snooker/players"); };
  const changeView = (view: MainView) => {
    if (view === "players") { router.push("/snooker/players"); return; }
    setDetail(null);
    setActiveView(view);
    try { window.history.replaceState(null, "", view === "home" ? "/snooker" : `/snooker?view=${view}`); } catch {}
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const updatedTime = new Date(lastUpdatedAt).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: "Asia/Shanghai" });
  const sourceLabel = sourceHealth?.source === "Snooker DB"
    ? (sourceHealth.online ? "独立数据库 · 官方数据已入库" : "数据库暂不可用 · 使用已验证快照")
    : sourceHealth?.accepted
      ? `WST官方数据 · ${sourceHealth.liveAccepted ? "实时比分已同步" : "赛事比分已同步"}`
      : sourceHealth?.online ? "WST数据在线 · 等待安全覆盖" : sourceHealth === null ? "正在连接数据源" : "实时源暂不可用 · 使用已验证快照";

  if (detail?.type === "match") {
    const detailEvent = eventDetailsBySlug.get(detail.eventSlug) ?? event;
    const detailMatches = allMatches(detailEvent);
    const fallback = finalOf(detailEvent) ?? detailMatches[0];
    const match = detailMatches.find((item) => item.id === detail.matchId) ?? fallback;
    if (!match) return null;
    const p1 = players.get(match.player1Id);
    const p2 = players.get(match.player2Id);
    if (!p1 || !p2) return null;
    const target = Math.floor(match.bestOf / 2) + 1;
    const statusLabelValue = match.status === "completed" || match.status === "walkover" ? "已结束" : match.status === "upcoming" ? "待开始" : "进行中";
    const isRealtimeMatch = match.status === "live" || match.status === "session-break";
    const matchUpdateTime = new Date(matchUpdatedAt[match.id] ?? detailEvent.snapshotAt).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: "Asia/Shanghai" });
    return <main className={styles.appRoot} data-theme={theme}><div className={styles.detailShell}>
      <header className={styles.detailHeader}><button onClick={() => setDetail({ type: "event", slug: detail.eventSlug, tab: "schedule" })}>‹</button><strong>比赛详情</strong><span>DATA v0.6</span></header>
      <section className={styles.matchHero}>
        <div className={styles.matchHeroMeta}><span>{match.roundLabelZh} · {match.timeLabelZh ?? "比赛时间待同步"}</span><b>{match.bestOf}局{target}胜</b></div>
        <h1>{detailEvent.nameZh}</h1>
        <div className={styles.versusGrid}>
          <div className={styles.versusPlayer}><div className={styles.avatarWrap}><PlayerAvatar player={p1} size="xl" />{match.winnerId === p1.id ? <em>胜</em> : null}</div><strong>{p1.nameZh}</strong><small>{p1.nameEn}</small></div>
          <div className={styles.bigScore}><strong>{match.status === "walkover" ? "W - O" : `${match.score1 ?? "-"} - ${match.score2 ?? "-"}`}</strong><StatusPill status={match.status} label={statusLabelValue} /><small>{bestOfLabel(match.bestOf)}</small>{isRealtimeMatch ? <small>{refreshing ? "正在同步…" : `最近更新 ${matchUpdateTime}`}</small> : null}</div>
          <div className={styles.versusPlayer}><div className={styles.avatarWrap}><PlayerAvatar player={p2} size="xl" />{match.winnerId === p2.id ? <em>胜</em> : null}</div><strong>{p2.nameZh}</strong><small>{p2.nameEn}</small></div>
        </div>
        {match.sessionTimesZh?.length ? <div className={styles.sessionTimes}>{match.sessionTimesZh.map((item) => <span key={item}>{item}</span>)}</div> : null}
      </section>
      <section className={styles.frameSection}>
        <div className={styles.frameHead}><span>单杆<br />(50+)</span><span>分数</span><b>局</b><span>分数</span><span>单杆<br />(50+)</span></div>
        {match.frames?.length ? match.frames.map((frame) => <div className={styles.frameRow} key={frame.frameNo}><span>{frame.break1 ?? "-"}</span><strong>{frame.score1}</strong><b>{frame.frameNo}</b><strong>{frame.score2}</strong><span>{frame.break2 ?? "-"}</span></div>) : <div className={styles.emptyFrames}>{match.status === "completed" ? "WST 当前未返回该场历史逐局数据，已保存官方总比分。" : "该场逐局数据将在比赛开始后同步。"}</div>}
      </section>
      <section className={styles.detailInfoCard}><div><span>比赛时间</span><b>{match.timeLabelZh ?? "待同步"}</b></div><div><span>赛制</span><b>{bestOfLabel(match.bestOf)}</b></div><div><span>状态</span><b>{statusLabelValue}</b></div>{match.note ? <p>{match.note}</p> : null}</section>
      {isRealtimeMatch ? <div className={styles.liveFooter}><i className={sourceHealth?.accepted ? styles.liveOk : styles.liveWait} /><span>{sourceLabel}</span><small>30秒自动同步</small></div> : null}
    </div></main>;
  }

  if (detail?.type === "player") {
    const player = players.get(detail.playerId) ?? snapshot.players[0];
    const statsEvent = eventDetailsBySlug.get(featuredEventCard?.slug ?? "") ?? event;
    const stats = currentEventStats(player.id, statsEvent);
    return <main className={styles.appRoot} data-theme={theme}><div className={styles.detailShell}>
      <header className={styles.detailHeader}><button onClick={() => setDetail(null)}>‹</button><strong>球员详情</strong><span>PLAYER</span></header>
      <section className={styles.playerHero}><PlayerAvatar player={player} size="xl" /><div><small>{player.nationalityZh}</small><h1>{player.nameZh}</h1><p>{player.nameEn}</p></div><div className={styles.rankBubble}><small>世界排名</small><b>{player.currentRank ? `#${player.currentRank}` : "—"}</b></div></section>
      <section className={styles.profileFacts}><article><span>出生日期</span><b>{formatBirthday(player.dateOfBirth)}</b></article><article><span>转职业</span><b>{player.turnedPro ?? "—"}</b></article><article><span>排名积分</span><b>{player.rankingPoints?.toLocaleString("en-GB") ?? "—"}</b></article><article><span>资料来源</span><b>{player.profileSource ?? "curated"}</b></article></section>
      {stats ? <section className={styles.card}><SectionHeader eyebrow="TOURNAMENT" title={`${statsEvent.nameZh}表现`} action={stats.bestRoundLabelZh} /><div className={styles.statGrid}><article><small>胜负</small><strong>{stats.wins}-{stats.losses}</strong><span>本届比赛</span></article><article><small>局分</small><strong>{stats.frameWins}-{stats.frameLosses}</strong><span>本届累计</span></article></div><div className={styles.playerMatches}>{stats.matches.map((match) => {
        const opponentId = match.player1Id === player.id ? match.player2Id : match.player1Id;
        const opponent = players.get(opponentId);
        if (!opponent) return null;
        const selfScore = match.player1Id === player.id ? match.score1 : match.score2;
        const oppScore = match.player1Id === player.id ? match.score2 : match.score1;
        return <button key={match.id} onClick={() => openMatch(match.id, statsEvent.slug)}><small>{match.roundLabelZh} · {match.timeLabelZh ?? ""}</small><span>vs {opponent.nameZh}</span><b>{selfScore ?? "-"} : {oppScore ?? "-"}</b></button>;
      })}</div></section> : null}
    </div></main>;
  }

  if (detail?.type === "event") {
    const calendarEvent = snapshot.calendar.find((item) => item.slug === detail.slug) ?? featuredEventCard ?? snapshot.calendar[0];
    const detailEvent = eventDetailsBySlug.get(calendarEvent.slug) ?? (calendarEvent.slug === event.slug ? event : undefined);
    const detailMatches = detailEvent ? allMatches(detailEvent) : [];
    const fullData = Boolean(detailEvent && calendarEvent.dataReady);
    const eventStats = fullData ? {
      matchCount: detailMatches.length,
      playerCount: new Set(detailMatches.flatMap((match) => [match.player1Id, match.player2Id])).size,
      chinaCount: new Set(detailMatches.flatMap((match) => [match.player1Id, match.player2Id]).filter((id) => ["CN", "CHN"].includes(players.get(id)?.countryCode ?? ""))).size,
      completed: detailMatches.filter((match) => match.status === "completed" || match.status === "walkover").length,
    } : null;
    const chinaStats = fullData && detailEvent
      ? snapshot.players.filter((player) => ["CN", "CHN"].includes(player.countryCode)).map((player) => ({ player, stats: currentEventStats(player.id, detailEvent) })).filter((item) => item.stats)
      : [];
    return <main className={styles.appRoot} data-theme={theme}><div className={styles.detailShell}>
      <header className={`${styles.detailHeader} ${priority.eventNameHeader}`}><button onClick={() => setDetail(null)}>‹</button><strong>{calendarEvent.nameZh}</strong><span>{calendarEvent.season}</span></header>
      <section className={styles.eventDetailHero}><div className={styles.eventDetailTop}><StatusPill status={calendarEvent.status} label={calendarEvent.statusLabelZh} /><span>{calendarEvent.typeZh}</span></div><h1>{calendarEvent.nameZh}</h1><p>{calendarEvent.nameEn}</p><div className={styles.eventDetailMeta}><span>{formatDateRange(calendarEvent.startDate, calendarEvent.endDate)}</span><span>{calendarEvent.countryZh} · {calendarEvent.cityZh}</span></div></section>
      <div className={styles.eventTabs}><button className={detail.tab === "overview" ? styles.tabActive : ""} onClick={() => setDetail({ ...detail, tab: "overview" })}>赛事介绍</button><button className={detail.tab === "schedule" ? styles.tabActive : ""} onClick={() => setDetail({ ...detail, tab: "schedule" })}>赛程</button><button className={detail.tab === "data" ? styles.tabActive : ""} onClick={() => setDetail({ ...detail, tab: "data" })}>赛事数据</button></div>
      {detail.tab === "overview" ? <section className={styles.card}><SectionHeader title="赛事概览" /><div className={styles.overviewList}><div><span>赛季</span><b>{calendarEvent.season}</b></div><div><span>赛事类型</span><b>{calendarEvent.typeZh}</b></div><div><span>比赛时间</span><b>{formatDateRange(calendarEvent.startDate, calendarEvent.endDate)}</b></div><div><span>举办地</span><b>{calendarEvent.countryZh} · {calendarEvent.cityZh}</b></div>{calendarEvent.venueZh ? <div><span>场馆</span><b>{calendarEvent.venueZh}</b></div> : null}{calendarEvent.winnerZh ? <div><span>冠军</span><b>{calendarEvent.winnerZh}</b></div> : null}{detailEvent?.winnerPrize ? <div><span>冠军奖金</span><b>£{detailEvent.winnerPrize.toLocaleString("en-GB")}</b></div> : null}{detailEvent?.runnerUpPrize ? <div><span>亚军奖金</span><b>£{detailEvent.runnerUpPrize.toLocaleString("en-GB")}</b></div> : null}{detailEvent?.refereeZh ? <div><span>决赛裁判</span><b>{detailEvent.refereeZh}</b></div> : null}</div>{!fullData ? <p className={styles.dataNote}>该站已经进入 2026/27 赛季赛历，完整签表与比赛数据将在数据源接入后展示。</p> : null}</section> : null}
      {detail.tab === "schedule" ? fullData && detailEvent ? <div className={styles.roundStack}>{detailEvent.rounds.map((round) => <section className={styles.card} key={round.key}><SectionHeader title={round.labelZh} action={bestOfLabel(round.bestOf)} /><div className={styles.matchList}>{round.matches.map((match) => <MatchListRow key={match.id} match={match} players={players} onOpen={() => openMatch(match.id, detailEvent.slug)} />)}</div></section>)}</div> : <section className={styles.card}><SectionHeader title="赛程" /><div className={styles.emptyState}>该站详细赛程正在接入。</div></section> : null}
      {detail.tab === "data" ? fullData && eventStats && detailEvent ? <><section className={styles.card}><SectionHeader eyebrow="TOURNAMENT DATA" title="赛事统计" /><div className={styles.statGrid}><article><small>主赛场次</small><strong>{eventStats.matchCount}</strong><span>完整主赛</span></article><article><small>参赛球员</small><strong>{eventStats.playerCount}</strong><span>本站主赛</span></article><article><small>中国球员</small><strong>{eventStats.chinaCount}</strong><span>本站主赛</span></article><article><small>已完成</small><strong>{eventStats.completed}</strong><span>数据库统计</span></article></div></section><section className={styles.card}><SectionHeader eyebrow="CHINA WATCH" title="中国军团本届成绩" /><div className={styles.chinaResultList}>{chinaStats.sort((a, b) => detailEvent.rounds.findIndex((round) => round.key === a.stats!.bestRoundKey) - detailEvent.rounds.findIndex((round) => round.key === b.stats!.bestRoundKey)).map(({ player, stats }) => <button key={player.id} onClick={() => openPlayer(player.id)}><PlayerAvatar player={player} size="sm" /><span><b>{player.nameZh}</b><small>世界第 {player.currentRank ?? "—"}</small></span><strong>{stats!.bestRoundLabelZh}</strong><em>{stats!.wins}胜{stats!.losses}负</em></button>)}</div></section></> : <section className={styles.card}><SectionHeader title="赛事数据" /><div className={styles.emptyState}>该站赛事数据正在接入。</div></section> : null}
    </div></main>;
  }

  return <main className={styles.appRoot} data-theme={theme}><div className={styles.shell}>
    <header className={styles.header}><button className={styles.brand} onClick={() => changeView("home")}><span>S</span><div><strong>世界斯诺克数据中心</strong><small>WORLD SNOOKER DATA</small></div></button><div className={styles.headerRight}><span className={styles.versionBadge}>DATA v0.6</span><div className={styles.themeSwitch}><button className={theme === "green" ? styles.themeActive : ""} onClick={() => setTheme("green")}>绿</button><button className={theme === "red" ? styles.themeActive : ""} onClick={() => setTheme("red")}>红</button></div></div></header>
    <div className={styles.content}>
      {activeView === "home" ? <>
        {featuredEventCard ? <section className={styles.hero}><div className={styles.heroTop}><StatusPill status={featuredEventCard.status} label={featuredLabel} /><span>{featuredEventCard.typeZh}</span></div><small>{featuredEyebrow}</small><h1>{featuredEventCard.nameZh}</h1><p>{formatDateRange(featuredEventCard.startDate, featuredEventCard.endDate)} · {featuredEventCard.countryZh} {featuredEventCard.cityZh}</p><div className={styles.heroActions}><button onClick={() => openEvent(featuredEventCard.slug, featuredEventCard.dataReady ? "schedule" : "overview")}>查看赛事</button><button className={styles.secondaryButton} onClick={() => changeView("matches")}>赛事列表</button></div></section> : null}

        {scoreEvent && scoreMatch ? <section className={styles.card}>
          <div className={styles.liveHeader}><div><small>{scoreMatch.roundLabelZh} · {scoreMatch.timeLabelZh ?? ""}</small><h2>{scoreEvent.nameZh.replace(/^2026斯诺克/, "")} · {scoreMatch.roundLabelZh}</h2></div><StatusPill status={scoreMatch.status} label={scoreMatch.status === "session-break" ? "进行中" : scoreMatch.statusLabelZh} /></div>
          <div className={styles.homeScore}>
            <button onClick={() => openPlayer(scoreMatch.player1Id)}><PlayerAvatar player={players.get(scoreMatch.player1Id)!} size="lg" /><span className={scoreMatch.winnerId === scoreMatch.player1Id ? styles.winnerName : ""}>{players.get(scoreMatch.player1Id)!.shortNameZh}{scoreMatch.winnerId === scoreMatch.player1Id ? <em>胜</em> : null}</span></button>
            <div><strong>{scoreMatch.score1 ?? "-"} <i>:</i> {scoreMatch.score2 ?? "-"}</strong><small>{bestOfLabel(scoreMatch.bestOf)}</small></div>
            <button onClick={() => openPlayer(scoreMatch.player2Id)}><PlayerAvatar player={players.get(scoreMatch.player2Id)!} size="lg" /><span className={scoreMatch.winnerId === scoreMatch.player2Id ? styles.winnerName : ""}>{scoreMatch.winnerId === scoreMatch.player2Id ? <em>胜</em> : null}{players.get(scoreMatch.player2Id)!.shortNameZh}</span></button>
          </div>
          <button className={styles.fullButton} onClick={() => openMatch(scoreMatch.id, scoreEvent.slug)}>查看完整比分与逐局数据</button>
          <div className={styles.sourceLine}><i className={styles.liveOk} /><b>{scoreMatch.status === "completed" ? "官方结果已入库" : sourceLabel}</b>{scoreMatch.status === "live" || scoreMatch.status === "session-break" ? <small>{refreshing ? "同步中…" : `最近更新 ${updatedTime}`}</small> : null}</div>
        </section> : activeEventCard ? <section className={styles.card}><SectionHeader eyebrow="CURRENT TOURNAMENT" title={`${activeEventCard.nameZh} · 赛程`} action="进行中" /><div className={styles.emptyState}>比赛已经进入赛程期，本站对阵与比分正在同步到独立数据库。</div><button className={styles.fullButton} onClick={() => openEvent(activeEventCard.slug, "schedule")}>查看本站赛程</button></section> : null}

        {nextEventCard ? <section className={styles.card}><SectionHeader eyebrow="NEXT EVENT" title="下一站" action={nextEventCard.statusLabelZh} /><button className={styles.nextEvent} onClick={() => openEvent(nextEventCard.slug)}><span>{nextEventCard.cityZh.slice(0, 1)}</span><div><strong>{nextEventCard.nameZh}</strong><small>{nextEventCard.nameEn}</small><p>{formatDateRange(nextEventCard.startDate, nextEventCard.endDate)} · {nextEventCard.cityZh}</p></div><em>›</em></button></section> : null}

        <section className={styles.card}><SectionHeader eyebrow="WORLD RANKING" title="世界排名" action="TOP 16" /><div className={styles.rankingList}>{rankingRows.slice(0, 6).map((row) => <button key={row.rank} onClick={() => openPlayer(row.player.id)}><strong>{row.rank}</strong><PlayerAvatar player={row.player} size="sm" /><span><b>{row.player.nameZh}</b><small>{row.player.nameEn}</small></span><em>{row.points.toLocaleString("en-GB")}</em></button>)}</div><button className={styles.fullButton} onClick={() => changeView("data")}>查看完整世界排名</button></section>
        <section className={styles.card}><SectionHeader eyebrow="CHINA TOP 16" title="中国球员" action={`${chinaTop16.length} 人进入 TOP16`} /><div className={styles.chinaTopGrid}>{chinaTop16.map((row) => <button key={row.player.id} onClick={() => openPlayer(row.player.id)}><span>{row.rank}</span><strong>{row.player.nameZh}</strong><small>世界第 {row.rank}</small></button>)}</div></section>
      </> : null}

      {activeView === "matches" ? <>
        <section className={styles.pageIntro}><small>TOURNAMENTS</small><h1>赛事</h1><p>近期赛事显示本赛季所有已经结束的赛事、正在进行的赛事和即将开始的一站；完整赛历按时间顺序查看。</p></section>
        <div className={priority.eventModeTabs}><button className={eventListMode === "recent" ? priority.eventModeActive : ""} onClick={() => setEventListMode("recent")}>近期赛事</button><button className={eventListMode === "calendar" ? priority.eventModeActive : ""} onClick={() => setEventListMode("calendar")}>赛季赛历</button></div>
        {eventListMode === "recent" ? <>
          {featuredEventCard ? <section className={styles.currentEventBanner} onClick={() => openEvent(featuredEventCard.slug, featuredEventCard.dataReady ? "schedule" : "overview")}><div><StatusPill status={featuredEventCard.status} label={featuredLabel} /><small>{featuredEventCard.typeZh}</small></div><h2>{featuredEventCard.nameZh}</h2><p>{formatDateRange(featuredEventCard.startDate, featuredEventCard.endDate)} · {featuredEventCard.cityZh}</p><span>查看赛事 ›</span></section> : null}
          <section className={styles.card}><SectionHeader title="近期赛事" action={`${recentEvents.length} 站`} /><div className={styles.calendarList}>{recentEvents.map((item) => <CalendarCard key={item.id} item={item} onOpen={() => openEvent(item.slug, item.dataReady ? "schedule" : "overview")} />)}</div></section>
        </> : <section className={styles.card}><SectionHeader eyebrow="2026/27 SEASON" title="赛季赛历" action={`${seasonCalendar.length} 项`} /><div className={priority.calendarStaticList}>{seasonCalendar.map((item) => <CalendarCard key={item.id} item={item} interactive={false} />)}</div></section>}
      </> : null}

      {activeView === "players" ? <><section className={styles.pageIntro}><small>PLAYER DIRECTORY</small><h1>球员</h1><p>球员页只保留目录与搜索。点击任意球员后，再进入独立球员详情查看资料、排名和比赛记录。</p></section><section className={styles.card}><div className={styles.searchBox}><span>⌕</span><input value={playerQuery} onChange={(inputEvent) => setPlayerQuery(inputEvent.target.value)} placeholder="搜索中文名 / 英文名" /></div><div className={styles.playerFilters}>{playerFilters.map((filter) => <button key={filter} className={playerFilter === filter ? styles.filterActive : ""} onClick={() => setPlayerFilter(filter)}>{filter}</button>)}</div><div className={styles.playerDirectory}>{filteredPlayers.map((player) => <button key={player.id} onClick={() => openPlayer(player.id)}><PlayerAvatar player={player} size="md" /><span><strong>{player.nameZh}</strong><small>{player.nameEn} · {player.nationalityZh}</small></span><b>{player.currentRank ? `#${player.currentRank}` : "—"}</b><em>›</em></button>)}</div></section></> : null}

      {activeView === "data" ? <><section className={styles.pageIntro}><small>GLOBAL DATA</small><h1>数据</h1><p>这里仅放跨赛事、跨赛季的数据。单站赛事统计放在各赛事自己的“赛事数据”页。</p></section><section className={styles.card}><SectionHeader eyebrow="WORLD RANKING" title="世界排名 TOP16" /><div className={styles.rankingList}>{rankingRows.map((row) => <button key={row.rank} onClick={() => openPlayer(row.player.id)}><strong>{row.rank}</strong><PlayerAvatar player={row.player} size="sm" /><span><b>{row.player.nameZh}</b><small>{row.player.nameEn} · {row.player.nationalityZh}</small></span><em>{row.points.toLocaleString("en-GB")}</em></button>)}</div></section><section className={styles.card}><SectionHeader eyebrow="COMING NEXT" title="数据专题" /><div className={styles.futureGrid}><article><small>HEAD TO HEAD</small><strong>交手记录</strong><span>正在接入</span></article><article><small>CENTURIES</small><strong>破百榜</strong><span>正在接入</span></article><article><small>DECIDERS</small><strong>决胜局</strong><span>正在接入</span></article><article><small>TITLES</small><strong>冠军榜</strong><span>正在接入</span></article></div></section></> : null}
    </div>
    <nav className={styles.bottomNav}>{navItems.map((item) => <button key={item.id} className={activeView === item.id ? styles.activeNav : ""} onClick={() => changeView(item.id)}><span>{item.icon}</span><b>{item.label}</b></button>)}</nav>
    <span className={styles.buildMark}>{buildMark}</span>
  </div></main>;
}
