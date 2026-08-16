"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { PlayerEventStats, SnookerDashboardSnapshot, SnookerEvent, SnookerMatch, SnookerPlayer } from "@/lib/snooker/domain";
import styles from "./snooker-data-center.module.css";

type View = "home" | "matches" | "players" | "data";
type Theme = "green" | "red";
type PlayerFilter = "event" | "china" | "top16";

type SourceHealth = {
  online: boolean;
  accepted: boolean;
  source: string;
  fetchedAt: string;
  latencyMs: number;
  parsedRoundCount: number;
  parsedMatchCount: number;
  overlayCount: number;
  message: string;
};

type DashboardResponse = {
  ok?: boolean;
  snapshot?: SnookerDashboardSnapshot;
  sourceHealth?: SourceHealth;
};

const navItems: Array<{ id: View; label: string; icon: string }> = [
  { id: "home", label: "首页", icon: "⌂" },
  { id: "matches", label: "比赛", icon: "◫" },
  { id: "players", label: "球员", icon: "◎" },
  { id: "data", label: "数据", icon: "▥" },
];

const nextEvent = {
  nameZh: "2026武汉公开赛",
  nameEn: "Wuhan Open 2026",
  dates: "8月23日开始",
  city: "武汉",
};

function money(value: number) {
  return `£${value.toLocaleString("en-GB")}`;
}

function points(value: number | null) {
  return value === null ? "—" : value.toLocaleString("en-GB");
}

function initials(name: string) {
  return name.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase();
}

function playerMap(snapshot: SnookerDashboardSnapshot) {
  return new Map(snapshot.players.map((player) => [player.id, player]));
}

function allMatches(event: SnookerEvent) {
  return event.rounds.flatMap((round) => round.matches);
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
  const isActive = matches.some((match) => match.status === "live" || match.status === "session-break" || match.status === "upcoming");
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
    isActive,
    matches,
  };
}

function PlayerAvatar({ player, size = "md" }: { player: SnookerPlayer; size?: "sm" | "md" | "lg" }) {
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

function SectionHeader({ eyebrow, title, action }: { eyebrow?: string; title: string; action?: string }) {
  return (
    <div className={styles.sectionHeader}>
      <div>{eyebrow ? <small>{eyebrow}</small> : null}<h2>{title}</h2></div>
      {action ? <span>{action}</span> : null}
    </div>
  );
}

function ScoreRows({ match, players }: { match: SnookerMatch; players: Map<string, SnookerPlayer> }) {
  const p1 = players.get(match.player1Id)!;
  const p2 = players.get(match.player2Id)!;
  return (
    <div className={styles.scoreRows}>
      <div><PlayerAvatar player={p1} /><span><b>{p1.nameZh}</b><small>{p1.nameEn} · {p1.currentRank ? `#${p1.currentRank}` : "外卡"}</small></span><strong>{match.status === "walkover" ? "W" : match.score1 ?? "-"}</strong></div>
      <div><PlayerAvatar player={p2} /><span><b>{p2.nameZh}</b><small>{p2.nameEn} · {p2.currentRank ? `#${p2.currentRank}` : "外卡"}</small></span><strong>{match.status === "walkover" ? "O" : match.score2 ?? "-"}</strong></div>
    </div>
  );
}

export default function SnookerDataCenter({ initialSnapshot, buildMark }: { initialSnapshot: SnookerDashboardSnapshot; buildMark: string }) {
  const router = useRouter();
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [activeView, setActiveView] = useState<View>("home");
  const [theme, setTheme] = useState<Theme>("green");
  const [sourceHealth, setSourceHealth] = useState<SourceHealth | null>(null);
  const [selectedRoundKey, setSelectedRoundKey] = useState("final");
  const [selectedMatchId, setSelectedMatchId] = useState("co26-final-1");
  const [playerFilter, setPlayerFilter] = useState<PlayerFilter>("event");
  const [playerQuery, setPlayerQuery] = useState("");
  const [selectedPlayerId, setSelectedPlayerId] = useState("p-zhao-xintong");

  useEffect(() => {
    try {
      const requested = new URLSearchParams(window.location.search).get("view");
      if (requested === "matches" || requested === "data" || requested === "home") setActiveView(requested);
      const savedTheme = window.localStorage.getItem("snooker-data-theme");
      if (savedTheme === "green" || savedTheme === "red") setTheme(savedTheme);
    } catch {
      // URL/theme hydration is optional.
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const refresh = async () => {
      try {
        const response = await fetch("/api/snooker/v1/dashboard", { cache: "no-store" });
        const data = await response.json() as DashboardResponse;
        if (cancelled) return;
        if (response.ok && data.ok && data.snapshot) setSnapshot(data.snapshot);
        if (data.sourceHealth) setSourceHealth(data.sourceHealth);
      } catch {
        if (!cancelled) setSourceHealth(null);
      }
    };
    void refresh();
    const timer = window.setInterval(refresh, 30_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  const players = useMemo(() => playerMap(snapshot), [snapshot]);
  const event = snapshot.event;
  const eventMatches = useMemo(() => allMatches(event), [event]);
  const eventPlayerIds = useMemo(() => Array.from(new Set(eventMatches.flatMap((match) => [match.player1Id, match.player2Id]))), [eventMatches]);
  const eventPlayers = useMemo(() => eventPlayerIds.map((id) => players.get(id)!).filter(Boolean).sort((a, b) => (a.currentRank ?? 999) - (b.currentRank ?? 999)), [eventPlayerIds, players]);
  const chinaEventPlayers = useMemo(() => eventPlayers.filter((player) => player.countryCode === "CHN"), [eventPlayers]);
  const completedCount = eventMatches.filter((match) => match.status === "completed" || match.status === "walkover").length;
  const finalMatch = event.rounds.find((round) => round.key === "final")!.matches[0];
  const selectedRound = event.rounds.find((round) => round.key === selectedRoundKey) ?? event.rounds[0];
  const selectedMatch = eventMatches.find((match) => match.id === selectedMatchId) ?? selectedRound.matches[0];
  const selectedPlayer = players.get(selectedPlayerId) ?? eventPlayers[0];
  const selectedPlayerStats = selectedPlayer ? currentEventStats(selectedPlayer.id, event) : null;

  const filteredPlayers = useMemo(() => {
    const needle = playerQuery.trim().toLowerCase();
    return eventPlayers.filter((player) => {
      if (playerFilter === "china" && player.countryCode !== "CHN") return false;
      if (playerFilter === "top16" && (player.currentRank === null || player.currentRank > 16)) return false;
      if (!needle) return true;
      return `${player.nameZh} ${player.shortNameZh} ${player.nameEn} ${player.nationalityZh}`.toLowerCase().includes(needle);
    });
  }, [eventPlayers, playerFilter, playerQuery]);

  const rankingRows = useMemo(() => snapshot.rankings.map((row) => ({ ...row, player: players.get(row.playerId)! })).filter((row) => row.player), [snapshot.rankings, players]);
  const chinaStats = useMemo(() => chinaEventPlayers.map((player) => ({ player, stats: currentEventStats(player.id, event)! })).sort((a, b) => event.rounds.findIndex((r) => r.key === a.stats.bestRoundKey) - event.rounds.findIndex((r) => r.key === b.stats.bestRoundKey)), [chinaEventPlayers, event]);

  const changeView = (view: View) => {
    if (view === "players") {
      router.push("/snooker/players");
      return;
    }
    setActiveView(view);
    try {
      window.history.replaceState(null, "", view === "home" ? "/snooker" : `/snooker?view=${view}`);
    } catch {
      // URL state is optional.
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const chooseTheme = (nextTheme: Theme) => {
    setTheme(nextTheme);
    try {
      window.localStorage.setItem("snooker-data-theme", nextTheme);
    } catch {
      // Theme persistence is optional.
    }
  };

  const chooseRound = (key: string) => {
    const round = event.rounds.find((item) => item.key === key);
    setSelectedRoundKey(key);
    if (round?.matches[0]) setSelectedMatchId(round.matches[0].id);
  };

  const sourceLabel = sourceHealth?.accepted ? "实时源已覆盖" : sourceHealth?.online ? "实时源校验中" : sourceHealth === null ? "已验证快照" : "已验证快照 · 实时源暂离线";
  const updatedTime = new Date(event.snapshotAt).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Shanghai" });

  return (
    <main className={styles.appRoot} data-theme={theme}>
      <div className={styles.shell}>
        <header className={styles.header}>
          <button className={styles.brand} onClick={() => changeView("home")} aria-label="返回首页">
            <span>S</span>
            <div><strong>世界斯诺克数据中心</strong><small>WORLD SNOOKER DATA</small></div>
          </button>
          <div className={styles.headerRight}>
            <span className={styles.versionBadge}>DATA v0.3</span>
            <div className={styles.themeSwitch}>
              <button className={theme === "green" ? styles.themeActive : ""} onClick={() => chooseTheme("green")}>绿</button>
              <button className={theme === "red" ? styles.themeActive : ""} onClick={() => chooseTheme("red")}>红</button>
            </div>
          </div>
        </header>

        <div className={styles.content}>
          {activeView === "home" ? (
            <>
              <section className={styles.hero}>
                <div className={styles.heroMeta}><span>{event.statusLabelZh}</span><b>{event.typeZh}</b></div>
                <small>CURRENT TOURNAMENT</small>
                <h1>{event.nameZh}</h1>
                <p>{event.startDate.slice(5).replace("-", ".")}—{event.endDate.slice(5).replace("-", ".")} · {event.countryZh} {event.cityZh}</p>
                <div className={styles.heroButtons}><button onClick={() => changeView("matches")}>完整赛事</button><button onClick={() => changeView("data")}>数据中心</button></div>
              </section>

              <section className={styles.foundationBanner}>
                <span className={styles.foundationIcon}>✓</span>
                <div><b>中国公开赛完整数据已接入</b><small>33场主赛 · 34名球员 · 6个轮次，首屏不依赖外部实时接口</small></div>
                <button onClick={() => changeView("matches")}>查看</button>
              </section>

              <section className={styles.card}>
                <div className={styles.liveHeader}>
                  <div><small>FINAL · 19局10胜</small><h2>决赛</h2></div>
                  <span className={styles.statusPill}>{finalMatch.statusLabelZh}</span>
                </div>
                <ScoreRows match={finalMatch} players={players} />
                {finalMatch.frames?.length ? (
                  <div className={styles.frameStrip}>
                    {finalMatch.frames.map((frame) => <span key={frame.frameNo}>第{frame.frameNo}局 <b>{frame.score1}:{frame.score2}</b></span>)}
                  </div>
                ) : null}
                <div className={styles.sourceLine}><span className={sourceHealth?.accepted ? styles.dotLive : styles.dotSnapshot} /><b>{sourceLabel}</b><small>更新 {updatedTime} · 每30秒检查</small></div>
              </section>

              <section className={styles.metricGrid}>
                <article><small>MAIN DRAW</small><strong>33</strong><span>主赛场次</span></article>
                <article><small>PLAYERS</small><strong>34</strong><span>参赛球员</span></article>
                <article><small>CHINA</small><strong>{chinaEventPlayers.length}</strong><span>中国球员</span></article>
                <article><small>COMPLETED</small><strong>{completedCount}</strong><span>已完成</span></article>
              </section>

              <section className={styles.card}>
                <SectionHeader eyebrow="NEXT EVENT" title="下一站" action="赛历" />
                <div className={styles.nextEvent}><span>武</span><div><b>{nextEvent.nameZh}</b><small>{nextEvent.nameEn}</small><p>{nextEvent.dates} · {nextEvent.city}</p></div><i>即将开始</i></div>
              </section>

              <section className={styles.card}>
                <SectionHeader eyebrow="WORLD RANKING" title="世界排名" action="TOP 6" />
                <div className={styles.rankingList}>
                  {rankingRows.slice(0, 6).map(({ rank, points: total, player }) => (
                    <button key={rank} onClick={() => router.push(`/snooker/players/${player.slug}`)}>
                      <strong>{rank}</strong><PlayerAvatar player={player} size="sm" /><span><b>{player.nameZh}</b><small>{player.nameEn}</small></span><em>{points(total)}</em>
                    </button>
                  ))}
                </div>
                <button className={styles.fullButton} onClick={() => changeView("data")}>查看完整 TOP 16</button>
              </section>
            </>
          ) : null}

          {activeView === "matches" ? (
            <>
              <section className={styles.pageIntro}><small>MATCH CENTRE</small><h1>比赛</h1><p>完整赛事作为本地已验证快照直接加载，实时源只做增量覆盖，不再因为接口异常而消失。</p></section>

              <section className={styles.eventOverview}>
                <div><span>{event.statusLabelZh}</span><small>{event.typeZh} · {event.season}</small></div>
                <h2>{event.nameZh}</h2>
                <p>{event.countryZh} · {event.cityZh} · {event.venueZh}</p>
                <div className={styles.eventFacts}>
                  <span><small>冠军奖金</small><b>{money(event.winnerPrize)}</b></span>
                  <span><small>亚军奖金</small><b>{money(event.runnerUpPrize)}</b></span>
                  <span><small>上届冠军</small><b>{event.previousChampionZh}</b></span>
                  <span><small>决赛裁判</small><b>{event.refereeZh ?? "—"}</b></span>
                </div>
              </section>

              <section className={styles.card}>
                <SectionHeader eyebrow="CHINA OPEN · MAIN DRAW" title="完整主赛" action={`${eventMatches.length} 场 · ${event.rounds.length} 轮`} />
                <div className={styles.roundTabs}>
                  {event.rounds.map((round) => <button className={selectedRoundKey === round.key ? styles.roundActive : ""} onClick={() => chooseRound(round.key)} key={round.key}>{round.labelZh}<small>{round.matches.length}</small></button>)}
                </div>
                <div className={styles.matchList}>
                  {selectedRound.matches.map((match) => {
                    const p1 = players.get(match.player1Id)!;
                    const p2 = players.get(match.player2Id)!;
                    return (
                      <button className={selectedMatch.id === match.id ? styles.matchSelected : ""} key={match.id} onClick={() => setSelectedMatchId(match.id)}>
                        <small>第{match.matchNo}场 · {match.bestOf}局{Math.floor(match.bestOf / 2) + 1}胜</small>
                        <p><span>{p1.nameZh}</span><b>{match.status === "walkover" ? "W" : match.score1 ?? "-"}</b><i>:</i><b>{match.status === "walkover" ? "O" : match.score2 ?? "-"}</b><span>{p2.nameZh}</span></p>
                        <em>{match.statusLabelZh}</em>
                      </button>
                    );
                  })}
                </div>
              </section>

              <section className={styles.card}>
                <SectionHeader eyebrow="MATCH DETAIL" title={`${selectedMatch.roundLabelZh} · 第${selectedMatch.matchNo}场`} action={selectedMatch.statusLabelZh} />
                <ScoreRows match={selectedMatch} players={players} />
                {selectedMatch.frames?.length ? (
                  <div className={styles.frameTable}>
                    {selectedMatch.frames.map((frame) => <div key={frame.frameNo}><span>第 {frame.frameNo} 局</span><b>{frame.score1}</b><i>:</i><b>{frame.score2}</b><small>{frame.note ?? ""}</small></div>)}
                  </div>
                ) : <p className={styles.emptyDetail}>当前数据源提供总比分；逐局数据会在可用时自动补充。</p>}
                {selectedMatch.note ? <p className={styles.matchNote}>{selectedMatch.note}</p> : null}
              </section>
            </>
          ) : null}

          {activeView === "players" ? (
            <>
              <section className={styles.pageIntro}><small>PLAYER DATABASE</small><h1>球员</h1><p>本届赛事 34 名球员已进入统一主数据；中文名、英文名、排名与赛事战绩都按同一 player_id 对应。</p></section>

              {selectedPlayer ? (
                <section className={styles.playerProfile}>
                  <div className={styles.profileTop}><PlayerAvatar player={selectedPlayer} size="lg" /><div><span>{selectedPlayer.countryCode === "CHN" ? "🇨🇳 中国球员" : selectedPlayer.nationalityZh}</span><h2>{selectedPlayer.nameZh}</h2><p>{selectedPlayer.nameEn}</p></div><b>{selectedPlayer.currentRank ? `#${selectedPlayer.currentRank}` : "WC"}</b></div>
                  <div className={styles.profileMetrics}>
                    <span><small>世界排名</small><b>{selectedPlayer.currentRank ?? "—"}</b></span>
                    <span><small>本届最佳</small><b>{selectedPlayerStats?.bestRoundLabelZh ?? "—"}</b></span>
                    <span><small>本届胜负</small><b>{selectedPlayerStats ? `${selectedPlayerStats.wins}-${selectedPlayerStats.losses}` : "—"}</b></span>
                    <span><small>局分</small><b>{selectedPlayerStats ? `${selectedPlayerStats.frameWins}-${selectedPlayerStats.frameLosses}` : "—"}</b></span>
                  </div>
                  {selectedPlayerStats ? (
                    <div className={styles.profileMatches}>{selectedPlayerStats.matches.map((match) => {
                      const opponentId = match.player1Id === selectedPlayer.id ? match.player2Id : match.player1Id;
                      const opponent = players.get(opponentId)!;
                      const selfScore = match.player1Id === selectedPlayer.id ? match.score1 : match.score2;
                      const opponentScore = match.player1Id === selectedPlayer.id ? match.score2 : match.score1;
                      return <div key={match.id}><small>{match.roundLabelZh}</small><span>vs {opponent.nameZh}</span><b>{match.status === "walkover" ? match.statusLabelZh : `${selfScore ?? "-"}:${opponentScore ?? "-"}`}</b></div>;
                    })}</div>
                  ) : null}
                  {selectedPlayer.avatar ? <a className={styles.photoCredit} href={selectedPlayer.avatar.sourcePage} target="_blank" rel="noreferrer">头像：{selectedPlayer.avatar.credit} · {selectedPlayer.avatar.license} · Wikimedia Commons</a> : <small className={styles.photoPending}>暂未接入可确认授权的头像，使用字母头像。</small>}
                </section>
              ) : null}

              <section className={styles.card}>
                <div className={styles.playerToolbar}>
                  <label><span>⌕</span><input value={playerQuery} onChange={(event) => setPlayerQuery(event.target.value)} placeholder="搜索中文名 / 英文名" /></label>
                  <div>{([['event','本站 34'],['china',`中国 ${chinaEventPlayers.length}`],['top16','TOP 16']] as Array<[PlayerFilter,string]>).map(([id,label]) => <button className={playerFilter === id ? styles.filterActive : ""} onClick={() => setPlayerFilter(id)} key={id}>{label}</button>)}</div>
                </div>
                <div className={styles.playerDirectory}>
                  {filteredPlayers.map((player) => {
                    const stats = currentEventStats(player.id, event);
                    return <button className={selectedPlayer?.id === player.id ? styles.playerSelected : ""} key={player.id} onClick={() => { setSelectedPlayerId(player.id); window.scrollTo({ top: 0, behavior: "smooth" }); }}><PlayerAvatar player={player} /><span><b>{player.nameZh}</b><small>{player.nameEn} · {player.nationalityZh}</small><em>{stats ? `${stats.bestRoundLabelZh} · ${stats.wins}胜${stats.losses}负` : ""}</em></span><strong>{player.currentRank ? `#${player.currentRank}` : "WC"}</strong></button>;
                  })}
                </div>
              </section>
            </>
          ) : null}

          {activeView === "data" ? (
            <>
              <section className={styles.pageIntro}><small>DATA CENTRE</small><h1>数据</h1><p>第一版数据中心已经从“展示排名”升级为赛事级数据底座：排名、参赛球员、轮次、比赛、局分和中国球员表现可以互相计算。</p></section>

              <section className={styles.metricGrid}>
                <article><small>EVENT</small><strong>{eventMatches.length}</strong><span>本届主赛</span></article>
                <article><small>PLAYERS</small><strong>{eventPlayers.length}</strong><span>统一球员ID</span></article>
                <article><small>CHINA</small><strong>{chinaEventPlayers.length}</strong><span>中国军团</span></article>
                <article><small>ROUNDS</small><strong>{event.rounds.length}</strong><span>完整轮次</span></article>
              </section>

              <section className={styles.card}>
                <SectionHeader eyebrow="WORLD RANKING" title="世界排名 TOP 16" action="当前快照" />
                <div className={styles.rankingList}>
                  {rankingRows.map(({ rank, points: total, player }) => <button key={rank} onClick={() => router.push(`/snooker/players/${player.slug}`)}><strong>{rank}</strong><PlayerAvatar player={player} size="sm" /><span><b>{player.nameZh}</b><small>{player.nameEn} · {player.nationalityZh}</small></span><em>{points(total)}</em></button>)}
                </div>
              </section>

              <section className={styles.card}>
                <SectionHeader eyebrow="CHINA WATCH" title="中国军团 · 本届成绩" action={`${chinaStats.length} 人`} />
                <div className={styles.chinaStats}>
                  {chinaStats.map(({ player, stats }) => <button key={player.id} onClick={() => router.push(`/snooker/players/${player.slug}`)}><PlayerAvatar player={player} size="sm" /><span><b>{player.nameZh}</b><small>世界第 {player.currentRank ?? "—"}</small></span><em>{stats.bestRoundLabelZh}</em><strong>{stats.wins}胜{stats.losses}负</strong></button>)}
                </div>
              </section>

              <section className={styles.foundationCard}>
                <div><small>DATA FOUNDATION</small><h2>数据底座状态</h2></div>
                <dl><div><dt>版本</dt><dd>{buildMark}</dd></div><div><dt>赛事主数据</dt><dd>34 名球员 / 33 场比赛</dd></div><div><dt>球员数据库</dt><dd>129 名球员 · 独立 Supabase</dd></div><div><dt>实时覆盖</dt><dd>{sourceHealth?.accepted ? `${sourceHealth.overlayCount} 场已校验` : "快照安全兜底"}</dd></div></dl>
                <p>{sourceHealth?.message ?? "页面当前由已验证赛事快照直接提供数据，球员模块由独立 Supabase 数据中心提供。"}</p>
              </section>
            </>
          ) : null}
        </div>

        <nav className={styles.bottomNav} aria-label="斯诺克数据中心主导航">
          {navItems.map((item) => <button className={activeView === item.id ? styles.navActive : ""} onClick={() => changeView(item.id)} key={item.id}><span>{item.icon}</span><b>{item.label}</b></button>)}
        </nav>
      </div>
    </main>
  );
}
