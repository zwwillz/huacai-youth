"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  PlayerEventStats,
  SnookerCalendarEvent,
  SnookerDashboardSnapshot,
  SnookerEvent,
  SnookerHeadToHeadMeeting,
  SnookerMatch,
  SnookerMatchPlayerStatistics,
  SnookerPlayer,
} from "@/lib/snooker/domain";
import styles from "./snooker-data-center.module.css";
import priority from "./snooker-priority.module.css";
import insight from "./snooker-insights.module.css";

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
  fetchedAt: string;
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
function isChina(player?: SnookerPlayer) {
  return player?.countryCode === "CN" || player?.countryCode === "CHN";
}
function formatDateRange(start: string, end: string) {
  const s = new Date(`${start}T00:00:00+08:00`);
  const e = new Date(`${end}T00:00:00+08:00`);
  const sm = s.getMonth() + 1, sd = s.getDate(), em = e.getMonth() + 1, ed = e.getDate();
  return sm === em ? `${sm}月${sd}日—${ed}日` : `${sm}月${sd}日—${em}月${ed}日`;
}
function formatBirthday(value?: string) {
  if (!value) return "—";
  const d = new Date(`${value}T00:00:00Z`);
  return `${d.getUTCFullYear()}年${d.getUTCMonth() + 1}月${d.getUTCDate()}日`;
}
function bestOfLabel(bestOf: number) {
  return bestOf > 0 ? `${bestOf}局${Math.floor(bestOf / 2) + 1}胜` : "赛制待定";
}
function chinaToday() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}
function addDateDays(value: string, days: number) {
  const [year, month, day] = value.split("-").map(Number);
  const d = new Date(Date.UTC(year, month - 1, day));
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
function isActiveOn(item: SnookerCalendarEvent, today: string) {
  return item.startDate <= today && item.endDate >= today;
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
  return JSON.stringify({ score1: match.score1, score2: match.score2, status: match.status, frames: match.frames?.map((f) => [f.frameNo, f.score1, f.score2, f.break1, f.break2]) ?? [] });
}
function currentEventStats(playerId: string, event: SnookerEvent): PlayerEventStats | null {
  const matches = allMatches(event).filter((match) => match.player1Id === playerId || match.player2Id === playerId);
  if (!matches.length) return null;
  let wins = 0, losses = 0, frameWins = 0, frameLosses = 0;
  for (const match of matches) {
    const p1 = match.player1Id === playerId;
    frameWins += Number(p1 ? match.score1 ?? 0 : match.score2 ?? 0);
    frameLosses += Number(p1 ? match.score2 ?? 0 : match.score1 ?? 0);
    if (match.winnerId === playerId) wins += 1;
    else if (match.status === "completed" || match.status === "walkover") losses += 1;
  }
  const order = event.rounds.map((r) => r.key);
  const best = [...matches].sort((a, b) => order.indexOf(a.roundKey) - order.indexOf(b.roundKey))[0];
  return { playerId, eventId: event.id, played: wins + losses, wins, losses, frameWins, frameLosses, bestRoundKey: best.roundKey, bestRoundLabelZh: best.roundLabelZh, isActive: matches.some((m) => m.status === "live" || m.status === "session-break" || m.status === "upcoming"), matches };
}
function money(value: number) {
  return `£${value.toLocaleString("en-GB")}`;
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
  const p1 = players.get(match.player1Id), p2 = players.get(match.player2Id);
  if (!p1 || !p2) return null;
  const score = match.status === "walkover" ? "W : O" : `${match.score1 ?? "-"} : ${match.score2 ?? "-"}`;
  return <button className={`${styles.matchRow} ${priority.horizontalMatchRow}`} onClick={onOpen}>
    <div className={styles.matchRowMeta}><span>{match.timeLabelZh ?? match.roundLabelZh}</span><span>{bestOfLabel(match.bestOf)}</span><StatusPill status={match.status} label={match.status === "session-break" ? "进行中" : match.statusLabelZh} /></div>
    <div className={priority.matchVersusRow}>
      <span className={`${priority.matchPlayerLeft} ${match.winnerId === p1.id ? styles.winnerName : ""}`}>{p1.nameZh}{match.winnerId === p1.id ? <em>胜</em> : null}</span>
      <b>{score}</b>
      <span className={`${priority.matchPlayerRight} ${match.winnerId === p2.id ? styles.winnerName : ""}`}>{match.winnerId === p2.id ? <em>胜</em> : null}{p2.nameZh}</span>
    </div><small className={styles.tapHint}>查看完整比分 ›</small>
  </button>;
}
function CalendarCard({ item, onOpen, interactive = true }: { item: SnookerCalendarEvent; onOpen?: () => void; interactive?: boolean }) {
  const content = <><div className={styles.calendarDate}><b>{new Date(`${item.startDate}T00:00:00+08:00`).getMonth() + 1}/{new Date(`${item.startDate}T00:00:00+08:00`).getDate()}</b><small>{item.statusLabelZh}</small></div><div><span><StatusPill status={item.status} label={item.typeZh} /></span><strong>{item.nameZh}</strong><small>{item.nameEn}</small><p>{formatDateRange(item.startDate, item.endDate)} · {item.countryZh} {item.cityZh}{item.winnerZh ? ` · 冠军 ${item.winnerZh}` : ""}</p></div>{interactive ? <em>›</em> : null}</>;
  if (!interactive) return <article className={`${priority.calendarStaticCard} ${item.current ? priority.calendarStaticCurrent : ""}`}>{content}</article>;
  return <button className={item.current ? styles.calendarCurrent : ""} onClick={onOpen}>{content}</button>;
}
function statValue(stat: SnookerMatchPlayerStatistics | undefined, key: keyof SnookerMatchPlayerStatistics, suffix = "") {
  const value = stat?.[key];
  return typeof value === "number" ? `${value}${suffix}` : "—";
}
function meetingDate(item: SnookerHeadToHeadMeeting) {
  if (!item.date) return "—";
  const date = item.date.slice(0, 10).split("-");
  return `${Number(date[1])}/${Number(date[2])}/${date[0]}`;
}

export default function SnookerDataCenterV2({ initialSnapshot, initialDatabaseEvents, initialSourceHealth, buildMark, initialView = "home" }: {
  initialSnapshot: SnookerDashboardSnapshot;
  initialDatabaseEvents: SnookerEvent[];
  initialSourceHealth?: SourceHealth | null;
  buildMark: string;
  initialView?: "home" | "matches" | "data";
}) {
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
  const [matchUpdatedAt, setMatchUpdatedAt] = useState<Record<string, string>>({});
  const signatures = useRef(new Map(initialDatabaseEvents.flatMap((e) => allMatches(e)).map((m) => [m.id, matchSignature(m)])));

  const players = useMemo(() => playerMap(snapshot), [snapshot]);
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
          const next = new Map(data.databaseEvents.flatMap((e) => allMatches(e)).map((m) => [m.id, matchSignature(m)]));
          const changed: string[] = [];
          for (const [id, sig] of next) if (signatures.current.get(id) !== sig) changed.push(id);
          signatures.current = next;
          if (changed.length) setMatchUpdatedAt((current) => ({ ...current, ...Object.fromEntries(changed.map((id) => [id, changedAt])) }));
          setDatabaseEvents(data.databaseEvents);
        }
      }
      if (data.sourceHealth) setSourceHealth(data.sourceHealth);
    } catch {
      setSourceHealth(null);
    } finally { setRefreshing(false); }
  }, []);

  useEffect(() => {
    if (!hasLiveMatch) return;
    const timer = window.setInterval(() => void refresh(), 30_000);
    const onVisibility = () => { if (!document.hidden) void refresh(); };
    document.addEventListener("visibilitychange", onVisibility);
    return () => { window.clearInterval(timer); document.removeEventListener("visibilitychange", onVisibility); };
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
  const recentEvents = seasonCalendar.filter((item) => item.endDate < today || isActiveOn(item, today) || item.id === firstUpcomingAny?.id).filter((item) => item.id !== featuredEventCard?.id).sort((a, b) => b.startDate.localeCompare(a.startDate));

  const rankingRows = useMemo(() => snapshot.rankings.map((row) => ({ ...row, player: players.get(row.playerId) })).filter((row): row is typeof row & { player: SnookerPlayer } => Boolean(row.player)), [snapshot.rankings, players]);
  const chinaTop16 = rankingRows.filter((row) => isChina(row.player));
  const filteredPlayers = useMemo(() => {
    const needle = playerQuery.trim().toLowerCase();
    return snapshot.players.filter((p) => !p.slug.startsWith("wuhan-winner-match-") && !p.slug.startsWith("china-wildcard-")).filter((p) => {
      if (playerFilter === "中国" && !isChina(p)) return false;
      if (playerFilter === "TOP16" && (!p.currentRank || p.currentRank > 16)) return false;
      return !needle || `${p.nameZh} ${p.nameEn} ${p.nationalityZh}`.toLowerCase().includes(needle);
    }).sort((a, b) => (a.currentRank ?? 999) - (b.currentRank ?? 999) || a.nameEn.localeCompare(b.nameEn));
  }, [snapshot.players, playerFilter, playerQuery]);

  const openEvent = (slug: string, tab: EventTab = "overview") => { setDetail({ type: "event", slug, tab }); window.scrollTo({ top: 0, behavior: "smooth" }); };
  const openMatch = (matchId: string, eventSlug: string) => { setDetail({ type: "match", matchId, eventSlug }); window.scrollTo({ top: 0, behavior: "smooth" }); };
  const openPlayer = (playerId: string) => { setDetail({ type: "player", playerId }); window.scrollTo({ top: 0, behavior: "smooth" }); };
  const changeView = (view: MainView) => { setDetail(null); setActiveView(view); window.scrollTo({ top: 0, behavior: "smooth" }); };

  if (detail?.type === "match") {
    const selectedEvent = eventBySlug.get(detail.eventSlug) ?? snapshot.event;
    const match = allMatches(selectedEvent).find((item) => item.id === detail.matchId) ?? finalOf(selectedEvent);
    if (!match) return null;
    const p1 = players.get(match.player1Id), p2 = players.get(match.player2Id);
    if (!p1 || !p2) return null;
    const s1 = match.statistics?.find((stat) => stat.playerId === p1.id);
    const s2 = match.statistics?.find((stat) => stat.playerId === p2.id);
    const hasStats = Boolean(s1 || s2);
    const h2h = match.headToHead;
    const statusLabel = match.status === "completed" || match.status === "walkover" ? "已结束" : match.status === "upcoming" ? "待开始" : "进行中";
    const realtime = match.status === "live" || match.status === "session-break";
    const updated = new Date(matchUpdatedAt[match.id] ?? selectedEvent.snapshotAt).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: "Asia/Shanghai" });
    const localized = (name?: string) => snapshot.players.find((p) => p.nameEn.toLowerCase() === String(name ?? "").toLowerCase())?.nameZh ?? name ?? "";
    const statRows: Array<[string, keyof SnookerMatchPlayerStatistics, string]> = [
      ["总得分", "totalPoints", ""], ["平均出杆", "averageShotTimeSeconds", "秒"], ["进球成功率", "potRate", "%"], ["50+ 单杆", "breaks50Plus", ""], ["破百", "breaks100Plus", ""], ["最高单杆", "highestBreak", ""], ["出杆数", "shotsTaken", ""], ["上台时间", "timeOnTablePct", "%"],
    ];
    return <main className={styles.appRoot} data-theme={theme}><div className={styles.detailShell}>
      <header className={styles.detailHeader}><button onClick={() => setDetail({ type: "event", slug: selectedEvent.slug, tab: "schedule" })}>‹</button><strong>比赛详情</strong><span>DB DATA</span></header>
      <section className={styles.matchHero}><div className={styles.matchHeroMeta}><span>{match.roundLabelZh} · {match.timeLabelZh ?? "比赛时间待同步"}</span><b>{bestOfLabel(match.bestOf)}</b></div><h1>{selectedEvent.nameZh}</h1><div className={styles.versusGrid}>
        <div className={styles.versusPlayer}><div className={styles.avatarWrap}><PlayerAvatar player={p1} size="xl" />{match.winnerId === p1.id ? <em>胜</em> : null}</div><strong>{p1.nameZh}</strong><small>{p1.nameEn}</small></div>
        <div className={styles.bigScore}><strong>{match.status === "walkover" ? "W - O" : `${match.score1 ?? "-"} - ${match.score2 ?? "-"}`}</strong><StatusPill status={match.status} label={statusLabel} /><small>{bestOfLabel(match.bestOf)}</small>{realtime ? <small>{refreshing ? "正在同步…" : `最近更新 ${updated}`}</small> : null}</div>
        <div className={styles.versusPlayer}><div className={styles.avatarWrap}><PlayerAvatar player={p2} size="xl" />{match.winnerId === p2.id ? <em>胜</em> : null}</div><strong>{p2.nameZh}</strong><small>{p2.nameEn}</small></div>
      </div></section>
      <section className={styles.frameSection}><div className={styles.frameHead}><span>单杆<br />(50+)</span><span>分数</span><b>局</b><span>分数</span><span>单杆<br />(50+)</span></div>{match.frames?.length ? match.frames.map((frame) => <div className={styles.frameRow} key={frame.frameNo}><span>{frame.break1 ?? "-"}</span><strong>{frame.score1}</strong><b>{frame.frameNo}</b><strong>{frame.score2}</strong><span>{frame.break2 ?? "-"}</span></div>) : <div className={styles.emptyFrames}>{match.status === "upcoming" ? "比赛尚未开始，逐局比分将在开赛后同步。" : "WST 当前未提供该场逐局明细，已保存官方总比分。"}</div>}</section>
      {hasStats ? <section className={styles.card}><SectionHeader eyebrow="MATCH STATISTICS" title="比赛统计" /><div className={insight.statsPlayers}><div><strong>{p1.nameZh}</strong><small>{p1.nameEn}</small></div><div><strong>{p2.nameZh}</strong><small>{p2.nameEn}</small></div></div><div className={insight.statsCompare}>{statRows.map(([label, key, suffix]) => <div key={label} style={{ display: "contents" }}><div className={insight.left}>{statValue(s1, key, suffix)}</div><div className={insight.label}>{label}</div><div className={insight.right}>{statValue(s2, key, suffix)}</div></div>)}</div><p className={insight.matchDataHint}>统计数据来自 WST Match Centre，并在比赛结束后冻结保存到本站数据库。</p></section> : null}
      {h2h ? <section className={styles.card}><SectionHeader eyebrow="HEAD TO HEAD" title="历史对阵" action={`赛前 ${h2h.meetings} 次`} /><div className={insight.h2hSummary}><div className={insight.h2hSide}><strong>{h2h.player1Wins}</strong><span>{p1.nameZh} 胜</span></div><div className={insight.h2hMiddle}><strong>{h2h.player1Frames} : {h2h.player2Frames}</strong><small>历史局分</small></div><div className={insight.h2hSide}><strong>{h2h.player2Wins}</strong><span>{p2.nameZh} 胜</span></div></div>{h2h.recentMeetings.length ? <div className={insight.h2hHistory}>{h2h.recentMeetings.map((item, index) => <div className={insight.h2hMeeting} key={`${item.date}-${index}`}><time>{meetingDate(item)}</time><div><small>{item.tournament ?? "WST"} · {item.round ?? ""}</small><strong>{localized(item.homePlayerName)} {item.homeScore ?? "-"} : {item.awayScore ?? "-"} {localized(item.awayPlayerName)}</strong></div></div>)}</div> : <div className={insight.noHistory}>此前没有 WST 可识别的正式交手记录。</div>}</section> : null}
      <section className={styles.detailInfoCard}><div><span>比赛时间</span><b>{match.timeLabelZh ?? "待同步"}</b></div><div><span>赛制</span><b>{bestOfLabel(match.bestOf)}</b></div><div><span>状态</span><b>{statusLabel}</b></div></section>
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
    const eventStats = full ? { matches: eventMatches.length, players: new Set(eventMatches.flatMap((m) => [m.player1Id, m.player2Id])).size, china: new Set(eventMatches.flatMap((m) => [m.player1Id, m.player2Id]).filter((id) => isChina(players.get(id)))).size, completed: eventMatches.filter((m) => m.status === "completed" || m.status === "walkover").length } : null;
    const chinaStats = full ? snapshot.players.filter(isChina).map((player) => ({ player, stats: currentEventStats(player.id, full) })).filter((item) => item.stats) : [];
    const totalPrize = full?.prizes?.find((row) => row.isTotal);
    return <main className={styles.appRoot} data-theme={theme}><div className={styles.detailShell}>
      <header className={`${styles.detailHeader} ${priority.eventNameHeader}`}><button onClick={() => setDetail(null)}>‹</button><strong>{calendarEvent.nameZh}</strong><span>{calendarEvent.season}</span></header>
      <section className={styles.eventDetailHero}><div className={styles.eventDetailTop}><StatusPill status={calendarEvent.status} label={calendarEvent.statusLabelZh} /><span>{calendarEvent.typeZh}</span></div><h1>{calendarEvent.nameZh}</h1><p>{calendarEvent.nameEn}</p><div className={styles.eventDetailMeta}><span>{formatDateRange(calendarEvent.startDate, calendarEvent.endDate)}</span><span>{calendarEvent.countryZh} · {calendarEvent.cityZh}</span></div></section>
      <div className={styles.eventTabs}><button className={detail.tab === "overview" ? styles.tabActive : ""} onClick={() => setDetail({ ...detail, tab: "overview" })}>赛事介绍</button><button className={detail.tab === "schedule" ? styles.tabActive : ""} onClick={() => setDetail({ ...detail, tab: "schedule" })}>赛程</button><button className={detail.tab === "data" ? styles.tabActive : ""} onClick={() => setDetail({ ...detail, tab: "data" })}>赛事数据</button></div>
      {detail.tab === "overview" ? <>
        {full?.status === "completed" && champion ? <section className={insight.championCard}><div className={insight.championMark}>冠</div><div className={insight.championText}><small>2026 CHAMPION · 本届冠军</small><strong>{champion.nameZh}</strong><span>{champion.nameEn}{final ? ` · 决赛 ${final.score1}:${final.score2}` : ""}</span></div></section> : null}
        <section className={styles.card}><SectionHeader title="赛事概览" /><div className={insight.eventOverviewGrid}><article><span>赛季</span><b>{calendarEvent.season}</b></article><article><span>赛事类型</span><b>{calendarEvent.typeZh}</b></article><article><span>比赛时间</span><b>{formatDateRange(calendarEvent.startDate, calendarEvent.endDate)}</b></article><article><span>举办地</span><b>{calendarEvent.countryZh} · {calendarEvent.cityZh}</b></article>{full?.previousChampionZh ? <article><span>上届冠军{full.previousChampionYear ? ` · ${full.previousChampionYear}` : ""}</span><b>{full.previousChampionZh}</b></article> : null}{calendarEvent.venueZh ? <article><span>场馆</span><b>{calendarEvent.venueZh}</b></article> : null}</div></section>
        {full?.prizes?.length ? <section className={styles.card}><div className={insight.prizeHeader}><div><small>PRIZE MONEY</small><strong>奖金分配</strong></div>{totalPrize ? <span>总奖金 <b>{money(totalPrize.amount)}</b></span> : null}</div><div className={insight.prizeTable}>{full.prizes.sort((a, b) => a.sortOrder - b.sortOrder).map((row) => <div className={`${insight.prizeRow} ${row.isTotal ? insight.prizeTotal : ""}`} key={row.key}><span>{row.labelZh}</span><b>{money(row.amount)}</b></div>)}</div></section> : null}
      </> : null}
      {detail.tab === "schedule" ? full ? <div className={styles.roundStack}>{full.schedulePartial ? <div className={insight.partialNotice}><b>部分赛程</b><span>WST 当前已公布 {full.publishedMatchCount ?? eventMatches.length} 场场地赛程，后续签表将随官方发布自动补齐。</span></div> : null}{full.rounds.map((round) => <section className={styles.card} key={round.key}><SectionHeader title={round.labelZh} action={bestOfLabel(round.bestOf)} /><div className={styles.matchList}>{round.matches.map((match) => <MatchListRow key={match.id} match={match} players={players} onOpen={() => openMatch(match.id, full.slug)} />)}</div></section>)}</div> : <section className={styles.card}><div className={styles.emptyState}>该站详细赛程尚未入库。</div></section> : null}
      {detail.tab === "data" ? full && eventStats ? <><section className={styles.card}><SectionHeader eyebrow="TOURNAMENT DATA" title="赛事统计" /><div className={styles.statGrid}><article><small>已公布场次</small><strong>{eventStats.matches}</strong><span>{full.schedulePartial ? "部分赛程" : "完整赛程"}</span></article><article><small>参赛球员</small><strong>{eventStats.players}</strong><span>当前签表</span></article><article><small>中国球员</small><strong>{eventStats.china}</strong><span>当前签表</span></article><article><small>已完成</small><strong>{eventStats.completed}</strong><span>数据库统计</span></article></div></section><section className={styles.card}><SectionHeader eyebrow="CHINA WATCH" title="中国军团本届成绩" /><div className={styles.chinaResultList}>{chinaStats.map(({ player, stats }) => <button key={player.id} onClick={() => openPlayer(player.id)}><PlayerAvatar player={player} size="sm" /><span><b>{player.nameZh}</b><small>世界第 {player.currentRank ?? "—"}</small></span><strong>{stats!.bestRoundLabelZh}</strong><em>{stats!.wins}胜{stats!.losses}负</em></button>)}</div></section></> : <section className={styles.card}><div className={styles.emptyState}>赛事数据将在签表与比赛数据入库后显示。</div></section> : null}
    </div></main>;
  }

  if (detail?.type === "player") {
    const player = players.get(detail.playerId) ?? snapshot.players[0];
    const recentEvent = [...databaseEvents].filter((e) => allMatches(e).some((m) => m.player1Id === player.id || m.player2Id === player.id)).sort((a, b) => b.endDate.localeCompare(a.endDate))[0];
    const stats = recentEvent ? currentEventStats(player.id, recentEvent) : null;
    return <main className={styles.appRoot} data-theme={theme}><div className={styles.detailShell}><header className={styles.detailHeader}><button onClick={() => setDetail(null)}>‹</button><strong>球员详情</strong><span>PLAYER</span></header><section className={styles.playerHero}><PlayerAvatar player={player} size="xl" /><div><small>{player.nationalityZh}</small><h1>{player.nameZh}</h1><p>{player.nameEn}</p></div><div className={styles.rankBubble}><small>世界排名</small><b>{player.currentRank ? `#${player.currentRank}` : "—"}</b></div></section><section className={styles.profileFacts}><article><span>出生日期</span><b>{formatBirthday(player.dateOfBirth)}</b></article><article><span>转职业</span><b>{player.turnedPro ?? "—"}</b></article><article><span>排名积分</span><b>{player.rankingPoints?.toLocaleString("en-GB") ?? "—"}</b></article><article><span>资料来源</span><b>{player.profileSource ?? "curated"}</b></article></section>{recentEvent && stats ? <section className={styles.card}><SectionHeader eyebrow="RECENT EVENT" title={`${recentEvent.nameZh}表现`} action={stats.bestRoundLabelZh} /><div className={styles.statGrid}><article><small>胜负</small><strong>{stats.wins}-{stats.losses}</strong><span>本站</span></article><article><small>局分</small><strong>{stats.frameWins}-{stats.frameLosses}</strong><span>本站累计</span></article></div></section> : null}</div></main>;
  }

  const featuredDetail = featuredEventCard ? eventBySlug.get(featuredEventCard.slug) : undefined;
  const latestCompleted = [...databaseEvents].filter((event) => event.status === "completed" && event.endDate <= today).sort((a, b) => b.endDate.localeCompare(a.endDate))[0];
  const currentOrLatest = activeEventCard ? eventBySlug.get(activeEventCard.slug) : latestCompleted;
  const headlineMatch = activeEventCard ? allMatches(currentOrLatest ?? snapshot.event).find((m) => m.status === "live" || m.status === "session-break") ?? finalOf(currentOrLatest) : finalOf(latestCompleted);
  const headlineEvent = activeEventCard ? currentOrLatest : latestCompleted;

  return <main className={styles.appRoot} data-theme={theme}><div className={styles.shell}>
    <header className={styles.header}><button className={styles.brand} onClick={() => changeView("home")}><span>S</span><div><strong>世界斯诺克数据中心</strong><small>WORLD SNOOKER DATA</small></div></button><div className={styles.headerRight}><span className={styles.versionBadge}>DATA v0.7</span><div className={styles.themeSwitch}><button className={theme === "green" ? styles.themeActive : ""} onClick={() => setTheme("green")}>绿</button><button className={theme === "red" ? styles.themeActive : ""} onClick={() => setTheme("red")}>红</button></div></div></header>
    <div className={styles.content}>
      {activeView === "home" ? <>
        {featuredEventCard ? <section className={styles.hero}><div className={styles.heroTop}><StatusPill status={featuredEventCard.status} label={activeEventCard ? "当前赛事" : graceEventCard ? "刚刚结束" : "下一站"} /><span>{featuredEventCard.typeZh}</span></div><small>{activeEventCard ? "CURRENT TOURNAMENT" : graceEventCard ? "JUST FINISHED" : "NEXT TOURNAMENT"}</small><h1>{featuredEventCard.nameZh}</h1><p>{formatDateRange(featuredEventCard.startDate, featuredEventCard.endDate)} · {featuredEventCard.countryZh} {featuredEventCard.cityZh}</p><div className={styles.heroActions}><button onClick={() => openEvent(featuredEventCard.slug, featuredDetail?.rounds.length ? "schedule" : "overview")}>查看赛事</button><button className={styles.secondaryButton} onClick={() => changeView("matches")}>赛事列表</button></div></section> : null}
        {headlineMatch && headlineEvent ? <section className={styles.card}><div className={styles.liveHeader}><div><small>{headlineMatch.roundLabelZh} · {headlineMatch.timeLabelZh ?? ""}</small><h2>{headlineEvent.nameZh} · {headlineMatch.roundLabelZh}</h2></div><StatusPill status={headlineMatch.status} label={headlineMatch.status === "completed" ? "已结束" : "进行中"} /></div><div className={styles.homeScore}><button onClick={() => openPlayer(headlineMatch.player1Id)}><PlayerAvatar player={players.get(headlineMatch.player1Id)!} size="lg" /><span>{players.get(headlineMatch.player1Id)?.shortNameZh}</span>{headlineMatch.winnerId === headlineMatch.player1Id ? <em>胜</em> : null}</button><div><strong>{headlineMatch.score1 ?? "-"} <i>:</i> {headlineMatch.score2 ?? "-"}</strong><small>{bestOfLabel(headlineMatch.bestOf)}</small></div><button onClick={() => openPlayer(headlineMatch.player2Id)}><PlayerAvatar player={players.get(headlineMatch.player2Id)!} size="lg" /><span>{players.get(headlineMatch.player2Id)?.shortNameZh}</span>{headlineMatch.winnerId === headlineMatch.player2Id ? <em>胜</em> : null}</button></div><button className={styles.fullButton} onClick={() => openMatch(headlineMatch.id, headlineEvent.slug)}>查看完整比分、统计与历史对阵</button><div className={styles.sourceLine}><i className={sourceHealth?.accepted ? styles.liveOk : styles.liveWait} /><b>Snooker 独立数据库</b><small>{headlineMatch.status === "completed" ? "比赛数据已冻结保存" : "30秒同步"}</small></div></section> : null}
        {nextEventCard ? <section className={styles.card}><SectionHeader eyebrow="NEXT EVENT" title="下一站" action={nextEventCard.statusLabelZh} /><button className={styles.nextEvent} onClick={() => openEvent(nextEventCard.slug)}><span>{nextEventCard.cityZh?.slice(0, 1) || "赛"}</span><div><strong>{nextEventCard.nameZh}</strong><small>{nextEventCard.nameEn}</small><p>{formatDateRange(nextEventCard.startDate, nextEventCard.endDate)} · {nextEventCard.cityZh}</p></div><em>›</em></button></section> : null}
        <section className={styles.card}><SectionHeader eyebrow="WORLD RANKING" title="世界排名" action="TOP 16" /><div className={styles.rankingList}>{rankingRows.slice(0, 6).map((row) => <button key={row.rank} onClick={() => openPlayer(row.player.id)}><strong>{row.rank}</strong><PlayerAvatar player={row.player} size="sm" /><span><b>{row.player.nameZh}</b><small>{row.player.nameEn}</small></span><em>{row.points.toLocaleString("en-GB")}</em></button>)}</div><button className={styles.fullButton} onClick={() => changeView("data")}>查看完整世界排名</button></section>
        <section className={styles.card}><SectionHeader eyebrow="CHINA TOP 16" title="中国球员" action={`${chinaTop16.length} 人进入 TOP16`} /><div className={styles.chinaTopGrid}>{chinaTop16.map((row) => <button key={row.player.id} onClick={() => openPlayer(row.player.id)}><span>{row.rank}</span><strong>{row.player.nameZh}</strong><small>世界第 {row.rank}</small></button>)}</div></section>
      </> : null}
      {activeView === "matches" ? <><section className={styles.pageIntro}><small>TOURNAMENTS</small><h1>赛事</h1><p>近期赛事展示本赛季已完成赛事、当前赛事和即将开始的一站；赛季赛历展示完整 2026/27 赛程。</p></section><div className={priority.eventModeTabs}><button className={eventListMode === "recent" ? priority.eventModeActive : ""} onClick={() => setEventListMode("recent")}>近期赛事</button><button className={eventListMode === "calendar" ? priority.eventModeActive : ""} onClick={() => setEventListMode("calendar")}>赛季赛历</button></div>{eventListMode === "recent" ? <>{featuredEventCard ? <section className={styles.currentEventBanner} onClick={() => openEvent(featuredEventCard.slug, featuredDetail?.rounds.length ? "schedule" : "overview")}><div><StatusPill status={featuredEventCard.status} label={activeEventCard ? "当前赛事" : graceEventCard ? "刚刚结束" : "下一站"} /><small>{featuredEventCard.typeZh}</small></div><h2>{featuredEventCard.nameZh}</h2><p>{formatDateRange(featuredEventCard.startDate, featuredEventCard.endDate)} · {featuredEventCard.cityZh}</p><span>查看赛事 ›</span></section> : null}<section className={styles.card}><SectionHeader title="近期赛事" action="本赛季" /><div className={styles.calendarList}>{recentEvents.map((item) => <CalendarCard key={item.id} item={item} onOpen={() => openEvent(item.slug)} />)}</div></section></> : <section className={styles.card}><SectionHeader eyebrow="2026/27 SEASON" title="赛季赛历" action="按时间顺序" /><div className={priority.calendarStaticList}>{seasonCalendar.map((item) => <CalendarCard key={item.id} item={item} interactive={false} />)}</div></section>}</> : null}
      {activeView === "players" ? <><section className={styles.pageIntro}><small>PLAYER DIRECTORY</small><h1>球员</h1><p>点击任意球员查看资料、排名和近期赛事表现。</p></section><section className={styles.card}><div className={styles.searchBox}><span>⌕</span><input value={playerQuery} onChange={(e) => setPlayerQuery(e.target.value)} placeholder="搜索中文名 / 英文名" /></div><div className={styles.playerFilters}>{playerFilters.map((filter) => <button key={filter} className={playerFilter === filter ? styles.filterActive : ""} onClick={() => setPlayerFilter(filter)}>{filter}</button>)}</div><div className={styles.playerDirectory}>{filteredPlayers.map((player) => <button key={player.id} onClick={() => openPlayer(player.id)}><PlayerAvatar player={player} /><span><strong>{player.nameZh}</strong><small>{player.nameEn} · {player.nationalityZh}</small></span><b>{player.currentRank ? `#${player.currentRank}` : "—"}</b><em>›</em></button>)}</div></section></> : null}
      {activeView === "data" ? <><section className={styles.pageIntro}><small>GLOBAL DATA</small><h1>数据</h1><p>跨赛事、跨赛季数据；单站数据仍放在各赛事自己的“赛事数据”页。</p></section><section className={styles.card}><SectionHeader eyebrow="WORLD RANKING" title="世界排名 TOP16" /><div className={styles.rankingList}>{rankingRows.map((row) => <button key={row.rank} onClick={() => openPlayer(row.player.id)}><strong>{row.rank}</strong><PlayerAvatar player={row.player} size="sm" /><span><b>{row.player.nameZh}</b><small>{row.player.nameEn} · {row.player.nationalityZh}</small></span><em>{row.points.toLocaleString("en-GB")}</em></button>)}</div></section><section className={styles.card}><SectionHeader eyebrow="COMING NEXT" title="数据专题" /><div className={styles.futureGrid}><article><small>HEAD TO HEAD</small><strong>交手记录</strong><span>已进入比赛详情</span></article><article><small>CENTURIES</small><strong>破百榜</strong><span>正在接入</span></article><article><small>DECIDERS</small><strong>决胜局</strong><span>正在接入</span></article><article><small>TITLES</small><strong>冠军榜</strong><span>正在接入</span></article></div></section></> : null}
    </div>
    <nav className={styles.bottomNav}>{navItems.map((item) => <button key={item.id} className={activeView === item.id ? styles.activeNav : ""} onClick={() => changeView(item.id)}><span>{item.icon}</span><b>{item.label}</b></button>)}</nav><span className={styles.buildMark}>{buildMark}</span>
  </div></main>;
}
