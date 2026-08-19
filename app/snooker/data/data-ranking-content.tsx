"use client";

import { useEffect, useMemo, useState } from "react";
import type { SnookerPlayerListItem } from "@/lib/snooker/player-data";
import type {
  SnookerCurrentRankingKey,
  SnookerRankingHub,
  SnookerRankingSection,
} from "@/lib/snooker/ranking-hub";
import { technicalMetricKey, type SnookerTechnicalHub, type SnookerTechnicalMetricKey } from "@/lib/snooker/technical-hub";
import { honoursMetricKey, type SnookerHonoursHub, type SnookerHonoursMetricKey } from "@/lib/snooker/honours-hub";
import { SeasonLeadersSection, TechnicalDetailOverlay } from "./data-technical-content";
import { HonoursDetailOverlay, HonoursLeadersSection } from "./data-honours-content";
import { QualificationDetailContent } from "./data-qualification-content";
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

let technicalCache: SnookerTechnicalHub | null = null;
let technicalInflight: Promise<SnookerTechnicalHub | null> | null = null;
let honoursCache: SnookerHonoursHub | null = null;
let honoursInflight: Promise<SnookerHonoursHub | null> | null = null;

async function loadTechnicalHubClient() {
  if (technicalCache) return technicalCache;
  if (technicalInflight) return technicalInflight;
  technicalInflight = fetch("/api/snooker/v1/technical", { headers: { Accept: "application/json" } })
    .then(async (response) => {
      if (!response.ok) return null;
      const data = await response.json() as { hub?: SnookerTechnicalHub };
      if (data.hub?.online) technicalCache = data.hub;
      return data.hub ?? null;
    })
    .catch(() => null)
    .finally(() => { technicalInflight = null; });
  return technicalInflight;
}

async function loadHonoursHubClient() {
  if (honoursCache) return honoursCache;
  if (honoursInflight) return honoursInflight;
  honoursInflight = fetch("/api/snooker/v1/honours", { headers: { Accept: "application/json" } })
    .then(async (response) => {
      if (!response.ok) return null;
      const data = await response.json() as { hub?: SnookerHonoursHub };
      if (data.hub?.online) honoursCache = data.hub;
      return data.hub ?? null;
    })
    .catch(() => null)
    .finally(() => { honoursInflight = null; });
  return honoursInflight;
}

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
  const [infoOpen, setInfoOpen] = useState(false);
  const [technicalHub, setTechnicalHub] = useState<SnookerTechnicalHub | null>(() => technicalCache);
  const [technicalKey, setTechnicalKey] = useState<SnookerTechnicalMetricKey | null>(null);
  const [honoursHub, setHonoursHub] = useState<SnookerHonoursHub | null>(() => honoursCache);
  const [honoursKey, setHonoursKey] = useState<SnookerHonoursMetricKey | null>(null);
  const playerBySlug = useMemo(() => playerBySlugMap(players), [players]);
  const selected = listFor(hub, selectedKey);
  const top = selected?.rows.slice(0, 3) ?? [];

  useEffect(() => {
    let cancelled = false;
    void loadTechnicalHubClient().then((nextHub) => {
      if (!cancelled && nextHub) setTechnicalHub(nextHub);
    });
    void loadHonoursHubClient().then((nextHub) => {
      if (!cancelled && nextHub) setHonoursHub(nextHub);
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const syncTechnicalFromUrl = () => {
      const params = new URLSearchParams(window.location.search);
      setTechnicalKey(params.get("view") === "data" && params.get("section") === "technical" ? technicalMetricKey(params.get("metric")) : null);
    };
    const frame = window.requestAnimationFrame(syncTechnicalFromUrl);
    window.addEventListener("popstate", syncTechnicalFromUrl);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("popstate", syncTechnicalFromUrl);
    };
  }, []);

  useEffect(() => {
    const syncHonoursFromUrl = () => {
      const params = new URLSearchParams(window.location.search);
      setHonoursKey(params.get("view") === "data" && params.get("section") === "honours" ? honoursMetricKey(params.get("honour")) : null);
    };
    const frame = window.requestAnimationFrame(syncHonoursFromUrl);
    window.addEventListener("popstate", syncHonoursFromUrl);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("popstate", syncHonoursFromUrl);
    };
  }, []);

  const openTechnical = (key: SnookerTechnicalMetricKey) => {
    const currentState = { ...(window.history.state ?? {}), snookerTechnicalReturn: true };
    window.history.replaceState(currentState, "", window.location.href);
    const url = new URL(window.location.href);
    url.searchParams.set("view", "data");
    url.searchParams.delete("player");
    url.searchParams.set("section", "technical");
    url.searchParams.set("metric", key);
    url.searchParams.delete("honour");
    url.searchParams.delete("list");
    url.searchParams.delete("group");
    window.history.pushState({ ...currentState, snookerTechnicalDetail: key }, "", url.pathname + url.search + url.hash);
    setTechnicalKey(key);
  };

  const selectTechnical = (key: SnookerTechnicalMetricKey) => {
    const url = new URL(window.location.href);
    url.searchParams.set("view", "data");
    url.searchParams.set("section", "technical");
    url.searchParams.set("metric", key);
    window.history.replaceState({ ...(window.history.state ?? {}), snookerTechnicalDetail: key }, "", url.pathname + url.search + url.hash);
    setTechnicalKey(key);
  };

  const closeTechnical = () => {
    const state = window.history.state as { snookerTechnicalDetail?: string } | null;
    if (state?.snookerTechnicalDetail && window.history.length > 1) {
      window.history.back();
      return;
    }
    const url = new URL(window.location.href);
    url.searchParams.set("view", "data");
    url.searchParams.delete("section");
    url.searchParams.delete("metric");
    window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
    setTechnicalKey(null);
  };

  const openHonours = (key: SnookerHonoursMetricKey) => {
    const currentState = { ...(window.history.state ?? {}), snookerHonoursReturn: true };
    window.history.replaceState(currentState, "", window.location.href);
    const url = new URL(window.location.href);
    url.searchParams.set("view", "data");
    url.searchParams.delete("player");
    url.searchParams.set("section", "honours");
    url.searchParams.set("honour", key);
    url.searchParams.delete("metric");
    url.searchParams.delete("list");
    url.searchParams.delete("group");
    window.history.pushState({ ...currentState, snookerHonoursDetail: key }, "", url.pathname + url.search + url.hash);
    setHonoursKey(key);
  };

  const selectHonours = (key: SnookerHonoursMetricKey) => {
    const url = new URL(window.location.href);
    url.searchParams.set("view", "data");
    url.searchParams.set("section", "honours");
    url.searchParams.set("honour", key);
    window.history.replaceState({ ...(window.history.state ?? {}), snookerHonoursDetail: key }, "", url.pathname + url.search + url.hash);
    setHonoursKey(key);
  };

  const closeHonours = () => {
    const state = window.history.state as { snookerHonoursDetail?: string } | null;
    if (state?.snookerHonoursDetail && window.history.length > 1) {
      window.history.back();
      return;
    }
    const url = new URL(window.location.href);
    url.searchParams.set("view", "data");
    url.searchParams.delete("section");
    url.searchParams.delete("honour");
    window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
    setHonoursKey(null);
  };

  return <>
    <section className={styles.pageIntro}>
      <small>DATA CENTER</small>
      <h1>数据</h1>
      <p>世界斯诺克排名、赛季表现与历史纪录的数据入口。排名、技术与荣誉数据按统一结构逐步扩展。</p>
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

    {technicalHub?.online ? <SeasonLeadersSection hub={technicalHub} players={players} onOpenTechnical={openTechnical} /> : <section className={styles.card}>
      <div className={styles.sectionHeader}><div><small>SEASON LEADERS</small><h2>本赛季领跑者</h2></div></div>
      <div className={styles.technicalLoading}>正在加载赛季技术数据…</div>
    </section>}

    {honoursHub?.online ? <HonoursLeadersSection hub={honoursHub} players={players} onOpenHonours={openHonours} /> : <section className={styles.card}>
      <div className={styles.sectionHeader}><div><small>CAREER HONOURS</small><h2>荣誉榜</h2></div></div>
      <div className={styles.technicalLoading}>正在加载职业生涯荣誉数据…</div>
    </section>}

    <section className={styles.card}>
      <div className={styles.sectionHeader}><div><small>MORE DATA</small><h2>更多数据</h2></div></div>
      <div className={styles.moduleGrid}>
        <article><small>RACE & HISTORY</small><strong>资格与历史</strong><p>大师赛 / 世锦赛资格线、历史排名节点</p><span>排名页已预留入口</span></article>
        <article><small>MORE RECORDS</small><strong>更多纪录</strong><p>奖金、年龄、连续纪录与历史专题</p><span>后续阶段接入</span></article>
      </div>
    </section>

    {infoOpen ? <RankingInfoModal hub={hub} onClose={() => setInfoOpen(false)} /> : null}
    {technicalHub?.online && technicalKey ? <TechnicalDetailOverlay hub={technicalHub} players={players} selectedKey={technicalKey} onSelectKey={selectTechnical} onOpenPlayer={onOpenPlayer} onClose={closeTechnical} /> : null}
    {honoursHub?.online && honoursKey ? <HonoursDetailOverlay hub={honoursHub} players={players} selectedKey={honoursKey} onSelectKey={selectHonours} onOpenPlayer={onOpenPlayer} onClose={closeHonours} /> : null}
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
    </section> : <section className={styles.card}><div className={styles.emptyState}>当前排名数据暂不可用。</div></section>
      : section === "qualification" ? <QualificationDetailContent players={players} onOpenPlayer={onOpenPlayer} />
        : <section className={`${styles.card} ${styles.reservedCard}`}>
          <small>HISTORICAL RANKINGS</small>
          <h2>历史排名</h2>
          <p>这里已为赛季末排名、历史排名节点和球员排名走势预留入口。历史数据补齐后直接沿用当前排名的列表框架。</p>
          <span>历史数据源正在整理</span>
        </section>}
  </div>;
}
