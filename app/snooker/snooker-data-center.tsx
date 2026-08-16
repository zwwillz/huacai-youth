"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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

function playerMap(snapshot: SnookerDashboardSnapshot) {
  return new Map(snapshot.players.map((player) => [player.id, player]));
}

function allMatches(event: SnookerEvent) {
  return event.rounds.flatMap((round) => round.matches);
}

function realtimeSignature(snapshot: SnookerDashboardSnapshot) {
  return JSON.stringify(
    snapshot.event.rounds.flatMap((round) => round.matches.map((match) => ({
      id: match.id,
      score1: match.score1,
      score2: match.score2,
      status: match.status,
      winnerId: match.winnerId ?? null,
      frames: (match.frames ?? []).map((frame) => [
        frame.frameNo,
        frame.score1,
        frame.score2,
        frame.break1 ?? null,
        frame.break2 ?? null,
      ]),
    }))),
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
  return (
    <div className={styles.sectionHeader}>
      <div>{eyebrow ? <small>{eyebrow}</small> : null}<h2>{title}</h2></div>
      {action ? <span>{action}</span> : null}
    </div>
  );
}

function PlayerAvatar({ player, size = "md" }: { player: SnookerPlayer; size?: "sm" | "md" | "lg" | "xl" }) {
  return (
    <span
      className={`${styles.avatar} ${styles[`avatar_${size}`]} ${player.avatar ? styles.avatarPhoto : ""}`}
      style={player.avatar ? { backgroundImage: `url("${player.avatar.url}")` } : undefined}
      aria-label={player.nameZh}
    >
      {!player.avatar ? initials(player.nameEn) : null}
    </span>
  );
}

function StatusPill({ status, label }: { status: string; label: string }) {
  return <span className={`${styles.statusPill} ${styles[`status_${status}`] ?? ""}`}>{label}</span>;
}

function MatchListRow({ match, players, onOpen }: { match: SnookerMatch; players: Map<string, SnookerPlayer>; onOpen: () => void }) {
  const p1 = players.get(match.player1Id)!;
  const p2 = players.get(match.player2Id)!;
  const score = match.status === "walkover" ? "W : O" : `${match.score1 ?? "-"} : ${match.score2 ?? "-"}`;
  return (
    <button className={`${styles.matchRow} ${priority.horizontalMatchRow}`} onClick={onOpen}>
      <div className={styles.matchRowMeta}>
        <span>{match.timeLabelZh ?? match.roundLabelZh}</span>
        <span>{bestOfLabel(match.bestOf)}</span>
        <StatusPill status={match.status} label={match.status === "session-break" ? "进行中" : match.statusLabelZh} />
      </div>
      <div className={priority.matchVersusRow}>
        <span className={`${priority.matchPlayerLeft} ${match.winnerId === p1.id ? styles.winnerName : ""}`}>
          {p1.nameZh}{match.winnerId === p1.id ? <em>胜</em> : null}
        </span>
        <b>{score}</b>
        <span className={`${priority.matchPlayerRight} ${match.winnerId === p2.id ? styles.winnerName : ""}`}>
          {match.winnerId === p2.id ? <em>胜</em> : null}{p2.nameZh}
        </span>
      </div>
      <small className={styles.tapHint}>查看完整比分 ›</small>
    </button>
  );
}

function CalendarCard({ item, onOpen, interactive = true }: { item: SnookerCalendarEvent; onOpen?: () => void; interactive?: boolean }) {
  const content = (
    <>
      <div className={styles.calendarDate}>
        <b>{new Date(`${item.startDate}T00:00:00+08:00`).getMonth() + 1}/{new Date(`${item.startDate}T00:00:00+08:00`).getDate()}</b>
        <small>{item.statusLabelZh}</small>
      </div>
      <div>
        <span><StatusPill status={item.status} label={item.typeZh} /></span>
        <strong>{item.nameZh}</strong>
        <small>{item.nameEn}</small>
        <p>{formatDateRange(item.startDate, item.endDate)} · {item.countryZh} {item.cityZh}{item.winnerZh ? ` · 冠军 ${item.winnerZh}` : ""}</p>
      </div>
      {interactive ? <em>›</em> : null}
    </>
  );

  if (!interactive) return <article className={`${priority.calendarStaticCard} ${item.current ? priority.calendarStaticCurrent : ""}`}>{content}</article>;
  return <button className={item.current ? styles.calendarCurrent : ""} onClick={onOpen}>{content}</button>;
}

export default function SnookerDataCenter({
  initialSnapshot,
  initialSourceHealth,
  buildMark,
}: {
  initialSnapshot: SnookerDashboardSnapshot;
  initialSourceHealth?: SourceHealth | null;
  buildMark: string;
}) {
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [activeView, setActiveView] = useState<MainView>("home");
  const [detail, setDetail] = useState<DetailState | null>(null);
  const [theme, setTheme] = useState<Theme>("green");
  const [sourceHealth, setSourceHealth] = useState<SourceHealth | null>(initialSourceHealth ?? null);
  const [refreshing, setRefreshing] = useState(false);
  const [eventListMode, setEventListMode] = useState<EventListMode>("recent");
  const [playerFilter, setPlayerFilter] = useState<PlayerFilter>("全部");
  const [playerQuery, setPlayerQuery] = useState("");
  const [lastUpdatedAt, setLastUpdatedAt] = useState(initialSnapshot.event.snapshotAt);
  const realtimeSignatureRef = useRef(realtimeSignature(initialSnapshot));

  const refresh = useCallback(async () => {
    if (typeof document !== "undefined" && document.hidden) return;
    setRefreshing(true);
    try {
      const response = await fetch(`/api/snooker/v1/dashboard?ts=${Date.now()}`, {
        cache: "no-store",
        headers: { "cache-control": "no-cache" },
      });
      const data = await response.json() as DashboardResponse;
      if (response.ok && data.ok && data.snapshot) {
        const nextSignature = realtimeSignature(data.snapshot);
        if (nextSignature !== realtimeSignatureRef.current) {
          realtimeSignatureRef.current = nextSignature;
          setLastUpdatedAt(data.sourceHealth?.fetchedAt ?? new Date().toISOString());
        }
        setSnapshot(data.snapshot);
      }
      if (data.sourceHealth) setSourceHealth(data.sourceHealth);
    } catch {
      setSourceHealth(null);
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const initialTimer = window.setTimeout(() => void refresh(), 0);
    const timer = window.setInterval(() => void refresh(), 15_000);
    const onVisibility = () => { if (!document.hidden) void refresh(); };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.clearTimeout(initialTimer);
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [refresh]);

  const players = useMemo(() => playerMap(snapshot), [snapshot]);
  const event = snapshot.event;
  const eventMatches = useMemo(() => allMatches(event), [event]);
  const finalMatch = event.rounds.find((round) => round.key === "final")!.matches[0];
  const currentEventCard = snapshot.calendar.find((item) => item.current) ?? snapshot.calendar.find((item) => item.slug === event.slug)!;
  const seasonCalendar = useMemo(
    () => [...snapshot.calendar].filter((item) => item.season === "2026/27").sort((a, b) => a.startDate.localeCompare(b.startDate)),
    [snapshot.calendar],
  );
  const nextEventCard = seasonCalendar.find((item) => item.status === "upcoming" && item.typeZh !== "资格赛");
  const previousEventCard = [...seasonCalendar].reverse().find((item) => item.status === "completed" && item.typeZh !== "资格赛");
  const recentSecondaryEvents = useMemo(
    () => [nextEventCard, previousEventCard]
      .filter((item): item is SnookerCalendarEvent => Boolean(item))
      .sort((a, b) => b.startDate.localeCompare(a.startDate)),
    [nextEventCard, previousEventCard],
  );

  const rankingRows = useMemo(
    () => snapshot.rankings.map((row) => ({ ...row, player: players.get(row.playerId)! })).filter((row) => row.player),
    [snapshot.rankings, players],
  );
  const chinaTop16 = rankingRows.filter((row) => row.player.countryCode === "CHN");

  const filteredPlayers = useMemo(() => {
    const needle = playerQuery.trim().toLowerCase();
    return [...snapshot.players]
      .sort((a, b) => (a.currentRank ?? 999) - (b.currentRank ?? 999) || a.nameEn.localeCompare(b.nameEn))
      .filter((player) => {
        if (playerFilter === "中国" && player.countryCode !== "CHN") return false;
        if (playerFilter === "TOP16" && (player.currentRank === null || player.currentRank > 16)) return false;
        if (!needle) return true;
        return `${player.nameZh} ${player.shortNameZh} ${player.nameEn} ${player.nationalityZh}`.toLowerCase().includes(needle);
      });
  }, [snapshot.players, playerFilter, playerQuery]);

  const openEvent = (slug: string, tab: EventTab = "overview") => {
    setDetail({ type: "event", slug, tab });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const openMatch = (matchId: string, eventSlug = event.slug) => {
    setDetail({ type: "match", matchId, eventSlug });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const openPlayer = (playerId: string) => {
    setDetail({ type: "player", playerId });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const changeView = (view: MainView) => {
    setDetail(null);
    setActiveView(view);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const updatedTime = new Date(lastUpdatedAt).toLocaleTimeString("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZone: "Asia/Shanghai",
  });
  const sourceLabel = sourceHealth?.accepted
    ? `WST官方数据 · ${sourceHealth.liveAccepted ? "实时比分已同步" : "赛事比分已同步"}`
    : sourceHealth?.online
      ? "WST数据在线 · 等待安全覆盖"
      : sourceHealth === null
        ? "正在连接WST实时数据"
        : "WST实时源暂不可用 · 使用已验证快照";

  if (detail?.type === "match") {
    const match = eventMatches.find((item) => item.id === detail.matchId) ?? finalMatch;
    const p1 = players.get(match.player1Id)!;
    const p2 = players.get(match.player2Id)!;
    const target = Math.floor(match.bestOf / 2) + 1;
    const statusLabel = match.status === "completed" || match.status === "walkover" ? "已结束" : match.status === "upcoming" ? "待开始" : "进行中";
    return (
      <main className={styles.appRoot} data-theme={theme}>
        <div className={styles.detailShell}>
          <header className={styles.detailHeader}>
            <button onClick={() => setDetail({ type: "event", slug: detail.eventSlug, tab: "schedule" })}>‹</button>
            <strong>比赛详情</strong>
            <span>DATA v0.5</span>
          </header>

          <section className={styles.matchHero}>
            <div className={styles.matchHeroMeta}>
              <span>{match.roundLabelZh} · {match.timeLabelZh ?? "比赛时间待同步"}</span>
              <b>{match.bestOf}局{target}胜</b>
            </div>
            <h1>{event.nameZh}</h1>
            <div className={styles.versusGrid}>
              <div className={styles.versusPlayer}>
                <div className={styles.avatarWrap}><PlayerAvatar player={p1} size="xl" />{match.winnerId === p1.id ? <em>胜</em> : null}</div>
                <strong>{p1.nameZh}</strong><small>{p1.nameEn}</small>
              </div>
              <div className={styles.bigScore}>
                <strong>{match.status === "walkover" ? "W - O" : `${match.score1 ?? "-"} - ${match.score2 ?? "-"}`}</strong>
                <StatusPill status={match.status} label={statusLabel} />
                <small>{bestOfLabel(match.bestOf)}</small>
              </div>
              <div className={styles.versusPlayer}>
                <div className={styles.avatarWrap}><PlayerAvatar player={p2} size="xl" />{match.winnerId === p2.id ? <em>胜</em> : null}</div>
                <strong>{p2.nameZh}</strong><small>{p2.nameEn}</small>
              </div>
            </div>
            {match.sessionTimesZh?.length ? <div className={styles.sessionTimes}>{match.sessionTimesZh.map((item) => <span key={item}>{item}</span>)}</div> : null}
          </section>

          <section className={styles.frameSection}>
            <div className={styles.frameHead}><span>单杆<br />(50+)</span><span>分数</span><b>局</b><span>分数</span><span>单杆<br />(50+)</span></div>
            {match.frames?.length ? match.frames.map((frame) => (
              <div className={styles.frameRow} key={frame.frameNo}>
                <span>{frame.break1 ?? "-"}</span><strong>{frame.score1}</strong><b>{frame.frameNo}</b><strong>{frame.score2}</strong><span>{frame.break2 ?? "-"}</span>
              </div>
            )) : <div className={styles.emptyFrames}>该场逐局数据正在接入，当前先展示总比分。</div>}
          </section>

          <section className={styles.detailInfoCard}>
            <div><span>比赛时间</span><b>{match.timeLabelZh ?? "待同步"}</b></div>
            <div><span>赛制</span><b>{bestOfLabel(match.bestOf)}</b></div>
            <div><span>状态</span><b>{statusLabel}</b></div>
            {match.note ? <p>{match.note}</p> : null}
          </section>

          <div className={styles.liveFooter}>
            <i className={sourceHealth?.accepted ? styles.liveOk : styles.liveWait} />
            <span>{sourceLabel}</span>
            <small>最近更新 {updatedTime} · 15秒自动同步</small>
          </div>
        </div>
      </main>
    );
  }

  if (detail?.type === "player") {
    const player = players.get(detail.playerId) ?? snapshot.players[0];
    const stats = currentEventStats(player.id, event);
    return (
      <main className={styles.appRoot} data-theme={theme}>
        <div className={styles.detailShell}>
          <header className={styles.detailHeader}><button onClick={() => setDetail(null)}>‹</button><strong>球员详情</strong><span>PLAYER</span></header>
          <section className={styles.playerHero}>
            <PlayerAvatar player={player} size="xl" />
            <div><small>{player.nationalityZh}</small><h1>{player.nameZh}</h1><p>{player.nameEn}</p></div>
            <div className={styles.rankBubble}><small>世界排名</small><b>{player.currentRank ? `#${player.currentRank}` : "—"}</b></div>
          </section>
          <section className={styles.profileFacts}>
            <article><span>出生日期</span><b>{formatBirthday(player.dateOfBirth)}</b></article>
            <article><span>转职业</span><b>{player.turnedPro ?? "—"}</b></article>
            <article><span>排名积分</span><b>{player.rankingPoints?.toLocaleString("en-GB") ?? "—"}</b></article>
            <article><span>资料来源</span><b>{player.profileSource ?? "curated"}</b></article>
          </section>
          {stats ? (
            <section className={styles.card}>
              <SectionHeader eyebrow="CURRENT EVENT" title="中国公开赛表现" action={stats.bestRoundLabelZh} />
              <div className={styles.statGrid}>
                <article><small>胜负</small><strong>{stats.wins}-{stats.losses}</strong><span>本届比赛</span></article>
                <article><small>局分</small><strong>{stats.frameWins}-{stats.frameLosses}</strong><span>本届累计</span></article>
              </div>
              <div className={styles.playerMatches}>{stats.matches.map((match) => {
                const opponentId = match.player1Id === player.id ? match.player2Id : match.player1Id;
                const opponent = players.get(opponentId)!;
                const selfScore = match.player1Id === player.id ? match.score1 : match.score2;
                const oppScore = match.player1Id === player.id ? match.score2 : match.score1;
                return <button key={match.id} onClick={() => openMatch(match.id)}><small>{match.roundLabelZh} · {match.timeLabelZh ?? ""}</small><span>vs {opponent.nameZh}</span><b>{selfScore ?? "-"} : {oppScore ?? "-"}</b></button>;
              })}</div>
            </section>
          ) : null}
          {player.avatar ? <p className={styles.avatarCredit}>头像：{player.avatar.credit} · {player.avatar.license}</p> : null}
        </div>
      </main>
    );
  }

  if (detail?.type === "event") {
    const calendarEvent = snapshot.calendar.find((item) => item.slug === detail.slug) ?? currentEventCard;
    const fullData = calendarEvent.slug === event.slug && calendarEvent.dataReady;
    const eventStats = fullData ? {
      matchCount: eventMatches.length,
      playerCount: new Set(eventMatches.flatMap((match) => [match.player1Id, match.player2Id])).size,
      chinaCount: new Set(eventMatches.flatMap((match) => [match.player1Id, match.player2Id]).filter((id) => players.get(id)?.countryCode === "CHN")).size,
      completed: eventMatches.filter((match) => match.status === "completed" || match.status === "walkover").length,
    } : null;
    const chinaStats = fullData
      ? snapshot.players.filter((player) => player.countryCode === "CHN").map((player) => ({ player, stats: currentEventStats(player.id, event) })).filter((item) => item.stats)
      : [];

    return (
      <main className={styles.appRoot} data-theme={theme}>
        <div className={styles.detailShell}>
          <header className={`${styles.detailHeader} ${priority.eventNameHeader}`}>
            <button onClick={() => setDetail(null)}>‹</button>
            <strong>{calendarEvent.nameZh}</strong>
            <span>{calendarEvent.season}</span>
          </header>
          <section className={styles.eventDetailHero}>
            <div className={styles.eventDetailTop}><StatusPill status={calendarEvent.status} label={calendarEvent.statusLabelZh} /><span>{calendarEvent.typeZh}</span></div>
            <h1>{calendarEvent.nameZh}</h1>
            <p>{calendarEvent.nameEn}</p>
            <div className={styles.eventDetailMeta}><span>{formatDateRange(calendarEvent.startDate, calendarEvent.endDate)}</span><span>{calendarEvent.countryZh} · {calendarEvent.cityZh}</span></div>
          </section>
          <div className={styles.eventTabs}>
            <button className={detail.tab === "overview" ? styles.tabActive : ""} onClick={() => setDetail({ ...detail, tab: "overview" })}>赛事介绍</button>
            <button className={detail.tab === "schedule" ? styles.tabActive : ""} onClick={() => setDetail({ ...detail, tab: "schedule" })}>赛程</button>
            <button className={detail.tab === "data" ? styles.tabActive : ""} onClick={() => setDetail({ ...detail, tab: "data" })}>赛事数据</button>
          </div>

          {detail.tab === "overview" ? (
            <section className={styles.card}>
              <SectionHeader title="赛事概览" />
              <div className={styles.overviewList}>
                <div><span>赛季</span><b>{calendarEvent.season}</b></div>
                <div><span>赛事类型</span><b>{calendarEvent.typeZh}</b></div>
                <div><span>比赛时间</span><b>{formatDateRange(calendarEvent.startDate, calendarEvent.endDate)}</b></div>
                <div><span>举办地</span><b>{calendarEvent.countryZh} · {calendarEvent.cityZh}</b></div>
                {calendarEvent.venueZh ? <div><span>场馆</span><b>{calendarEvent.venueZh}</b></div> : null}
                {calendarEvent.winnerZh ? <div><span>冠军</span><b>{calendarEvent.winnerZh}</b></div> : null}
                {fullData ? <><div><span>冠军奖金</span><b>£{event.winnerPrize.toLocaleString("en-GB")}</b></div><div><span>亚军奖金</span><b>£{event.runnerUpPrize.toLocaleString("en-GB")}</b></div><div><span>决赛裁判</span><b>{event.refereeZh}</b></div></> : null}
              </div>
              {!fullData ? <p className={styles.dataNote}>该站目前先进入 2026/27 赛历，完整签表与比赛数据将在数据源接入后展示。</p> : null}
            </section>
          ) : null}

          {detail.tab === "schedule" ? (
            fullData ? <div className={styles.roundStack}>{event.rounds.map((round) => (
              <section className={styles.card} key={round.key}>
                <SectionHeader title={round.labelZh} action={bestOfLabel(round.bestOf)} />
                <div className={styles.matchList}>{round.matches.map((match) => <MatchListRow key={match.id} match={match} players={players} onOpen={() => openMatch(match.id, event.slug)} />)}</div>
              </section>
            ))}</div> : <section className={styles.card}><SectionHeader title="赛程" /><div className={styles.emptyState}>该站详细赛程正在接入。</div></section>
          ) : null}

          {detail.tab === "data" ? (
            fullData && eventStats ? <>
              <section className={styles.card}>
                <SectionHeader eyebrow="TOURNAMENT DATA" title="赛事统计" />
                <div className={styles.statGrid}>
                  <article><small>主赛场次</small><strong>{eventStats.matchCount}</strong><span>完整主赛</span></article>
                  <article><small>参赛球员</small><strong>{eventStats.playerCount}</strong><span>本站主赛</span></article>
                  <article><small>中国球员</small><strong>{eventStats.chinaCount}</strong><span>本站主赛</span></article>
                  <article><small>已完成</small><strong>{eventStats.completed}</strong><span>实时计算</span></article>
                </div>
              </section>
              <section className={styles.card}>
                <SectionHeader eyebrow="CHINA WATCH" title="中国军团本届成绩" />
                <div className={styles.chinaResultList}>{chinaStats.sort((a, b) => event.rounds.findIndex((round) => round.key === a.stats!.bestRoundKey) - event.rounds.findIndex((round) => round.key === b.stats!.bestRoundKey)).map(({ player, stats }) => (
                  <button key={player.id} onClick={() => openPlayer(player.id)}><PlayerAvatar player={player} size="sm" /><span><b>{player.nameZh}</b><small>世界第 {player.currentRank ?? "—"}</small></span><strong>{stats!.bestRoundLabelZh}</strong><em>{stats!.wins}胜{stats!.losses}负</em></button>
                ))}</div>
              </section>
            </> : <section className={styles.card}><SectionHeader title="赛事数据" /><div className={styles.emptyState}>该站赛事数据正在接入。</div></section>
          ) : null}
        </div>
      </main>
    );
  }

  return (
    <main className={styles.appRoot} data-theme={theme}>
      <div className={styles.shell}>
        <header className={styles.header}>
          <button className={styles.brand} onClick={() => changeView("home")}><span>S</span><div><strong>世界斯诺克数据中心</strong><small>WORLD SNOOKER DATA</small></div></button>
          <div className={styles.headerRight}>
            <span className={styles.versionBadge}>DATA v0.5</span>
            <div className={styles.themeSwitch}><button className={theme === "green" ? styles.themeActive : ""} onClick={() => setTheme("green")}>绿</button><button className={theme === "red" ? styles.themeActive : ""} onClick={() => setTheme("red")}>红</button></div>
          </div>
        </header>

        <div className={styles.content}>
          {activeView === "home" ? <>
            <section className={styles.hero}>
              <div className={styles.heroTop}><StatusPill status={currentEventCard.status} label={currentEventCard.statusLabelZh} /><span>{currentEventCard.typeZh}</span></div>
              <small>CURRENT TOURNAMENT</small><h1>{currentEventCard.nameZh}</h1>
              <p>{formatDateRange(currentEventCard.startDate, currentEventCard.endDate)} · {currentEventCard.countryZh} {currentEventCard.cityZh}</p>
              <div className={styles.heroActions}><button onClick={() => openEvent(currentEventCard.slug, "schedule")}>查看赛事</button><button className={styles.secondaryButton} onClick={() => changeView("matches")}>赛事列表</button></div>
            </section>

            <section className={styles.card}>
              <div className={styles.liveHeader}><div><small>{finalMatch.roundLabelZh} · {finalMatch.timeLabelZh}</small><h2>中国公开赛 · 决赛</h2></div><StatusPill status={finalMatch.status} label={finalMatch.status === "session-break" ? "进行中" : finalMatch.statusLabelZh} /></div>
              <div className={styles.homeScore}>
                <button onClick={() => openPlayer(finalMatch.player1Id)}><PlayerAvatar player={players.get(finalMatch.player1Id)!} size="lg" /><span>{players.get(finalMatch.player1Id)!.shortNameZh}</span></button>
                <div><strong>{finalMatch.score1 ?? "-"} <i>:</i> {finalMatch.score2 ?? "-"}</strong><small>{bestOfLabel(finalMatch.bestOf)}</small></div>
                <button onClick={() => openPlayer(finalMatch.player2Id)}><PlayerAvatar player={players.get(finalMatch.player2Id)!} size="lg" /><span>{players.get(finalMatch.player2Id)!.shortNameZh}</span></button>
              </div>
              <button className={styles.fullButton} onClick={() => openMatch(finalMatch.id)}>查看完整比分与逐局数据</button>
              <div className={styles.sourceLine}><i className={sourceHealth?.accepted ? styles.liveOk : styles.liveWait} /><b>{sourceLabel}</b><small>{refreshing ? "同步中…" : `最近更新 ${updatedTime}`}</small></div>
            </section>

            {nextEventCard ? <section className={styles.card}><SectionHeader eyebrow="NEXT EVENT" title="下一站" action={nextEventCard.statusLabelZh} /><button className={styles.nextEvent} onClick={() => openEvent(nextEventCard.slug)}><span>武</span><div><strong>{nextEventCard.nameZh}</strong><small>{nextEventCard.nameEn}</small><p>{formatDateRange(nextEventCard.startDate, nextEventCard.endDate)} · {nextEventCard.cityZh}</p></div><em>›</em></button></section> : null}

            <section className={styles.card}>
              <SectionHeader eyebrow="WORLD RANKING" title="世界排名" action="TOP 16" />
              <div className={styles.rankingList}>{rankingRows.slice(0, 6).map((row) => <button key={row.rank} onClick={() => openPlayer(row.player.id)}><strong>{row.rank}</strong><PlayerAvatar player={row.player} size="sm" /><span><b>{row.player.nameZh}</b><small>{row.player.nameEn}</small></span><em>{row.points.toLocaleString("en-GB")}</em></button>)}</div>
              <button className={styles.fullButton} onClick={() => changeView("data")}>查看完整世界排名</button>
            </section>

            <section className={styles.card}><SectionHeader eyebrow="CHINA TOP 16" title="中国球员" action={`${chinaTop16.length} 人进入 TOP16`} /><div className={styles.chinaTopGrid}>{chinaTop16.map((row) => <button key={row.player.id} onClick={() => openPlayer(row.player.id)}><span>{row.rank}</span><strong>{row.player.nameZh}</strong><small>世界第 {row.rank}</small></button>)}</div></section>
          </> : null}

          {activeView === "matches" ? <>
            <section className={styles.pageIntro}><small>TOURNAMENTS</small><h1>赛事</h1><p>优先看刚结束、正在进行和下一站；需要查看整个 2026/27 赛季时，再切换到“赛季赛历”。</p></section>
            <div className={priority.eventModeTabs}>
              <button className={eventListMode === "recent" ? priority.eventModeActive : ""} onClick={() => setEventListMode("recent")}>近期赛事</button>
              <button className={eventListMode === "calendar" ? priority.eventModeActive : ""} onClick={() => setEventListMode("calendar")}>赛季赛历</button>
            </div>

            {eventListMode === "recent" ? <>
              <section className={styles.currentEventBanner} onClick={() => openEvent(currentEventCard.slug, "schedule")}>
                <div><StatusPill status="live" label="当前赛事" /><small>{currentEventCard.typeZh}</small></div>
                <h2>{currentEventCard.nameZh}</h2><p>{formatDateRange(currentEventCard.startDate, currentEventCard.endDate)} · {currentEventCard.cityZh}</p><span>查看赛事 ›</span>
              </section>
              <section className={styles.card}>
                <SectionHeader title="近期赛事" action="下一站 / 最近结束" />
                <div className={styles.calendarList}>{recentSecondaryEvents.map((item) => <CalendarCard key={item.id} item={item} onOpen={() => openEvent(item.slug)} />)}</div>
              </section>
            </> : <section className={styles.card}>
              <SectionHeader eyebrow="2026/27 SEASON" title="赛季赛历" action="按时间顺序" />
              <div className={priority.calendarStaticList}>{seasonCalendar.map((item) => <CalendarCard key={item.id} item={item} interactive={false} />)}</div>
            </section>}
          </> : null}

          {activeView === "players" ? <>
            <section className={styles.pageIntro}><small>PLAYER DIRECTORY</small><h1>球员</h1><p>球员页只保留目录与搜索。点击任意球员后，再进入独立球员详情查看资料、排名和比赛记录。</p></section>
            <section className={styles.card}>
              <div className={styles.searchBox}><span>⌕</span><input value={playerQuery} onChange={(event) => setPlayerQuery(event.target.value)} placeholder="搜索中文名 / 英文名" /></div>
              <div className={styles.playerFilters}>{playerFilters.map((filter) => <button key={filter} className={playerFilter === filter ? styles.filterActive : ""} onClick={() => setPlayerFilter(filter)}>{filter}</button>)}</div>
              <div className={styles.playerDirectory}>{filteredPlayers.map((player) => <button key={player.id} onClick={() => openPlayer(player.id)}><PlayerAvatar player={player} size="md" /><span><strong>{player.nameZh}</strong><small>{player.nameEn} · {player.nationalityZh}</small></span><b>{player.currentRank ? `#${player.currentRank}` : "—"}</b><em>›</em></button>)}</div>
            </section>
          </> : null}

          {activeView === "data" ? <>
            <section className={styles.pageIntro}><small>GLOBAL DATA</small><h1>数据</h1><p>这里仅放跨赛事、跨赛季的数据。单站赛事统计放在各赛事自己的“赛事数据”页。</p></section>
            <section className={styles.card}><SectionHeader eyebrow="WORLD RANKING" title="世界排名 TOP16" /><div className={styles.rankingList}>{rankingRows.map((row) => <button key={row.rank} onClick={() => openPlayer(row.player.id)}><strong>{row.rank}</strong><PlayerAvatar player={row.player} size="sm" /><span><b>{row.player.nameZh}</b><small>{row.player.nameEn} · {row.player.nationalityZh}</small></span><em>{row.points.toLocaleString("en-GB")}</em></button>)}</div></section>
            <section className={styles.card}><SectionHeader eyebrow="COMING NEXT" title="数据专题" /><div className={styles.futureGrid}><article><small>HEAD TO HEAD</small><strong>交手记录</strong><span>正在接入</span></article><article><small>CENTURIES</small><strong>破百榜</strong><span>正在接入</span></article><article><small>DECIDERS</small><strong>决胜局</strong><span>正在接入</span></article><article><small>TITLES</small><strong>冠军榜</strong><span>正在接入</span></article></div></section>
          </> : null}
        </div>

        <nav className={styles.bottomNav}>{navItems.map((item) => <button key={item.id} className={activeView === item.id ? styles.activeNav : ""} onClick={() => changeView(item.id)}><span>{item.icon}</span><b>{item.label}</b></button>)}</nav>
        <span className={styles.buildMark}>{buildMark}</span>
      </div>
    </main>
  );
}
