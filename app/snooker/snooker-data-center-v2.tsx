"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type {
  PlayerEventStats,
  SnookerCalendarEvent,
  SnookerDashboardSnapshot,
  SnookerEvent,
  SnookerHeadToHeadMeeting,
  SnookerMatch,
  SnookerMatchPlayerStatistics,
  SnookerPlayer,
  SnookerSeasonStatistics,
} from "@/lib/snooker/domain";
import type { SnookerPlayerListItem } from "@/lib/snooker/player-data";
import { PlayerDirectoryContent } from "./players/player-directory";
import styles from "./snooker-data-center.module.css";
import priority from "./snooker-priority.module.css";
import insight from "./snooker-insights.module.css";
import polish from "./snooker-ui-polish.module.css";

type MainView = "home" | "matches" | "players" | "data";
type NavId = MainView;
type Theme = "green" | "red";
type EventTab = "overview" | "schedule" | "data";
type EventListMode = "recent" | "calendar";
type MatchDataTab = "match" | "season" | "h2h";
type DetailState =
  | { type: "event"; slug: string; tab: EventTab }
  | { type: "match"; matchId: string; eventSlug: string };

type SourceHealth = {
  online: boolean;
  accepted: boolean;
  fetchedAt: string;
  message: string;
};

type DashboardResponse = {
  ok?: boolean;
  snapshot?: SnookerDashboardSnapshot;
  databaseEvents?: SnookerEvent[];
  sourceHealth?: SourceHealth;
};

const navItems: Array<{ id: NavId; label: string; icon: string }> = [
  { id: "home", label: "首页", icon: "⌂" },
  { id: "matches", label: "赛事", icon: "◫" },
  { id: "players", label: "球员", icon: "◎" },
  { id: "data", label: "数据", icon: "▥" },
];

function initials(name: string) {
  return name.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase();
}

function isChina(player?: SnookerPlayer) {
  return player?.countryCode === "CN" || player?.countryCode === "CHN";
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

function bestOfLabel(bestOf: number) {
  return bestOf > 0 ? `${bestOf}局${Math.floor(bestOf / 2) + 1}胜` : "赛制待定";
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

function eventStatusLabel(item: SnookerCalendarEvent) {
  return item.status === "live" ? "进行中" : item.status === "upcoming" ? "即将开始" : "已结束";
}

function eventStatusClass(status: SnookerCalendarEvent["status"]) {
  return status === "live" ? polish.eventStatusLive : status === "upcoming" ? polish.eventStatusUpcoming : polish.eventStatusCompleted;
}

function localizedRoundLabel(value?: string) {
  const source = String(value ?? "").trim();
  const key = source.toLowerCase();
  if (!source) return "";
  if (/semi[- ]?final/.test(key)) return "半决赛";
  if (/quarter[- ]?final/.test(key)) return "1/4决赛";
  if (key === "final") return "决赛";
  if (/league phase.*stage two/.test(key)) return "第二阶段循环赛";
  if (/league phase/.test(key)) return "循环赛";
  const round = key.match(/^round\s+(\d+)$/);
  if (round) return `第${round[1]}轮`;
  return source;
}

function localizedTournamentLabel(value: string | undefined, calendar: SnookerCalendarEvent[]) {
  const source = String(value ?? "").trim();
  if (!source) return "官方赛事";
  const key = source.toLowerCase();
  const calendarMatch = calendar.find((item) => {
    const english = item.nameEn.toLowerCase();
    return english.length > 5 && (key.includes(english) || english.includes(key));
  });
  if (calendarMatch) return calendarMatch.nameZh;
  const known: Array<[RegExp, string]> = [
    [/saudi arabia snooker masters/i, "沙特阿拉伯斯诺克大师赛"],
    [/shanghai masters/i, "上海大师赛"],
    [/german masters/i, "德国大师赛"],
    [/uk championship/i, "英国锦标赛"],
    [/international championship/i, "国际锦标赛"],
    [/world championship/i, "世界锦标赛"],
    [/world grand prix/i, "世界大奖赛"],
    [/players championship/i, "球员锦标赛"],
    [/tour championship/i, "巡回锦标赛"],
    [/championship league/i, "冠军联赛"],
    [/scottish open/i, "苏格兰公开赛"],
    [/english open/i, "英格兰公开赛"],
    [/british open/i, "英国公开赛"],
    [/northern ireland open/i, "北爱尔兰公开赛"],
    [/welsh open/i, "威尔士公开赛"],
    [/wuhan open/i, "武汉公开赛"],
    [/china open/i, "中国公开赛"],
    [/shoot out/i, "单局限时赛"],
    [/\bmasters\b/i, "大师赛"],
  ];
  return known.find(([pattern]) => pattern.test(source))?.[1] ?? source;
}

function allMatches(event: SnookerEvent) {
  return event.rounds.flatMap((round) => round.matches);
}

function finalOf(event?: SnookerEvent) {
  return event?.rounds.find((round) => round.key === "final")?.matches[0];
}

function playerMap(snapshot: SnookerDashboardSnapshot) {
  return new Map(snapshot.players.map((player) => [player.id, player]));
}

function matchSignature(match: SnookerMatch) {
  return JSON.stringify({
    score1: match.score1,
    score2: match.score2,
    status: match.status,
    frames: match.frames?.map((frame) => [frame.frameNo, frame.score1, frame.score2, frame.break1, frame.break2]) ?? [],
  });
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
    frameWins += Number(isP1 ? match.score1 ?? 0 : match.score2 ?? 0);
    frameLosses += Number(isP1 ? match.score2 ?? 0 : match.score1 ?? 0);
    if (match.winnerId === playerId) wins += 1;
    else if (match.status === "completed" || match.status === "walkover") losses += 1;
  }
  const order = event.rounds.map((round) => round.key);
  const best = [...matches].sort((a, b) => order.indexOf(a.roundKey) - order.indexOf(b.roundKey))[0];
  return {
    playerId,
    eventId: event.id,
    played: wins + losses,
    wins,
    losses,
    frameWins,
    frameLosses,
    bestRoundKey: best.roundKey,
    bestRoundLabelZh: best.roundLabelZh,
    isActive: matches.some((match) => match.status === "live" || match.status === "session-break" || match.status === "upcoming"),
    matches,
  };
}

function money(value: number) {
  return `£${value.toLocaleString("en-GB")}`;
}

function rankingMoney(value: number) {
  return `€${value.toLocaleString("en-GB")}`;
}

function SectionHeader({ eyebrow, title, action, actionClassName }: { eyebrow?: string; title: string; action?: string; actionClassName?: string }) {
  return <div className={styles.sectionHeader}><div>{eyebrow ? <small>{eyebrow}</small> : null}<h2>{title}</h2></div>{action ? <span className={actionClassName}>{action}</span> : null}</div>;
}

function PlayerAvatar({ player, size = "md" }: { player: SnookerPlayer; size?: "sm" | "md" | "lg" | "xl" }) {
  const image = player.avatarUrl || player.avatar?.url;
  return (
    <span className={`${styles.avatar} ${styles[`avatar_${size}`]} ${image ? polish.avatarPhoto : ""}`} aria-label={player.nameZh}>
      {image ? <img src={image} alt="" loading={size === "xl" ? "eager" : "lazy"} decoding="async" /> : initials(player.nameEn)}
    </span>
  );
}

function MatchupPlayer({ player }: { player: SnookerPlayer }) {
  const image = player.avatarUrl || player.avatar?.url;
  const shortNameEn = player.shortNameEn || player.nameEn.split(/\s+/).slice(-1)[0] || player.nameEn;
  return (
    <div className={polish.matchupPlayer}>
      <div className={polish.matchupPortrait} aria-label={player.nameZh}>
        {image ? <img src={image} alt="" loading="lazy" decoding="async" /> : <span className={polish.matchupFallback}>{initials(player.nameEn)}</span>}
      </div>
      <div className={polish.matchupPlayerText}>
        <strong>{player.shortNameZh || player.nameZh}</strong>
        <small>{shortNameEn}</small>
      </div>
    </div>
  );
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
        <span>{match.timeLabelZh ?? match.roundLabelZh}</span>
        <span>{bestOfLabel(match.bestOf)}</span>
        <StatusPill status={match.status} label={match.status === "session-break" ? "进行中" : match.statusLabelZh} />
      </div>
      <div className={priority.matchVersusRow}>
        <div className={polish.matchPlayerCell}>
          <PlayerAvatar player={p1} size="sm" />
          <span>{p1.shortNameZh}{match.winnerId === p1.id ? <em className={polish.matchWin}>胜</em> : null}</span>
        </div>
        <b>{score}</b>
        <div className={`${polish.matchPlayerCell} ${polish.matchPlayerRight}`}>
          <span>{match.winnerId === p2.id ? <em className={polish.matchWin}>胜</em> : null}{p2.shortNameZh}</span>
          <PlayerAvatar player={p2} size="sm" />
        </div>
      </div>
    </button>
  );
}

function CalendarCard({ item, onOpen, interactive = true }: { item: SnookerCalendarEvent; onOpen?: () => void; interactive?: boolean }) {
  const content = <>
    <div className={styles.calendarDate}><b>{new Date(`${item.startDate}T00:00:00+08:00`).getMonth() + 1}/{new Date(`${item.startDate}T00:00:00+08:00`).getDate()}</b><small className={`${polish.eventStatusText} ${eventStatusClass(item.status)}`}>{eventStatusLabel(item)}</small></div>
    <div><span><StatusPill status="type" label={item.typeZh} /></span><strong>{item.nameZh}</strong><small>{item.nameEn}</small><p>{formatDateRange(item.startDate, item.endDate)} · {item.countryZh} {item.cityZh}{item.winnerZh ? ` · 冠军 ${item.winnerZh}` : ""}</p></div>
    {interactive ? <em>›</em> : null}
  </>;
  if (!interactive) return <article className={`${priority.calendarStaticCard} ${item.current ? priority.calendarStaticCurrent : ""}`}>{content}</article>;
  return <button className={item.current ? styles.calendarCurrent : ""} onClick={onOpen}>{content}</button>;
}

function statValue(stat: SnookerMatchPlayerStatistics | undefined, key: keyof SnookerMatchPlayerStatistics, suffix = "") {
  const value = stat?.[key];
  if (typeof value !== "number") return "—";
  const text = Number.isInteger(value) ? String(value) : value.toFixed(1);
  return `${text}${suffix}`;
}

function seasonValue(stat: SnookerSeasonStatistics | undefined, key: keyof SnookerSeasonStatistics, suffix = "") {
  const value = stat?.[key];
  if (typeof value !== "number") return "—";
  const formatted = key === "pointsScored" ? value.toLocaleString("en-GB") : Number.isInteger(value) ? String(value) : value.toFixed(1);
  return `${formatted}${suffix}`;
}

function meetingDate(item: SnookerHeadToHeadMeeting) {
  if (!item.date) return "—";
  const date = item.date.slice(0, 10).split("-");
  return `${Number(date[1])}/${Number(date[2])}/${date[0]}`;
}

export default function SnookerDataCenterV2({
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
  initialView?: MainView;
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
  const [matchDataTab, setMatchDataTab] = useState<MatchDataTab>("match");
  const [matchUpdatedAt, setMatchUpdatedAt] = useState<Record<string, string>>({});
  const signatures = useRef(new Map(initialDatabaseEvents.flatMap((event) => allMatches(event)).map((match) => [match.id, matchSignature(match)])));

  const players = useMemo(() => playerMap(snapshot), [snapshot]);
  const directoryPlayers = useMemo<SnookerPlayerListItem[]>(() => snapshot.players
    .map((player) => ({
      id: player.id,
      slug: player.slug,
      nameEn: player.nameEn,
      nameZh: player.nameZh,
      shortNameZh: player.shortNameZh || null,
      nationalityZh: player.nationalityZh || null,
      countryCode: player.countryCode || null,
      dateOfBirth: player.dateOfBirth ?? null,
      turnedPro: player.turnedPro ?? null,
      currentRank: player.currentRank,
      rankingPoints: player.rankingPoints,
      avatarUrl: player.avatarUrl || player.avatar?.url || null,
      isCurrentTour: player.currentRank !== null,
      tourStatus: player.currentRank !== null ? "current" : "unknown",
    }))
    .sort((a, b) => (a.currentRank ?? 9999) - (b.currentRank ?? 9999) || a.nameEn.localeCompare(b.nameEn)), [snapshot.players]);
  const eventBySlug = useMemo(() => new Map(databaseEvents.map((event) => [event.slug, event])), [databaseEvents]);
  const hasLiveMatch = useMemo(() => databaseEvents.some((event) => allMatches(event).some((match) => match.status === "live" || match.status === "session-break")), [databaseEvents]);

  const refresh = useCallback(async () => {
    if (typeof document !== "undefined" && document.hidden) return;
    setRefreshing(true);
    try {
      const response = await fetch(`/api/snooker/v1/dashboard?ts=${Date.now()}`, { cache: "no-store", headers: { "cache-control": "no-cache" } });
      const data = await response.json() as DashboardResponse;
      if (response.ok && data.ok && data.snapshot) {
        setSnapshot(data.snapshot);
        if (data.databaseEvents) {
          const changedAt = data.sourceHealth?.fetchedAt ?? new Date().toISOString();
          const next = new Map(data.databaseEvents.flatMap((event) => allMatches(event)).map((match) => [match.id, matchSignature(match)]));
          const changed: string[] = [];
          for (const [id, signature] of next) if (signatures.current.get(id) !== signature) changed.push(id);
          signatures.current = next;
          if (changed.length) setMatchUpdatedAt((current) => ({ ...current, ...Object.fromEntries(changed.map((id) => [id, changedAt])) }));
          setDatabaseEvents(data.databaseEvents);
        }
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

  const today = chinaToday();
  const seasonCalendar = useMemo(() => [...snapshot.calendar].filter((item) => item.season === "2026/27").sort((a, b) => a.startDate.localeCompare(b.startDate)), [snapshot.calendar]);
  const mainSeasonEvents = useMemo(() => seasonCalendar.filter((item) => item.typeZh !== "资格赛"), [seasonCalendar]);
  const activeEventCard = mainSeasonEvents.find((item) => isActiveOn(item, today));
  const graceEventCard = [...mainSeasonEvents].reverse().find((item) => item.endDate < today && addDateDays(item.endDate, 1) === today);
  const firstUpcomingMain = mainSeasonEvents.find((item) => item.startDate > today);
  const featuredEventCard = activeEventCard ?? graceEventCard ?? firstUpcomingMain ?? [...mainSeasonEvents].reverse()[0];
  const nextEventCard = featuredEventCard ? mainSeasonEvents.find((item) => item.startDate > featuredEventCard.startDate) : firstUpcomingMain;
  const firstUpcomingAny = seasonCalendar.find((item) => item.startDate > today);
  const recentEvents = seasonCalendar
    .filter((item) => item.endDate < today || isActiveOn(item, today) || item.id === firstUpcomingAny?.id || item.id === featuredEventCard?.id)
    .sort((a, b) => b.startDate.localeCompare(a.startDate));

  const rankingRows = useMemo(() => snapshot.rankings
    .map((row) => ({ ...row, player: players.get(row.playerId) }))
    .filter((row): row is typeof row & { player: SnookerPlayer } => Boolean(row.player))
    .sort((a, b) => a.rank - b.rank), [snapshot.rankings, players]);
  const chinaTop16 = rankingRows.filter((row) => isChina(row.player));

  const openEvent = (slug: string, tab: EventTab = "overview") => {
    setDetail({ type: "event", slug, tab });
    window.scrollTo({ top: 0, behavior: "auto" });
  };
  const openMatch = (matchId: string, eventSlug: string) => {
    setMatchDataTab("match");
    setDetail({ type: "match", matchId, eventSlug });
    window.scrollTo({ top: 0, behavior: "auto" });
  };
  const openPlayer = (playerId: string) => {
    const target = players.get(playerId);
    const href = target?.slug ? `/snooker/players/${target.slug}` : "/snooker?view=players";
    router.prefetch(href);
    router.push(href);
  };
  const changeView = (view: NavId) => {
    setDetail(null);
    setActiveView(view);
    window.scrollTo({ top: 0, behavior: "auto" });
  };

  if (detail?.type === "match") {
    const selectedEvent = eventBySlug.get(detail.eventSlug) ?? snapshot.event;
    const match = allMatches(selectedEvent).find((item) => item.id === detail.matchId) ?? finalOf(selectedEvent);
    if (!match) return null;
    const p1 = players.get(match.player1Id);
    const p2 = players.get(match.player2Id);
    if (!p1 || !p2) return null;
    const s1 = match.statistics?.find((stat) => stat.playerId === p1.id);
    const s2 = match.statistics?.find((stat) => stat.playerId === p2.id);
    const season1 = p1.seasonStatistics;
    const season2 = p2.seasonStatistics;
    const hasStats = Boolean(s1 || s2);
    const hasSeason = Boolean(season1 || season2);
    const h2h = match.headToHead;
    const hasH2h = Boolean(h2h);
    const selectedDataTab: MatchDataTab = matchDataTab === "match" && !hasStats
      ? hasSeason ? "season" : hasH2h ? "h2h" : "match"
      : matchDataTab === "season" && !hasSeason
        ? hasStats ? "match" : "h2h"
        : matchDataTab === "h2h" && !hasH2h
          ? hasStats ? "match" : "season"
          : matchDataTab;
    const statusLabel = match.status === "completed" || match.status === "walkover" ? "已结束" : match.status === "upcoming" ? "待开始" : "进行中";
    const realtime = match.status === "live" || match.status === "session-break";
    const updated = new Date(matchUpdatedAt[match.id] ?? selectedEvent.snapshotAt).toLocaleTimeString("zh-CN", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      timeZone: "Asia/Shanghai",
    });
    const localized = (name?: string) => snapshot.players.find((player) => player.nameEn.toLowerCase() === String(name ?? "").toLowerCase())?.nameZh ?? name ?? "";
    const statRows: Array<[string, keyof SnookerMatchPlayerStatistics, string]> = [
      ["总得分", "totalPoints", ""],
      ["平均出杆", "averageShotTimeSeconds", "秒"],
      ["进球成功率", "potRate", "%"],
      ["50+", "breaks50Plus", ""],
      ["破百", "breaks100Plus", ""],
      ["最高单杆", "highestBreak", ""],
      ["出杆数", "shotsTaken", ""],
      ["上台时间", "timeOnTablePct", "%"],
    ];
    const seasonRows: Array<[string, keyof SnookerSeasonStatistics, string]> = [
      ["世界排名", "ranking", ""],
      ["赛事冠军", "tournamentsWon", ""],
      ["比赛场次", "matchesPlayed", ""],
      ["获胜场次", "matchesWon", ""],
      ["比赛胜率", "matchWinRate", "%"],
      ["总得分", "pointsScored", ""],
      ["平均出杆", "averageShotTimeSeconds", "秒"],
      ["50+", "breaks50Plus", ""],
      ["破百", "breaks100Plus", ""],
      ["最高单杆", "highestBreak", ""],
      ["147", "season147s", ""],
      ["平均单杆", "averageBreak", ""],
    ];

    return <main className={styles.appRoot} data-theme={theme}><div className={styles.detailShell}>
      <header className={styles.detailHeader}><button onClick={() => setDetail({ type: "event", slug: selectedEvent.slug, tab: "schedule" })}>‹</button><strong>比赛详情</strong><span>MATCH</span></header>
      <section className={styles.matchHero}>
        <div className={styles.matchHeroMeta}><span>{match.roundLabelZh} · {match.timeLabelZh ?? "比赛时间待同步"}</span><b>{bestOfLabel(match.bestOf)}</b></div>
        <h1>{selectedEvent.nameZh}</h1>
        <div className={styles.versusGrid}>
          <div className={styles.versusPlayer}><div className={styles.avatarWrap}><PlayerAvatar player={p1} size="xl" />{match.winnerId === p1.id ? <em>胜</em> : null}</div><strong>{p1.nameZh}</strong><small>{p1.nameEn}</small></div>
          <div className={styles.bigScore}><strong>{match.status === "walkover" ? "W - O" : `${match.score1 ?? "-"} - ${match.score2 ?? "-"}`}</strong><StatusPill status={match.status} label={statusLabel} /><small>{bestOfLabel(match.bestOf)}</small>{realtime ? <small>{refreshing ? "正在同步…" : `最近更新 ${updated}`}</small> : null}</div>
          <div className={styles.versusPlayer}><div className={styles.avatarWrap}><PlayerAvatar player={p2} size="xl" />{match.winnerId === p2.id ? <em>胜</em> : null}</div><strong>{p2.nameZh}</strong><small>{p2.nameEn}</small></div>
        </div>
      </section>

      <section className={styles.frameSection}>
        <div className={styles.frameHead}><span>单杆<br />(50+)</span><span>分数</span><b>局</b><span>分数</span><span>单杆<br />(50+)</span></div>
        {match.frames?.length ? match.frames.map((frame) => <div className={styles.frameRow} style={{ minHeight: 50 }} key={frame.frameNo}><span>{frame.break1 ?? "-"}</span><strong>{frame.score1}</strong><b>{frame.frameNo}</b><strong>{frame.score2}</strong><span>{frame.break2 ?? "-"}</span></div>) : <div className={styles.emptyFrames}>{match.status === "upcoming" ? "比赛尚未开始，逐局比分将在开赛后同步。" : "官方当前未提供该场逐局明细，已保存官方总比分。"}</div>}
      </section>

      {(hasStats || hasSeason || hasH2h) ? <section className={polish.matchupCard}>
        <div className={polish.matchupHeader}><small>MATCHUP DATA</small><h2>对阵数据</h2></div>
        <div className={polish.matchupPlayers}>
          <MatchupPlayer player={p1} />
          <div className={polish.matchupVs}>VS</div>
          <MatchupPlayer player={p2} />
        </div>
        <div className={polish.dataTabs} aria-label="对阵数据切换">
          <button disabled={!hasStats} className={selectedDataTab === "match" ? polish.dataTabActive : ""} onClick={() => setMatchDataTab("match")}><span>本场</span><small>MATCH</small></button>
          <button disabled={!hasSeason} className={selectedDataTab === "season" ? polish.dataTabActive : ""} onClick={() => setMatchDataTab("season")}><span>赛季</span><small>SEASON</small></button>
          <button disabled={!hasH2h} className={selectedDataTab === "h2h" ? polish.dataTabActive : ""} onClick={() => setMatchDataTab("h2h")}><span>交手</span><small>H2H</small></button>
        </div>

        {selectedDataTab === "match" && hasStats ? <div className={polish.dataPanel}>
          <div className={polish.panelMeta}><span>本场比赛统计</span><b>{match.roundLabelZh}</b></div>
          <div className={polish.compareGrid}>{statRows.map(([label, key, suffix]) => <div key={label} style={{ display: "contents" }}><div className={polish.compareLeft}>{statValue(s1, key, suffix)}</div><div className={polish.compareLabel}>{label}</div><div className={polish.compareRight}>{statValue(s2, key, suffix)}</div></div>)}</div>
          <p className={polish.dataHint}>数据来自官方比赛中心，完赛后冻结保存到本站数据库。</p>
        </div> : null}

        {selectedDataTab === "season" && hasSeason ? <div className={polish.dataPanel}>
          <div className={polish.panelMeta}><span>赛季数据对比</span><b>{season1?.seasonLabel ?? season2?.seasonLabel ?? "2026/27"}</b></div>
          <div className={polish.compareGrid}>{seasonRows.map(([label, key, suffix]) => <div key={label} style={{ display: "contents" }}><div className={polish.compareLeft}>{seasonValue(season1, key, suffix)}</div><div className={polish.compareLabel}>{label}</div><div className={polish.compareRight}>{seasonValue(season2, key, suffix)}</div></div>)}</div>
          <p className={polish.dataHint}>赛季数据来自官方赛季统计，当前赛季会随比赛结果持续更新。</p>
        </div> : null}

        {selectedDataTab === "h2h" && h2h ? <div className={`${polish.dataPanel} ${polish.h2hPanel}`}>
          <div className={polish.h2hPanelHeader}><span>历史对阵</span><b>赛前 {h2h.meetings} 次</b></div>
          <div className={insight.h2hSummary}><div className={insight.h2hSide}><strong>{h2h.player1Wins}</strong><span>{p1.nameZh} 胜</span></div><div className={insight.h2hMiddle}><strong>{h2h.player1Frames} : {h2h.player2Frames}</strong><small>历史局分</small></div><div className={insight.h2hSide}><strong>{h2h.player2Wins}</strong><span>{p2.nameZh} 胜</span></div></div>
          {h2h.recentMeetings.length ? <div className={insight.h2hHistory}>{h2h.recentMeetings.map((item, index) => <div className={insight.h2hMeeting} key={`${item.date}-${index}`}><time>{meetingDate(item)}</time><div><small>{localizedTournamentLabel(item.tournament, snapshot.calendar)}{item.round ? ` · ${localizedRoundLabel(item.round)}` : ""}</small><strong>{localized(item.homePlayerName)} {item.homeScore ?? "-"} : {item.awayScore ?? "-"} {localized(item.awayPlayerName)}</strong></div></div>)}</div> : <div className={insight.noHistory}>此前没有官方可识别的正式交手记录。</div>}
        </div> : null}
      </section> : null}

      {realtime ? <div className={styles.liveFooter}><i className={sourceHealth?.accepted ? styles.liveOk : styles.liveWait} /><span>本站数据库实时快照</span><small>30秒自动同步</small></div> : null}
    </div></main>;
  }

  if (detail?.type === "event") {
    const calendarEvent = snapshot.calendar.find((item) => item.slug === detail.slug) ?? featuredEventCard;
    const full = eventBySlug.get(detail.slug);
    if (!calendarEvent) return null;
    const eventMatches = full ? allMatches(full) : [];
    const final = full ? finalOf(full) : undefined;
    const champion = final?.winnerId ? players.get(final.winnerId) : undefined;
    const eventStats = full ? {
      matches: eventMatches.length,
      players: new Set(eventMatches.flatMap((match) => [match.player1Id, match.player2Id])).size,
      china: new Set(eventMatches.flatMap((match) => [match.player1Id, match.player2Id]).filter((id) => isChina(players.get(id)))).size,
      completed: eventMatches.filter((match) => match.status === "completed" || match.status === "walkover").length,
    } : null;
    const chinaStats = full ? snapshot.players.filter(isChina).map((player) => ({ player, stats: currentEventStats(player.id, full) })).filter((item) => item.stats) : [];
    const totalPrize = full?.prizes?.find((row) => row.isTotal);

    return <main className={styles.appRoot} data-theme={theme}><div className={styles.detailShell}>
      <header className={`${styles.detailHeader} ${priority.eventNameHeader}`}><button onClick={() => setDetail(null)}>‹</button><strong>{calendarEvent.nameZh}</strong><span>{calendarEvent.season}</span></header>
      <section className={styles.eventDetailHero}><div className={styles.eventDetailTop}><StatusPill status={calendarEvent.status} label={calendarEvent.statusLabelZh} /><span>{calendarEvent.typeZh}</span></div><h1>{calendarEvent.nameZh}</h1><p>{calendarEvent.nameEn}</p><div className={styles.eventDetailMeta}><span>{formatDateRange(calendarEvent.startDate, calendarEvent.endDate)}</span><span>{calendarEvent.countryZh} · {calendarEvent.cityZh}</span></div></section>
      <div className={styles.eventTabs}><button className={detail.tab === "overview" ? styles.tabActive : ""} onClick={() => setDetail({ ...detail, tab: "overview" })}>赛事介绍</button><button className={detail.tab === "schedule" ? styles.tabActive : ""} onClick={() => setDetail({ ...detail, tab: "schedule" })}>赛程</button><button className={detail.tab === "data" ? styles.tabActive : ""} onClick={() => setDetail({ ...detail, tab: "data" })}>赛事数据</button></div>

      {detail.tab === "overview" ? <>
        {full?.status === "completed" && champion ? <section className={polish.championCard}><div className={polish.championAvatar}><PlayerAvatar player={champion} size="md" /><span>冠</span></div><div className={polish.championText}><small>CHAMPION · 本届冠军</small><strong>{champion.nameZh}</strong><span>{champion.nameEn}</span></div>{final ? <div className={polish.championScore}><small>FINAL</small><b>{final.score1}:{final.score2}</b></div> : null}</section> : null}
        <section className={styles.card}><SectionHeader eyebrow="TOURNAMENT OVERVIEW" title="赛事概览" /><div className={insight.eventOverviewGrid}><article><span>赛季</span><b>{calendarEvent.season}</b></article><article><span>赛事类型</span><b>{calendarEvent.typeZh}</b></article><article><span>比赛时间</span><b>{formatDateRange(calendarEvent.startDate, calendarEvent.endDate)}</b></article><article><span>举办地</span><b>{calendarEvent.countryZh} · {calendarEvent.cityZh}</b></article>{full?.previousChampionZh ? <article><span>上届冠军{full.previousChampionYear ? ` · ${full.previousChampionYear}` : ""}</span><b>{full.previousChampionZh}</b></article> : null}{calendarEvent.venueZh ? <article><span>场馆</span><b>{calendarEvent.venueZh}</b></article> : null}</div></section>
        {full?.prizes?.length ? <section className={styles.card}><SectionHeader eyebrow="PRIZE MONEY" title="奖金分配" action={totalPrize ? `总奖金 ${money(totalPrize.amount)}` : undefined} /><div className={polish.prizeTable}>{[...full.prizes].sort((a, b) => a.sortOrder - b.sortOrder).map((row) => <div className={`${polish.prizeRow} ${row.isTotal ? polish.prizeTotal : ""}`} key={row.key}><span>{row.labelZh}</span><b>{money(row.amount)}</b></div>)}</div></section> : null}
      </> : null}

      {detail.tab === "schedule" ? full ? <div className={styles.roundStack}>
        {full.schedulePartial ? <div className={insight.partialNotice}><b>部分赛程</b><span className={polish.partialText}>官方当前已公布 {full.publishedMatchCount ?? eventMatches.length} 场场地赛程，后续签表将随官方发布自动补齐。</span></div> : null}
        {full.rounds.map((round) => <section className={styles.card} key={round.key}><SectionHeader title={round.labelZh} action={bestOfLabel(round.bestOf)} /><div className={styles.matchList}>{round.matches.map((match) => <MatchListRow key={match.id} match={match} players={players} onOpen={() => openMatch(match.id, full.slug)} />)}</div></section>)}
      </div> : <section className={styles.card}><div className={styles.emptyState}>该站详细赛程尚未入库。</div></section> : null}

      {detail.tab === "data" ? full && eventStats ? <>
        <section className={styles.card}><SectionHeader eyebrow="TOURNAMENT DATA" title="赛事统计" /><div className={styles.statGrid}><article><small>已公布场次</small><strong>{eventStats.matches}</strong><span>{full.schedulePartial ? "部分赛程" : "完整赛程"}</span></article><article><small>参赛球员</small><strong>{eventStats.players}</strong><span>当前签表</span></article><article><small>中国球员</small><strong>{eventStats.china}</strong><span>当前签表</span></article><article><small>已完成</small><strong>{eventStats.completed}</strong><span>数据库统计</span></article></div></section>
        <section className={styles.card}><SectionHeader eyebrow="CHINA WATCH" title="中国军团本届成绩" /><div className={styles.chinaResultList}>{chinaStats.map(({ player, stats }) => <button key={player.id} onClick={() => openPlayer(player.id)}><PlayerAvatar player={player} size="sm" /><span><b>{player.nameZh}</b><small>世界第 {player.currentRank ?? "—"}</small></span><strong>{stats!.bestRoundLabelZh}</strong><em>{stats!.wins}胜{stats!.losses}负</em></button>)}</div></section>
      </> : <section className={styles.card}><div className={styles.emptyState}>赛事数据将在签表与比赛数据入库后显示。</div></section> : null}
    </div></main>;
  }

  const featuredDetail = featuredEventCard ? eventBySlug.get(featuredEventCard.slug) : undefined;
  const latestCompleted = [...databaseEvents].filter((event) => event.status === "completed" && event.endDate <= today).sort((a, b) => b.endDate.localeCompare(a.endDate))[0];
  const currentOrLatest = activeEventCard ? eventBySlug.get(activeEventCard.slug) : latestCompleted;
  const headlineMatch = activeEventCard ? allMatches(currentOrLatest ?? snapshot.event).find((match) => match.status === "live" || match.status === "session-break") ?? finalOf(currentOrLatest) : finalOf(latestCompleted);
  const headlineEvent = activeEventCard ? currentOrLatest : latestCompleted;

  return <main className={styles.appRoot} data-theme={theme}><div className={styles.shell}>
    <header className={styles.header}><button className={styles.brand} onClick={() => changeView("home")}><span>S</span><div><strong>世界斯诺克数据中心</strong><small>WORLD SNOOKER DATA</small></div></button><div className={styles.headerRight}><span className={styles.versionBadge}>DATA v0.9</span><div className={styles.themeSwitch}><button className={theme === "green" ? styles.themeActive : ""} onClick={() => setTheme("green")}>绿</button><button className={theme === "red" ? styles.themeActive : ""} onClick={() => setTheme("red")}>红</button></div></div></header>
    <div className={styles.content}>
      {activeView === "home" ? <>
        {featuredEventCard ? <section className={styles.hero}><div className={styles.heroTop}><span className={eventStatusClass(featuredEventCard.status)}><StatusPill status={featuredEventCard.status} label={activeEventCard ? "当前赛事" : graceEventCard ? "刚刚结束" : "下一站"} /></span><span>{featuredEventCard.typeZh}</span></div><small>{activeEventCard ? "CURRENT TOURNAMENT" : graceEventCard ? "JUST FINISHED" : "NEXT TOURNAMENT"}</small><h1>{featuredEventCard.nameZh}</h1><p>{formatDateRange(featuredEventCard.startDate, featuredEventCard.endDate)} · {featuredEventCard.countryZh} {featuredEventCard.cityZh}</p><div className={styles.heroActions}><button onClick={() => openEvent(featuredEventCard.slug, featuredDetail?.rounds.length ? "schedule" : "overview")}>查看赛事</button><button className={styles.secondaryButton} onClick={() => changeView("matches")}>赛事列表</button></div></section> : null}

        {headlineMatch && headlineEvent && players.get(headlineMatch.player1Id) && players.get(headlineMatch.player2Id) ? <section className={styles.card}>
          <div className={styles.liveHeader}><div><small>{headlineMatch.roundLabelZh} · {headlineMatch.timeLabelZh ?? ""}</small><h2>{headlineEvent.nameZh} · {headlineMatch.roundLabelZh}</h2></div><StatusPill status={headlineMatch.status} label={headlineMatch.status === "completed" ? "已结束" : "进行中"} /></div>
          <div className={styles.homeScore}>
            <button onClick={() => openPlayer(headlineMatch.player1Id)}><div className={polish.homeAvatarWrap}><PlayerAvatar player={players.get(headlineMatch.player1Id)!} size="lg" />{headlineMatch.winnerId === headlineMatch.player1Id ? <em className={polish.winBadge}>胜</em> : null}</div><span className={polish.homePlayerName}>{players.get(headlineMatch.player1Id)!.shortNameZh}</span></button>
            <div><strong>{headlineMatch.score1 ?? "-"} <i>:</i> {headlineMatch.score2 ?? "-"}</strong><small>{bestOfLabel(headlineMatch.bestOf)}</small></div>
            <button onClick={() => openPlayer(headlineMatch.player2Id)}><div className={polish.homeAvatarWrap}><PlayerAvatar player={players.get(headlineMatch.player2Id)!} size="lg" />{headlineMatch.winnerId === headlineMatch.player2Id ? <em className={polish.winBadge}>胜</em> : null}</div><span className={polish.homePlayerName}>{players.get(headlineMatch.player2Id)!.shortNameZh}</span></button>
          </div>
          <button className={styles.fullButton} onClick={() => openMatch(headlineMatch.id, headlineEvent.slug)}>查看比赛详情</button>
          <div className={styles.sourceLine}><i className={sourceHealth?.accepted ? styles.liveOk : styles.liveWait} /><b>官方比赛数据</b><small>{headlineMatch.status === "completed" ? "已冻结保存" : "30秒同步"}</small></div>
        </section> : null}

        {nextEventCard ? <section className={styles.card}><SectionHeader eyebrow="NEXT EVENT" title="下一站" action={eventStatusLabel(nextEventCard)} actionClassName={`${polish.eventStatusText} ${eventStatusClass(nextEventCard.status)}`} /><button className={styles.nextEvent} onClick={() => openEvent(nextEventCard.slug)}><span>{nextEventCard.cityZh?.slice(0, 1) || "赛"}</span><div><strong>{nextEventCard.nameZh}</strong><small>{nextEventCard.nameEn}</small><p>{formatDateRange(nextEventCard.startDate, nextEventCard.endDate)} · {nextEventCard.cityZh}</p></div><em>›</em></button></section> : null}
        <section className={styles.card}><SectionHeader eyebrow="Official World Ranking" title="世界排名" action="TOP 3" /><div className={styles.rankingList}>{rankingRows.slice(0, 3).map((row) => <div className={polish.rankingStaticRow} key={row.rank}><strong>{row.rank}</strong><button className={polish.rankingAvatarButton} onClick={() => openPlayer(row.player.id)} aria-label={`查看${row.player.nameZh}球员详情`}><PlayerAvatar player={row.player} size="sm" /></button><span><b>{row.player.nameZh}</b><small>{row.player.nameEn}</small></span><em>{rankingMoney(row.points)}</em></div>)}</div><button className={styles.fullButton} onClick={() => changeView("data")}>查看完整世界排名</button></section>
        <section className={styles.card}><SectionHeader eyebrow="Official World Ranking" title="中国球员" action={`${chinaTop16.length} 人进入 TOP16`} /><div className={styles.chinaTopGrid}>{chinaTop16.map((row) => <button key={row.player.id} onClick={() => openPlayer(row.player.id)}><span>{row.rank}</span><strong>{row.player.nameZh}</strong><small>世界第 {row.rank}</small></button>)}</div></section>
      </> : null}

      {activeView === "matches" ? <>
        <section className={styles.pageIntro}><small>TOURNAMENTS</small><h1>赛事</h1><p>近期赛事展示本赛季已完成赛事、当前赛事和即将开始的一站；赛季赛历展示完整 2026/27 赛程。</p></section>
        <div className={priority.eventModeTabs}><button className={eventListMode === "recent" ? priority.eventModeActive : ""} onClick={() => setEventListMode("recent")}>近期赛事</button><button className={eventListMode === "calendar" ? priority.eventModeActive : ""} onClick={() => setEventListMode("calendar")}>赛季赛历</button></div>
        {eventListMode === "recent" ? <>{featuredEventCard ? <section className={styles.currentEventBanner} onClick={() => openEvent(featuredEventCard.slug, featuredDetail?.rounds.length ? "schedule" : "overview")}><div><span className={eventStatusClass(featuredEventCard.status)}><StatusPill status={featuredEventCard.status} label={activeEventCard ? "当前赛事" : graceEventCard ? "刚刚结束" : "下一站"} /></span><small>{featuredEventCard.typeZh}</small></div><h2>{featuredEventCard.nameZh}</h2><p>{formatDateRange(featuredEventCard.startDate, featuredEventCard.endDate)} · {featuredEventCard.cityZh}</p><span>查看赛事 ›</span></section> : null}<section className={styles.card}><SectionHeader eyebrow="RECENT TOURNAMENTS" title="近期赛事" action="本赛季" /><div className={styles.calendarList}>{recentEvents.map((item) => <CalendarCard key={item.id} item={item} onOpen={() => openEvent(item.slug)} />)}</div></section></> : <section className={styles.card}><SectionHeader eyebrow="2026/27 SEASON" title="赛季赛历" action="按时间顺序" /><div className={priority.calendarStaticList}>{seasonCalendar.map((item) => <CalendarCard key={item.id} item={item} interactive={false} />)}</div></section>}
      </> : null}

      {activeView === "players" ? <PlayerDirectoryContent players={directoryPlayers} /> : null}

      {activeView === "data" ? <>
        <section className={styles.pageIntro}><small>GLOBAL DATA</small><h1>数据</h1><p>跨赛事、跨赛季数据；单站数据仍放在各赛事自己的“赛事数据”页。</p></section>
        <section className={styles.card}><SectionHeader eyebrow="Official World Ranking" title="世界排名 TOP16" /><div className={styles.rankingList}>{rankingRows.map((row) => <div className={polish.rankingStaticRow} key={row.rank}><strong>{row.rank}</strong><button className={polish.rankingAvatarButton} onClick={() => openPlayer(row.player.id)} aria-label={`查看${row.player.nameZh}球员详情`}><PlayerAvatar player={row.player} size="sm" /></button><span><b>{row.player.nameZh}</b><small>{row.player.nameEn} · {row.player.nationalityZh}</small></span><em>{rankingMoney(row.points)}</em></div>)}</div></section>
        <section className={styles.card}><SectionHeader eyebrow="COMING NEXT" title="数据专题" /><div className={styles.futureGrid}><article><small>HEAD TO HEAD</small><strong>交手记录</strong><span>已进入比赛详情</span></article><article><small>CENTURIES</small><strong>破百榜</strong><span>正在接入</span></article><article><small>DECIDERS</small><strong>决胜局</strong><span>正在接入</span></article><article><small>TITLES</small><strong>冠军榜</strong><span>正在接入</span></article></div></section>
      </> : null}
    </div>
    <nav className={`${styles.bottomNav} ${polish.fastNav}`}>{navItems.map((item) => <button key={item.id} className={item.id === activeView ? styles.activeNav : ""} onClick={() => changeView(item.id)}><span>{item.icon}</span><b>{item.label}</b></button>)}</nav>
    <span className={styles.buildMark}>{buildMark}</span>
  </div></main>;
}
