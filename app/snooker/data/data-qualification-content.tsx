"use client";

import { useEffect, useMemo, useState } from "react";
import type { SnookerPlayerListItem } from "@/lib/snooker/player-data";
import {
  qualificationRankingKey,
  type SnookerQualificationHub,
  type SnookerQualificationList,
  type SnookerQualificationRankingKey,
} from "@/lib/snooker/qualification-hub";
import styles from "./data.module.css";
import qualificationStyles from "./data-qualification.module.css";

let qualificationCache: SnookerQualificationHub | null = null;
let qualificationInflight: Promise<SnookerQualificationHub | null> | null = null;

async function loadQualificationHubClient() {
  if (qualificationCache) return qualificationCache;
  if (qualificationInflight) return qualificationInflight;
  qualificationInflight = fetch("/api/snooker/v1/qualification", { headers: { Accept: "application/json" } })
    .then(async (response) => {
      if (!response.ok) return null;
      const data = await response.json() as { hub?: SnookerQualificationHub };
      if (data.hub?.online) qualificationCache = data.hub;
      return data.hub ?? null;
    })
    .catch(() => null)
    .finally(() => { qualificationInflight = null; });
  return qualificationInflight;
}

function initials(name: string) {
  return name.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase();
}

function money(value: number) {
  return `£${value.toLocaleString("en-GB")}`;
}

function dateLabel(value: string | null) {
  if (!value) return "截止日期待确认";
  const date = new Date(`${value}T00:00:00+08:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("zh-CN", { year: "numeric", month: "long", day: "numeric", timeZone: "Asia/Shanghai" }).format(date);
}

function capturedLabel(value: string | null) {
  if (!value) return "更新时间待同步";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "更新时间待同步";
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Shanghai",
  }).format(date);
}

function playerMap(players: SnookerPlayerListItem[]) {
  return new Map(players.map((player) => [player.slug, player]));
}

function QualificationAvatar({ player, fallbackName }: { player?: SnookerPlayerListItem; fallbackName: string }) {
  return <span className={`${styles.technicalAvatar} ${styles.technicalAvatarCompact}`}>
    {player?.avatarUrl ? <img src={player.avatarUrl} alt="" loading="lazy" decoding="async" /> : <span>{initials(player?.nameEn ?? fallbackName)}</span>}
  </span>;
}

function shortLabel(list: SnookerQualificationList) {
  if (list.key === "race_masters_2027") return "大师赛";
  if (list.key === "race_crucible_2027") return "世锦赛";
  if (list.key === "race_players_championship") return "球员锦标赛";
  return "巡回锦标赛";
}

export function QualificationDetailContent({
  players,
  onOpenPlayer,
}: {
  players: SnookerPlayerListItem[];
  onOpenPlayer: (slug: string) => void;
}) {
  const [hub, setHub] = useState<SnookerQualificationHub | null>(() => qualificationCache);
  const [selectedKey, setSelectedKey] = useState<SnookerQualificationRankingKey>("race_masters_2027");
  const bySlug = useMemo(() => playerMap(players), [players]);

  useEffect(() => {
    let cancelled = false;
    void loadQualificationHubClient().then((nextHub) => {
      if (!cancelled && nextHub) setHub(nextHub);
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const syncFromUrl = () => {
      const params = new URLSearchParams(window.location.search);
      if (params.get("view") === "data" && params.get("section") === "rankings" && params.get("group") === "qualification") {
        setSelectedKey(qualificationRankingKey(params.get("race")));
      }
    };
    const frame = window.requestAnimationFrame(syncFromUrl);
    window.addEventListener("popstate", syncFromUrl);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("popstate", syncFromUrl);
    };
  }, []);

  const availableLists = hub?.lists.filter((list) => list.rows.length > 0) ?? [];
  const selected = availableLists.find((list) => list.key === selectedKey) ?? availableLists[0] ?? null;

  const selectList = (key: SnookerQualificationRankingKey) => {
    const url = new URL(window.location.href);
    url.searchParams.set("view", "data");
    url.searchParams.set("section", "rankings");
    url.searchParams.set("group", "qualification");
    url.searchParams.set("race", key);
    window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
    setSelectedKey(key);
    window.scrollTo({ top: 0, behavior: "auto" });
  };

  if (!hub) return <section className={styles.card}><div className={styles.emptyState}>正在加载资格排名…</div></section>;
  if (!hub.online || !selected) return <section className={styles.card}><div className={styles.emptyState}>资格排名数据正在准备中。</div></section>;

  const limit = selected.qualificationLimit;
  const cutRow = limit ? selected.rows.find((row) => row.rank === limit) : null;
  const cutMoney = cutRow?.money ?? null;

  return <>
    <div className={styles.technicalMetricNav} role="tablist" aria-label="资格排名">
      {availableLists.map((list) => <button
        type="button"
        role="tab"
        aria-selected={selected.key === list.key}
        className={selected.key === list.key ? styles.technicalMetricActive : ""}
        onClick={() => selectList(list.key)}
        key={list.key}
      >{shortLabel(list)}</button>)}
    </div>

    <div className={qualificationStyles.qualificationMeta}>
      <strong>{selected.titleZh}</strong>
      <span>{limit ? `TOP ${limit} 资格线` : "资格线待官方确认"}</span>
      <small>截止 {dateLabel(selected.cutoffDate)}</small>
    </div>

    <section className={`${styles.card} ${styles.technicalTableCard}`}>
      <div className={styles.technicalTableHeader}><span>排名</span><span>球员</span><span>排名金额</span></div>
      <div className={`${styles.technicalRankingList} ${qualificationStyles.qualificationRows}`}>
        {selected.rows.map((row) => {
          const player = row.playerSlug ? bySlug.get(row.playerSlug) : undefined;
          const gap = cutMoney === null || row.rank <= (limit ?? 0) ? null : Math.max(0, cutMoney - row.money);
          return <div key={`${selected.key}-${row.rank}-${row.playerUuid}`}>
            {limit && row.rank === limit + 1 ? <div className={qualificationStyles.qualificationCutLine}><span>资格线 · TOP {limit}</span></div> : null}
            <button type="button" onClick={() => row.playerSlug && onOpenPlayer(row.playerSlug)} disabled={!row.playerSlug}>
              <strong>{row.rank}</strong>
              <QualificationAvatar player={player} fallbackName={row.sourcePlayerName} />
              <span>
                <b>{player?.nameZh ?? row.sourcePlayerName}</b>
                <small>{player?.nameEn ?? row.sourcePlayerName}{gap !== null ? ` · 距资格线 ${money(gap)}` : limit && row.rank <= limit ? " · 资格区" : ""}</small>
              </span>
              <em>{money(row.money)}</em>
              <i>›</i>
            </button>
          </div>;
        })}
      </div>
      <div className={styles.rankingFooterMeta}>
        <span>来源：{selected.sourceName}</span>
        <span>更新：{capturedLabel(selected.capturedAt)}</span>
      </div>
    </section>
  </>;
}
