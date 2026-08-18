"use client";

import { useMemo, useState } from "react";
import type { SnookerPlayerDetail, SnookerPlayerSeasonStats } from "@/lib/snooker/player-data";
import styles from "./player.module.css";
import detailUi from "./player-detail-refresh.module.css";

function initials(name: string) {
  return name.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase();
}

function integer(value: number | null) {
  return value === null ? "—" : value.toLocaleString("en-GB");
}

function count(value: number | null | undefined) {
  return (value ?? 0).toLocaleString("en-GB");
}

function oneDecimal(value: number | null, suffix = "") {
  return value === null ? "—" : `${value.toFixed(1)}${suffix}`;
}

function winRate(value: number | null) {
  return value === null ? "—" : `${value.toFixed(1)}%`;
}

function ranking(value: number | null) {
  return value === null || value <= 0 ? "—" : `#${value}`;
}

function birthLabel(value: string | null) {
  if (!value) return "出生日期待补充";
  const [year, month, day] = value.split("-");
  return `${year}.${month}.${day}`;
}

function ageFromDob(value: string | null) {
  if (!value) return null;
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return null;
  const now = new Date();
  let age = now.getFullYear() - year;
  const beforeBirthday = now.getMonth() + 1 < month || (now.getMonth() + 1 === month && now.getDate() < day);
  if (beforeBirthday) age -= 1;
  return age;
}

function seasonMetric(season: SnookerPlayerSeasonStats, key: "matches" | "wins") {
  return key === "matches" ? integer(season.matchesPlayed) : integer(season.matchesWon);
}

type TrendMetricKey = "winRate" | "shotTime" | "averageBreak" | "centuries";

type TrendMetricDefinition = {
  key: TrendMetricKey;
  tabZh: string;
  labelZh: string;
  labelEn: string;
  read: (season: SnookerPlayerSeasonStats) => number | null;
  format: (value: number) => string;
};

const TREND_METRICS: TrendMetricDefinition[] = [
  {
    key: "winRate",
    tabZh: "胜率",
    labelZh: "比赛胜率",
    labelEn: "WIN RATE",
    read: (season) => season.matchWinRate,
    format: (value) => `${value.toFixed(1)}%`,
  },
  {
    key: "shotTime",
    tabZh: "出杆时间",
    labelZh: "平均出杆时间",
    labelEn: "SHOT TIME",
    read: (season) => season.averageShotTime,
    format: (value) => `${value.toFixed(1)}s`,
  },
  {
    key: "averageBreak",
    tabZh: "平均单杆",
    labelZh: "平均单杆",
    labelEn: "AVG BREAK",
    read: (season) => season.averageBreak,
    format: (value) => value.toFixed(1),
  },
  {
    key: "centuries",
    tabZh: "百杆数",
    labelZh: "赛季百杆数",
    labelEn: "100+ BREAKS",
    read: (season) => season.breaks100Plus,
    format: (value) => Math.round(value).toLocaleString("en-GB"),
  },
];

export function PlayerDetailContent({ player }: { player: SnookerPlayerDetail }) {
  const [seasonYear, setSeasonYear] = useState(player.seasons[0]?.seasonStartYear ?? null);
  const [trendMetric, setTrendMetric] = useState<TrendMetricKey>("winRate");
  const [bioExpanded, setBioExpanded] = useState(false);
  const [historyExpanded, setHistoryExpanded] = useState(false);
  const age = ageFromDob(player.dateOfBirth);

  const season = useMemo(
    () => player.seasons.find((item) => item.seasonStartYear === seasonYear) ?? player.seasons[0] ?? null,
    [player.seasons, seasonYear],
  );

  const trendOptions = useMemo(
    () => TREND_METRICS.map((metric) => ({
      ...metric,
      rows: player.seasons.flatMap((item) => {
        const value = metric.read(item);
        return value === null ? [] : [{ season: item, value }];
      }),
    })).filter((metric) => metric.rows.length > 0),
    [player.seasons],
  );

  const activeTrend = trendOptions.find((metric) => metric.key === trendMetric) ?? trendOptions[0] ?? null;
  const trendScaleMax = activeTrend
    ? activeTrend.key === "winRate"
      ? 100
      : Math.max(1, ...activeTrend.rows.map((row) => row.value))
    : 1;

  const bio = player.biographyZh ?? "暂无球员简介。";
  const visibleBio = bioExpanded || bio.length <= 520 ? bio : `${bio.slice(0, 520).trimEnd()}…`;
  const highlights = historyExpanded ? player.highlights : player.highlights.slice(0, 6);
  const career = player.career;

  const careerCards = [
    { en: "RANKING TITLES", zh: "排名赛冠军", value: count(career?.rankingTitles) },
    { en: "RANKING FINALS", zh: "排名赛决赛", value: count(career?.rankingFinals) },
    { en: "TRIPLE CROWN", zh: "三大赛冠军", value: count(career?.tripleCrownTitles) },
    { en: "CAREER 147s", zh: "生涯147", value: count(career?.career147s) },
  ];

  const tripleCards = [
    {
      en: "WORLD CHAMPIONSHIP",
      zh: "世锦赛",
      value: count(career?.worldChampionshipTitles),
      logo: "/snooker/triple-crown/world-championship.webp",
    },
    {
      en: "UK CHAMPIONSHIP",
      zh: "英锦赛",
      value: count(career?.ukChampionshipTitles),
      logo: "/snooker/triple-crown/uk-championship.webp",
    },
    {
      en: "THE MASTERS",
      zh: "大师赛",
      value: count(career?.mastersTitles),
      logo: "/snooker/triple-crown/masters.webp",
    },
  ];

  return (
    <>
      <section className={`${styles.playerHero} ${detailUi.heroCompact}`}>
        <span className={styles.heroGhost}>147</span>
        <div className={`${styles.heroCopy} ${detailUi.heroCopyCompact}`}>
          <small>PLAYER PROFILE</small>
          <h1>{player.nameZh}</h1>
          <p>{player.nameEn}</p>
          {player.nicknameZh ? <p className={styles.nickname}>“{player.nicknameZh}”</p> : null}
          <span className={styles.countryPill}>{player.nationalityZh ?? "国籍待补充"}</span>

          <div className={styles.heroRank}>
            <span><small>世界排名</small><strong>{ranking(player.currentRank)}</strong></span>
            <span><small>排名积分</small><b>{integer(player.rankingPoints)}</b></span>
          </div>
          <div className={styles.heroFacts}>
            <span>{birthLabel(player.dateOfBirth)}{age === null ? "" : ` · ${age}岁`}</span>
            <span>{player.turnedPro === null ? "转职业年份待补充" : `${player.turnedPro}年转为职业球员`}</span>
          </div>
        </div>
        <div className={styles.heroPortrait}>
          {player.avatarUrl ? <img src={player.avatarUrl} alt={`${player.nameZh}头像`} /> : <span className={styles.heroPortraitFallback}>{initials(player.nameEn)}</span>}
        </div>
      </section>

      <section className={styles.card}>
        <div className={styles.sectionHeader}><div><small>CAREER STATS</small><h2>生涯数据</h2></div></div>
        <div className={`${styles.careerGrid} ${detailUi.careerGridFour}`}>
          {careerCards.map((item) => (
            <article key={item.en}>
              <small>{item.en}</small>
              <strong>{item.value}</strong>
              <span>{item.zh}</span>
            </article>
          ))}
        </div>
        <div className={styles.careerRows}>
          <div><span>历史最高世界排名</span><b>{ranking(career?.highestRanking ?? null)}</b></div>
          <div><span>最近一次赛事冠军</span><b>{career?.lastTournamentWinZh ?? "—"}</b></div>
        </div>
      </section>

      <section className={styles.card}>
        <div className={styles.sectionHeader}><div><small>TRIPLE CROWN</small><h2>三大赛</h2></div><span>职业生涯冠军数</span></div>
        <div className={`${styles.tripleGrid} ${detailUi.tripleGridRefined}`}>
          {tripleCards.map((item) => (
            <article key={item.en}>
              <img className={detailUi.tripleLogo} src={item.logo} alt="" aria-hidden="true" />
              <small>{item.en}</small>
              <strong>{item.value}</strong>
              <span>{item.zh}</span>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.card}>
        <div className={styles.sectionHeader}><div><small>SEASON STATS</small><h2>赛季数据</h2></div><span>{player.seasons.length} 个赛季</span></div>
        {player.seasons.length ? (
          <>
            <div className={styles.seasonTabs}>
              {player.seasons.map((item) => (
                <button className={season?.seasonStartYear === item.seasonStartYear ? styles.seasonActive : ""} onClick={() => setSeasonYear(item.seasonStartYear)} key={item.seasonStartYear}>{item.seasonLabel}</button>
              ))}
            </div>
            {season ? (
              <>
                <div className={`${styles.seasonPrimary} ${detailUi.metricCardGrid}`}>
                  <article><small>MATCH WIN RATE</small><strong>{winRate(season.matchWinRate)}</strong><span>比赛胜率</span></article>
                  <article><small>TOURNAMENTS WON</small><strong>{integer(season.tournamentsWon)}</strong><span>赛事冠军</span></article>
                  <article><small>POINTS SCORED</small><strong>{integer(season.pointsScored)}</strong><span>总得分</span></article>
                  <article><small>AVG SHOT TIME</small><strong>{oneDecimal(season.averageShotTime, "s")}</strong><span>平均出杆时间</span></article>
                </div>
                <div className={`${styles.statList} ${detailUi.statListTwoColumn}`}>
                  <div><span>赛季排名</span><b>{ranking(season.ranking)}</b></div>
                  <div><span>比赛场次</span><b>{seasonMetric(season, "matches")}</b></div>
                  <div><span>获胜场次</span><b>{seasonMetric(season, "wins")}</b></div>
                  <div><span>50+</span><b>{integer(season.breaks50Plus)}</b></div>
                  <div><span>100+</span><b>{integer(season.breaks100Plus)}</b></div>
                  <div><span>单杆最高</span><b>{integer(season.highestBreak)}</b></div>
                  <div><span>147</span><b>{integer(season.season147s)}</b></div>
                  <div><span>平均单杆</span><b>{oneDecimal(season.averageBreak)}</b></div>
                </div>
              </>
            ) : null}
          </>
        ) : <div className={styles.emptyState}>当前暂无赛季统计。</div>}
      </section>

      {activeTrend ? (
        <section className={styles.card}>
          <div className={`${styles.sectionHeader} ${detailUi.trendHeader}`}>
            <div><small>SEASON TREND</small><h2>赛季趋势</h2></div>
            <span>{activeTrend.labelZh}</span>
          </div>
          <div className={detailUi.trendTabs} aria-label="切换赛季趋势指标">
            {trendOptions.map((metric) => (
              <button
                type="button"
                className={activeTrend.key === metric.key ? detailUi.trendTabActive : ""}
                onClick={() => setTrendMetric(metric.key)}
                key={metric.key}
              >
                {metric.tabZh}
              </button>
            ))}
          </div>
          <div className={detailUi.trendChart}>
            {activeTrend.rows.map((row) => {
              const width = Math.max(0, Math.min(100, (row.value / trendScaleMax) * 100));
              return (
                <div className={detailUi.trendRowRefined} key={`${activeTrend.key}-${row.season.seasonStartYear}`}>
                  <span>{row.season.seasonLabel}</span>
                  <div className={detailUi.trendBarRefined}><i style={{ width: `${width}%` }} /></div>
                  <b>{activeTrend.format(row.value)}</b>
                </div>
              );
            })}
          </div>
          <div className={detailUi.trendLegendRefined}>
            <span>{activeTrend.labelEn} · 最新赛季优先</span>
            <span>柱长表示数值变化，不代表优劣</span>
          </div>
        </section>
      ) : null}

      <section className={styles.card}>
        <div className={styles.sectionHeader}><div><small>PROFILE</small><h2>球员简介</h2></div></div>
        {player.quoteZh ? <blockquote className={styles.quote}>{player.quoteZh}</blockquote> : null}
        <p className={styles.bioText}>{visibleBio}</p>
        {bio.length > 520 ? <button className={styles.expandButton} onClick={() => setBioExpanded((value) => !value)}>{bioExpanded ? "收起" : "展开全文"}</button> : null}
      </section>

      {player.highlights.length ? (
        <section className={styles.card}>
          <div className={styles.sectionHeader}><div><small>CAREER HISTORY</small><h2>职业生涯</h2></div><span>{player.highlights.length} 条记录</span></div>
          <div className={styles.timeline}>
            {highlights.map((item, index) => (
              <div className={styles.timelineItem} key={`${item.year ?? "na"}-${item.sequenceNo}-${index}`}>
                <span className={styles.timelineYear}>{item.year ?? "—"}</span>
                <span className={styles.timelineDot} />
                <span className={styles.timelineText}>{item.descriptionZh}</span>
              </div>
            ))}
          </div>
          {player.highlights.length > 6 ? <button className={styles.expandButton} onClick={() => setHistoryExpanded((value) => !value)}>{historyExpanded ? "收起职业生涯" : "查看完整职业生涯"}</button> : null}
        </section>
      ) : null}
    </>
  );
}

export default PlayerDetailContent;
