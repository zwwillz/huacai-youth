"use client";

import { useEffect, useMemo, useState } from "react";
import type { SnookerPlayerListItem } from "@/lib/snooker/player-data";
import type {
  SnookerCurrentRankingKey,
  SnookerRankingHub,
  SnookerRankingSection,
} from "@/lib/snooker/ranking-hub";
import type { SnookerTechnicalHub, SnookerTechnicalMetricKey } from "@/lib/snooker/technical-hub";
import { SeasonLeadersSection } from "./data-technical-content";
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

const sectionTabs: Array<{ id: SnookerRankingSection; label: string }> = [
  { id: "current", label: "当前排名" },
  { id: "qualification", label: "资格竞争" },
  { id: "history", label: "历史排名" },
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
    year: "numeric",
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

function RankingInfoModal({ hub, onClose }: { hub: SnookerRankingHub; onClose: () => void }) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return <div className={styles.modalBackdrop} role="presentation" onMouseDown={(event) => {
    if (event.currentTarget === event.target) onClose();
  }}>
    <section className={styles.infoModal} role="dialog" aria-modal="true" aria-labelledby="ranking-info-title">
      <div className={styles.infoModalHeader}>
        <div><small>RANKING GUIDE</small><h2 id="ranking-info-title">排名说明</h2></div>
        <button type="button" onClick={onClose} aria-label="关闭排名说明">×</button>
      </div>
      <div className={styles.infoList}>
        {currentKeyOrder.map((key) => {
          const list = listFor(hub, key);
          return <article key={key}>
            <strong>{shortLabels[key]}</strong>
            <p>{list?.descriptionZh ?? "说明待同步。"}</p>
          </article>;
        })}
      </div>
    </section>
  </div>;
}

export function DataHubContent({
  hub,
  technicalHub,
  players,
  selectedKey,
  onSelectKey,
  onOpenRankings,
  onOpenTechnical,
  onOpenPlayer,
}: {
  hub: SnookerRankingHub;
  technicalHub: SnookerTechnicalHub;
  players: SnookerPlayerListItem[];
  selectedKey: SnookerCurrentRankingKey;
  onSelectKey: (key: SnookerCurrentRankingKey) => void;
  onOpenRankings: (key: SnookerCurrentRankingKey) => void;
  onOpenTechnical: (key: SnookerTechnicalMetricKey) => void;
  onOpenPlayer: (slug: string) => void;
}) {
  const [infoOpen, setInfoOpen] = useState(false);
  const playerBySlug = useMemo(() => playerBySlugMap(players), [players]);
  const selected = listFor(hub, selectedKey);
  const top = selected?.rows.slice(0, 3) ?? [];

  return <>
    <section className={styles.pageIntro}>
      <small>DATA CENTER</small>
      <h1>数据</h1>
      <p>世界斯诺克排名、赛季表现与历史纪录的数据入口。排名与技术数据优先使用官方数据，专题模块按统一结构逐步扩展。</p>
    </section>

    <section className={`${styles.card} ${styles.rankingCard}`}>
      <div className={styles.sectionHeader}>
        <div>
          <small>RANKINGS</small>
          <div className={styles.titleWithInfo}><h2>排名中心</h2><button type="button" className={styles.infoButton} onClick={() => setInfoOpen(true)} aria-label="查看四种排名说明">i</button></div>
        </div>
      </div>
      <RankingListTabs hub={hub} selectedKey={selectedKey} onSelectKey={onSelectKey} />

      {selected ? <>
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
        <button className={styles.primaryAction} type="button" onClick={() => onOpenRankings(selected.key)}>查看完整排名 <span>›</span></button>
      </> : <div className={styles.emptyState}>排名数据正在准备中。</div>}
    </section>

    <SeasonLeadersSection hub={technicalHub} players={players} onOpenTechnical={onOpenTechnical} onOpenPlayer={onOpenPlayer} />

    <section className={styles.card}>
      <div className={styles.sectionHeader}><div><small>MORE DATA</small><h2>更多数据</h2></div></div>
      <div className={styles.moduleGrid}>
        <article><small>HONOURS</small><strong>荣誉榜</strong><p>排名赛、三大赛、世锦赛、生涯147</p><span>下一阶段接入</span></article>
        <article><small>RACE & HISTORY</small><strong>资格与历史</strong><p>大师赛 / 世锦赛资格线、历史排名节点</p><span>排名页已预留入口</span></article>
      </div>
    </section>

    {infoOpen ? <RankingInfoModal hub={hub} onClose={() => setInfoOpen(false)} /> : null}
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
  const playerBySlug = useMemo(() => playerBySlugMap(players), [players]);
  const selected = listFor(hub, selectedKey);
  const rows = selected?.rows ?? [];

  return <div className={styles.detailContent}>
    <div className={styles.detailNavStack}>
      <div className={styles.sectionTabs} role="tablist" aria-label="排名栏目">
        {sectionTabs.map((item) => <button type="button" role="tab" aria-selected={section === item.id} className={section === item.id ? styles.sectionActive : ""} onClick={() => onSelectSection(item.id)} key={item.id}>{item.label}</button>)}
      </div>
      {section === "current" ? <RankingListTabs hub={hub} selectedKey={selectedKey} onSelectKey={onSelectKey} compact /> : null}
    </div>

    {section === "current" ? selected ? <section className={`${styles.card} ${styles.rankingTableCard}`}>
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
      </div>
      <div className={styles.rankingFooterMeta}>
        <span>来源：{selected.sourceName || "WPBSA"}</span>
        <span>更新：{capturedLabel(selected.capturedAt)}</span>
      </div>
    </section> : <section className={styles.card}><div className={styles.emptyState}>当前排名数据暂不可用。</div></section> : <section className={`${styles.card} ${styles.reservedCard}`}>
      <small>{section === "qualification" ? "QUALIFICATION RACES" : "HISTORICAL RANKINGS"}</small>
      <h2>{section === "qualification" ? "资格竞争" : "历史排名"}</h2>
      <p>{section === "qualification" ? "这里已为大师赛、世锦赛、球员锦标赛和巡回锦标赛资格排名预留统一入口。下一阶段接入资格线、距离差和 Cut-off 信息。" : "这里已为赛季末排名、历史排名节点和球员排名走势预留入口。历史数据补齐后直接沿用当前排名的列表框架。"}</p>
      <span>Phase 1A · 框架已就绪</span>
    </section>}
  </div>;
}
