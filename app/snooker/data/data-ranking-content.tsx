"use client";

import { useMemo, useState } from "react";
import type { SnookerPlayerListItem } from "@/lib/snooker/player-data";
import type {
  SnookerCurrentRankingKey,
  SnookerRankingHub,
  SnookerRankingHubList,
  SnookerRankingSection,
} from "@/lib/snooker/ranking-hub";
import styles from "./data.module.css";

const currentKeyOrder: SnookerCurrentRankingKey[] = [
  "world_official",
  "one_year",
  "provisional_seeding",
  "provisional_eos",
];

const shortLabels: Record<SnookerCurrentRankingKey, string> = {
  world_official: "世界排名",
  one_year: "单赛季",
  provisional_seeding: "临时排名",
  provisional_eos: "赛季末预测",
};

const sectionTabs: Array<{ id: SnookerRankingSection; label: string; hint: string }> = [
  { id: "current", label: "当前排名", hint: "4 个榜单" },
  { id: "qualification", label: "资格竞争", hint: "下一阶段" },
  { id: "history", label: "历史排名", hint: "下一阶段" },
];

function initials(name: string) {
  return name.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase();
}

function rankingMoney(value: number) {
  return `£${value.toLocaleString("en-GB")}`;
}

function capturedLabel(value: string | null) {
  if (!value) return "更新时间待同步";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "更新时间待同步";
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

function playerBySlugMap(players: SnookerPlayerListItem[]) {
  return new Map(players.map((player) => [player.slug, player]));
}

function RankingAvatar({ player }: { player?: SnookerPlayerListItem }) {
  return <span className={styles.avatar}>{player?.avatarUrl ? <img src={player.avatarUrl} alt="" loading="lazy" decoding="async" /> : <span>{initials(player?.nameEn ?? "Player")}</span>}</span>;
}

function listFor(hub: SnookerRankingHub, key: SnookerCurrentRankingKey) {
  return hub.lists.find((list) => list.key === key) ?? null;
}

function RankingListTabs({
  hub,
  selectedKey,
  onSelectKey,
  compact = false,
}: {
  hub: SnookerRankingHub;
  selectedKey: SnookerCurrentRankingKey;
  onSelectKey: (key: SnookerCurrentRankingKey) => void;
  compact?: boolean;
}) {
  return <div className={`${styles.rankingTabs} ${compact ? styles.rankingTabsCompact : ""}`} role="tablist" aria-label="排名类型">
    {currentKeyOrder.map((key) => {
      const list = listFor(hub, key);
      return <button
        type="button"
        role="tab"
        aria-selected={selectedKey === key}
        className={selectedKey === key ? styles.tabActive : ""}
        onClick={() => onSelectKey(key)}
        key={key}
      >
        <span>{shortLabels[key]}</span>
        {!compact ? <small>{list?.rows.length ? `${list.rows.length} 人` : "待同步"}</small> : null}
      </button>;
    })}
  </div>;
}

export function DataHubContent({
  hub,
  players,
  selectedKey,
  onSelectKey,
  onOpenRankings,
  onOpenPlayer,
}: {
  hub: SnookerRankingHub;
  players: SnookerPlayerListItem[];
  selectedKey: SnookerCurrentRankingKey;
  onSelectKey: (key: SnookerCurrentRankingKey) => void;
  onOpenRankings: (key: SnookerCurrentRankingKey) => void;
  onOpenPlayer: (slug: string) => void;
}) {
  const playerBySlug = useMemo(() => playerBySlugMap(players), [players]);
  const selected = listFor(hub, selectedKey);
  const top = selected?.rows.slice(0, 3) ?? [];

  return <>
    <section className={styles.pageIntro}>
      <small>DATA CENTER</small>
      <h1>数据</h1>
      <p>世界斯诺克排名、赛季表现与历史纪录的数据入口。第一阶段先建立排名中心，后续技术榜、荣誉榜和资格数据沿用同一框架接入。</p>
    </section>

    <section className={`${styles.card} ${styles.rankingCard}`}>
      <div className={styles.sectionHeader}>
        <div><small>RANKINGS</small><h2>排名中心</h2></div>
        <span>{hub.online ? "官方数据" : "数据暂不可用"}</span>
      </div>
      <RankingListTabs hub={hub} selectedKey={selectedKey} onSelectKey={onSelectKey} />

      {selected ? <>
        <div className={styles.rankingSummary}>
          <div><strong>{selected.titleZh}</strong><small>{selected.titleEn}</small></div>
          <p>{selected.descriptionZh}</p>
        </div>
        <div className={styles.topRankingList}>
          {top.map((row) => {
            const player = row.playerSlug ? playerBySlug.get(row.playerSlug) : undefined;
            return <button type="button" onClick={() => row.playerSlug && onOpenPlayer(row.playerSlug)} disabled={!row.playerSlug} key={`${selected.key}-${row.rank}`}>
              <strong className={row.rank <= 3 ? styles.medalRank : ""}>{row.rank}</strong>
              <RankingAvatar player={player} />
              <span><b>{player?.nameZh ?? row.sourcePlayerName}</b><small>{player?.nameEn ?? row.sourcePlayerName}</small></span>
              <em>{rankingMoney(row.money)}</em>
            </button>;
          })}
        </div>
        <div className={styles.sourceMeta}>
          <span><i />{selected.sourceName || "WPBSA"}</span>
          <small>{capturedLabel(selected.capturedAt)}</small>
        </div>
        <button className={styles.primaryAction} type="button" onClick={() => onOpenRankings(selected.key)}>查看完整排名 <span>›</span></button>
      </> : <div className={styles.emptyState}>排名数据正在准备中。</div>}
    </section>

    <section className={styles.card}>
      <div className={styles.sectionHeader}><div><small>NEXT MODULES</small><h2>数据专题</h2></div><span>框架已预留</span></div>
      <div className={styles.moduleGrid}>
        <article><small>SEASON LEADERS</small><strong>本赛季领跑者</strong><p>破百、胜率、平均出杆、147</p><span>下一步接入</span></article>
        <article><small>TECHNICAL</small><strong>技术榜</strong><p>50+、100+、最高单杆、比赛表现</p><span>下一步接入</span></article>
        <article><small>HONOURS</small><strong>荣誉榜</strong><p>排名赛、三大赛、世锦赛、生涯147</p><span>下一步接入</span></article>
        <article><small>RACE & HISTORY</small><strong>资格与历史</strong><p>大师赛 / 世锦赛资格线、历史排名节点</p><span>排名页已预留入口</span></article>
      </div>
    </section>
  </>;
}

export function RankingDetailContent({
  hub,
  players,
  selectedKey,
  section,
  onSelectKey,
  onSelectSection,
  onOpenPlayer,
}: {
  hub: SnookerRankingHub;
  players: SnookerPlayerListItem[];
  selectedKey: SnookerCurrentRankingKey;
  section: SnookerRankingSection;
  onSelectKey: (key: SnookerCurrentRankingKey) => void;
  onSelectSection: (section: SnookerRankingSection) => void;
  onOpenPlayer: (slug: string) => void;
}) {
  const [query, setQuery] = useState("");
  const playerBySlug = useMemo(() => playerBySlugMap(players), [players]);
  const selected = listFor(hub, selectedKey);
  const needle = query.trim().toLocaleLowerCase("zh-CN");
  const rows = useMemo(() => {
    if (!selected) return [];
    if (!needle) return selected.rows;
    return selected.rows.filter((row) => {
      const player = row.playerSlug ? playerBySlug.get(row.playerSlug) : undefined;
      const haystack = `${player?.nameZh ?? ""} ${player?.shortNameZh ?? ""} ${player?.nameEn ?? ""} ${player?.nationalityZh ?? ""} ${row.sourcePlayerName}`.toLocaleLowerCase("zh-CN");
      return haystack.includes(needle);
    });
  }, [needle, playerBySlug, selected]);

  return <div className={styles.detailContent}>
    <div className={styles.sectionTabs} role="tablist" aria-label="排名栏目">
      {sectionTabs.map((item) => <button type="button" role="tab" aria-selected={section === item.id} className={section === item.id ? styles.sectionActive : ""} onClick={() => onSelectSection(item.id)} key={item.id}><span>{item.label}</span><small>{item.hint}</small></button>)}
    </div>

    {section === "current" ? <>
      <section className={styles.detailIntro}>
        <small>RANKINGS</small>
        <h1>排名</h1>
        <p>当前排名集中展示官方世界排名、单赛季排名、临时排名和赛季末预测。点击球员可直接进入球员详情。</p>
      </section>
      <RankingListTabs hub={hub} selectedKey={selectedKey} onSelectKey={onSelectKey} compact />

      {selected ? <>
        <section className={`${styles.card} ${styles.detailSummaryCard}`}>
          <div><small>{selected.titleEn}</small><h2>{selected.titleZh}</h2><p>{selected.descriptionZh}</p></div>
          <div className={styles.detailMeta}><span>{selected.rows.length} 位球员</span><span>{capturedLabel(selected.capturedAt)}</span><span>{selected.sourceName || "WPBSA"}</span></div>
        </section>

        <div className={styles.searchWrap}>
          <label className={styles.searchBox}><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索中文名 / 英文名 / 国家" aria-label="搜索排名球员" /></label>
          <small>{needle ? `找到 ${rows.length} 名球员` : `共 ${rows.length} 名球员`}</small>
        </div>

        <section className={styles.card}>
          <div className={styles.rankingTableHeader}><span>排名</span><span>球员</span><span>排名金额</span></div>
          <div className={styles.fullRankingList}>
            {rows.map((row) => {
              const player = row.playerSlug ? playerBySlug.get(row.playerSlug) : undefined;
              return <button type="button" onClick={() => row.playerSlug && onOpenPlayer(row.playerSlug)} disabled={!row.playerSlug} key={`${selected.key}-${row.rank}-${row.playerUuid}`}>
                <strong>{row.rank}</strong>
                <RankingAvatar player={player} />
                <span><b>{player?.nameZh ?? row.sourcePlayerName}</b><small>{player?.nameEn ?? row.sourcePlayerName}{player?.nationalityZh ? ` · ${player.nationalityZh}` : ""}</small></span>
                <em>{rankingMoney(row.money)}</em>
                <i>›</i>
              </button>;
            })}
            {!rows.length ? <div className={styles.emptyState}>没有找到匹配的球员。</div> : null}
          </div>
        </section>
      </> : <section className={styles.card}><div className={styles.emptyState}>当前排名数据暂不可用。</div></section>}
    </> : <section className={`${styles.card} ${styles.reservedCard}`}>
      <small>{section === "qualification" ? "QUALIFICATION RACES" : "HISTORICAL RANKINGS"}</small>
      <h2>{section === "qualification" ? "资格竞争" : "历史排名"}</h2>
      <p>{section === "qualification" ? "这里已为大师赛、世锦赛、球员锦标赛和巡回锦标赛资格排名预留统一入口。下一阶段接入资格线、距离差和 Cut-off 信息。" : "这里已为赛季末排名、历史排名节点和球员排名走势预留入口。历史数据补齐后直接沿用当前排名的列表与筛选框架。"}</p>
      <span>Phase 1A · 框架已就绪</span>
    </section>}
  </div>;
}
