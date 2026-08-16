"use client";

import { useEffect, useMemo, useState } from "react";
import styles from "./snooker.module.css";
import {
  chinesePlayers,
  currentEvent,
  liveFallback,
  nextEvent,
  rankings,
  recentMatches,
  sourceSnapshot,
  type SnookerView,
} from "@/lib/snooker/poc-data";

type ThemeName = "green" | "red";

type SourceResponse = {
  ok?: boolean;
  fetchedAt?: string;
  latencyMs?: number;
  eventDetected?: boolean;
  liveMatch?: null | {
    player1En: string;
    player1Zh: string;
    player1Rank: number;
    player1Score: number;
    player2En: string;
    player2Zh: string;
    player2Rank: number;
    player2Score: number;
    frames?: string[];
  };
};

const navItems: Array<{ id: SnookerView; label: string; icon: string }> = [
  { id: "home", label: "首页", icon: "⌂" },
  { id: "matches", label: "比赛", icon: "◫" },
  { id: "players", label: "球员", icon: "◎" },
  { id: "data", label: "数据", icon: "▥" },
];

function points(value: number) {
  return value.toLocaleString("en-GB");
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function SectionHeader({ eyebrow, title, action }: { eyebrow?: string; title: string; action?: string }) {
  return (
    <div className={styles.sectionHeader}>
      <div>{eyebrow ? <small>{eyebrow}</small> : null}<h2>{title}</h2></div>
      {action ? <span>{action} ›</span> : null}
    </div>
  );
}

function RankingList({ limit }: { limit?: number }) {
  return (
    <div className={styles.rankingList}>
      {rankings.slice(0, limit ?? rankings.length).map((player) => (
        <div className={styles.rankingRow} key={player.rank}>
          <strong className={styles.rankNumber}>{player.rank}</strong>
          <span className={`${styles.miniAvatar} ${player.isChinese ? styles.chinaAvatar : ""}`}>{initials(player.nameEn)}</span>
          <div className={styles.playerName}>
            <b>{player.nameZh}</b>
            <small>{player.nameEn} · {player.nationality}</small>
          </div>
          <b className={styles.rankPoints}>{points(player.points)}</b>
        </div>
      ))}
    </div>
  );
}

export default function SnookerPoc() {
  const [activeView, setActiveView] = useState<SnookerView>("home");
  const [theme, setTheme] = useState<ThemeName>("green");
  const [sourceState, setSourceState] = useState<"checking" | "online" | "fallback">("checking");
  const [lastCheckedAt, setLastCheckedAt] = useState<string>(sourceSnapshot.capturedAt);
  const [liveMatch, setLiveMatch] = useState(liveFallback);
  const [query, setQuery] = useState("");

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem("snooker-poc-theme");
      if (saved === "red" || saved === "green") setTheme(saved);
    } catch {
      // POC theme persistence is optional.
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    const refresh = async () => {
      try {
        const response = await fetch("/api/snooker/poc-source", { cache: "no-store" });
        const data = await response.json() as SourceResponse;
        if (cancelled) return;
        setLastCheckedAt(data.fetchedAt || new Date().toISOString());
        if (response.ok && data.ok && data.eventDetected) {
          setSourceState("online");
          const nextLive = data.liveMatch;
          if (nextLive) {
            setLiveMatch((current) => ({
              ...current,
              ...nextLive,
              frames: nextLive.frames?.length ? nextLive.frames : current.frames,
            }));
          }
        } else {
          setSourceState("fallback");
        }
      } catch {
        if (!cancelled) setSourceState("fallback");
      }
    };

    void refresh();
    const timer = window.setInterval(refresh, 30_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  const filteredPlayers = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return rankings;
    return rankings.filter((player) =>
      `${player.nameZh} ${player.nameEn} ${player.nationality}`.toLowerCase().includes(needle)
    );
  }, [query]);

  const chooseTheme = (nextTheme: ThemeName) => {
    setTheme(nextTheme);
    try {
      window.localStorage.setItem("snooker-poc-theme", nextTheme);
    } catch {
      // Ignore storage failures.
    }
  };

  const changeView = (view: SnookerView) => {
    setActiveView(view);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const sourceLabel = sourceState === "online" ? "数据源在线" : sourceState === "fallback" ? "使用最近快照" : "正在校验数据源";
  const checkedTime = new Date(lastCheckedAt).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Shanghai" });

  return (
    <main className={styles.appRoot} data-theme={theme}>
      <div className={styles.shell}>
        <header className={styles.header}>
          <button className={styles.brand} onClick={() => changeView("home")} aria-label="返回斯诺克数据中心首页">
            <span>S</span>
            <div><strong>世界斯诺克数据中心</strong><small>WORLD SNOOKER DATA · POC</small></div>
          </button>
          <div className={styles.themeSwitch} aria-label="主题色预览">
            <button className={theme === "green" ? styles.activeTheme : ""} onClick={() => chooseTheme("green")}>绿</button>
            <button className={theme === "red" ? styles.activeTheme : ""} onClick={() => chooseTheme("red")}>红</button>
          </div>
        </header>

        <div className={styles.content}>
          {activeView === "home" ? (
            <>
              <section className={styles.hero}>
                <div className={styles.heroTop}><span className={styles.liveDot}>LIVE</span><span>{currentEvent.type}</span></div>
                <small>CURRENT TOURNAMENT</small>
                <h1>{currentEvent.nameZh}</h1>
                <p>{currentEvent.dates} · {currentEvent.country} {currentEvent.city}</p>
                <div className={styles.heroActions}>
                  <button onClick={() => changeView("matches")}>查看比赛</button>
                  <button className={styles.secondaryButton} onClick={() => changeView("data")}>赛事数据</button>
                </div>
              </section>

              <section className={styles.card}>
                <div className={styles.liveHeader}>
                  <div><small>{liveMatch.round}</small><h2>中国公开赛 · 决赛</h2></div>
                  <span className={styles.liveBadge}>{liveMatch.status}</span>
                </div>
                <div className={styles.scoreBoard}>
                  <div className={styles.scorePlayer}>
                    <span className={styles.avatar}>{initials(liveMatch.player1En)}</span>
                    <div><strong>{liveMatch.player1Zh}</strong><small>{liveMatch.player1En} · #{liveMatch.player1Rank}</small></div>
                    <b>{liveMatch.player1Score}</b>
                  </div>
                  <div className={styles.scorePlayer}>
                    <span className={styles.avatar}>{initials(liveMatch.player2En)}</span>
                    <div><strong>{liveMatch.player2Zh}</strong><small>{liveMatch.player2En} · #{liveMatch.player2Rank}</small></div>
                    <b>{liveMatch.player2Score}</b>
                  </div>
                </div>
                <div className={styles.sessionBar}><span>{liveMatch.sessionLabel}</span><b>先到 10 局获胜</b></div>
                <div className={styles.frames}>
                  {liveMatch.frames.slice(-7).map((frame, index) => <span key={`${frame}-${index}`}>第{Math.max(1, liveMatch.frames.length - 6 + index)}局 <b>{frame}</b></span>)}
                </div>
                <div className={styles.sourceLine}>
                  <span className={sourceState === "online" ? styles.sourceOnline : styles.sourceWaiting} />
                  <b>{sourceLabel}</b>
                  <small>snooker.org · POC 30秒检查 · {checkedTime}</small>
                </div>
              </section>

              <section className={styles.card}>
                <SectionHeader eyebrow="NEXT EVENT" title="下一站" action="完整赛历" />
                <div className={styles.eventRow}>
                  <div className={styles.eventMark}>武</div>
                  <div><strong>{nextEvent.nameZh}</strong><small>{nextEvent.nameEn}</small><p>{nextEvent.dates} · {nextEvent.country} {nextEvent.city}</p></div>
                  <span>7天后</span>
                </div>
              </section>

              <section className={styles.card}>
                <SectionHeader eyebrow="WORLD RANKING" title="世界排名" action="TOP 16" />
                <RankingList limit={6} />
                <button className={styles.fullButton} onClick={() => changeView("data")}>查看完整世界排名</button>
              </section>

              <section className={styles.card}>
                <SectionHeader eyebrow="CHINA WATCH" title="中国球员" action="共 5 人进入 TOP 16" />
                <div className={styles.chinaGrid}>
                  {chinesePlayers.map((player) => (
                    <div key={player.rank}>
                      <span>{player.rank}</span>
                      <strong>{player.nameZh}</strong>
                      <small>世界第 {player.rank}</small>
                    </div>
                  ))}
                </div>
              </section>
            </>
          ) : null}

          {activeView === "matches" ? (
            <>
              <section className={styles.pageIntro}><small>MATCH CENTRE</small><h1>比赛</h1><p>实时比分、本站赛程和完整赛事入口集中在这里。底部一级导航只保留 4 项，“赛事”并入比赛中心。</p></section>
              <section className={styles.card}>
                <div className={styles.subTabs}><button className={styles.selectedSubTab}>今日</button><button>本站</button><button>赛事</button></div>
                <SectionHeader title="今日焦点" />
                <div className={styles.matchCard}>
                  <div className={styles.matchMeta}><span className={styles.liveBadge}>{liveMatch.status}</span><small>14:00 / 19:30 · 决赛</small></div>
                  <div><span>{liveMatch.player1Zh}</span><b>{liveMatch.player1Score}</b></div>
                  <div><span>{liveMatch.player2Zh}</span><b>{liveMatch.player2Score}</b></div>
                  <p>19局10胜 · 第二阶段 {liveMatch.sessionLabel.replace("第二阶段 ", "")}</p>
                </div>
              </section>
              <section className={styles.card}>
                <SectionHeader eyebrow="CHINA OPEN" title="最近结果" />
                <div className={styles.resultsList}>
                  {recentMatches.map((match, index) => (
                    <div key={`${match.round}-${index}`}>
                      <small>{match.round}</small>
                      <p><span>{match.player1Zh}</span><b>{match.score1}</b><i>:</i><b>{match.score2}</b><span>{match.player2Zh}</span></p>
                    </div>
                  ))}
                </div>
              </section>
              <section className={styles.card}>
                <SectionHeader eyebrow="TOURNAMENT" title="赛事入口" />
                <div className={styles.tournamentCards}>
                  <article><span>进行中</span><strong>{currentEvent.nameZh}</strong><small>{currentEvent.dates} · {currentEvent.city}</small><p>赛程 · 签表 · 结果 · 数据</p></article>
                  <article><span className={styles.upcoming}>即将开始</span><strong>{nextEvent.nameZh}</strong><small>{nextEvent.dates} · {nextEvent.city}</small><p>赛历已建立，赛程持续同步</p></article>
                </div>
              </section>
            </>
          ) : null}

          {activeView === "players" ? (
            <>
              <section className={styles.pageIntro}><small>PLAYER DATABASE</small><h1>球员</h1><p>中文名与英文标准名作为独立主数据维护。POC 先用字母头像，正式版验证头像授权与稳定地址后再替换。</p></section>
              <section className={styles.card}>
                <label className={styles.searchBox}><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索中文名 / 英文名" /></label>
                <div className={styles.playerDirectory}>
                  {filteredPlayers.map((player) => (
                    <div key={player.rank}>
                      <span className={`${styles.avatar} ${player.isChinese ? styles.chinaAvatar : ""}`}>{initials(player.nameEn)}</span>
                      <div><strong>{player.nameZh}</strong><small>{player.nameEn}</small><p>{player.nationality} · 世界第 {player.rank}</p></div>
                      <b>#{player.rank}</b>
                    </div>
                  ))}
                </div>
              </section>
            </>
          ) : null}

          {activeView === "data" ? (
            <>
              <section className={styles.pageIntro}><small>DATA CENTRE</small><h1>数据</h1><p>第一阶段先把世界排名和中国球员做准确；历史比赛、H2H、破百和冠军统计在数据底座稳定后继续接入。</p></section>
              <section className={styles.metricGrid}>
                <article><small>已接入</small><strong>TOP 16</strong><span>世界排名</span></article>
                <article><small>已接入</small><strong>5</strong><span>中国 TOP16</span></article>
                <article><small>下一阶段</small><strong>H2H</strong><span>历史交手</span></article>
                <article><small>下一阶段</small><strong>100+</strong><span>破百统计</span></article>
              </section>
              <section className={styles.card}>
                <SectionHeader eyebrow="RANKING" title="世界排名 TOP 16" />
                <RankingList />
                <p className={styles.dataNote}>POC 排名快照来自 snooker.org，当前页面显示的是中国公开赛期间可获取的最新排名数据。</p>
              </section>
            </>
          ) : null}
        </div>

        <nav className={styles.bottomNav} aria-label="斯诺克数据中心主导航">
          {navItems.map((item) => (
            <button className={activeView === item.id ? styles.activeNav : ""} onClick={() => changeView(item.id)} key={item.id}>
              <span>{item.icon}</span><b>{item.label}</b>
            </button>
          ))}
        </nav>
      </div>
    </main>
  );
}
