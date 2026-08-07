"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import type { PublicPlayerDetail, PublicPlayerEvent } from "@/db/player-data";
import styles from "./me-preview.module.css";

type PreviewMatch = {
  id: string;
  date: string;
  time: string;
  round: string;
  progress: string;
  playerAId: string | null;
  playerBId: string | null;
  playerA: string;
  playerB: string;
  scoreA: string | null;
  scoreB: string | null;
  table: string;
  status: string;
};

type Props = {
  player: PublicPlayerDetail | null;
  matches: PreviewMatch[];
};

function formatPoints(value: number) {
  return new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 2 }).format(value);
}

function shortDate(value: string) {
  const parts = value.split("-");
  if (parts.length < 3) return value;
  return `${Number(parts[1])}月${Number(parts[2])}日`;
}

function genderLabel(value: string | null) {
  if (!value) return "○ 未录入";
  const normalized = value.toLowerCase();
  if (normalized === "male" || value === "男") return "♂ 男";
  if (normalized === "female" || value === "女") return "♀ 女";
  return value;
}

function totalPoints(events: PublicPlayerEvent[], year: "全部" | number) {
  return events
    .filter((item) => year === "全部" || item.year === year)
    .reduce((sum, item) => sum + item.points, 0);
}

function PlayerPersonalCenter({ player, matches }: Props) {
  const [year, setYear] = useState<"全部" | number>("全部");
  const [editing, setEditing] = useState(false);
  const [profile, setProfile] = useState({ nickname: "", phone: "", club: "", coach: "", school: "" });

  const years = useMemo(() => {
    if (!player) return [];
    return [...new Set(player.events.map((item) => item.year))].sort((a, b) => b - a);
  }, [player]);

  const latestEvent = useMemo(() => {
    if (!player?.events.length) return null;
    return [...player.events].sort((a, b) => b.year - a.year)[0];
  }, [player]);

  const recentMatch = useMemo(() => {
    if (!matches.length) return null;
    const scored = matches.filter((item) => item.scoreA != null && item.scoreB != null);
    return (scored.length ? scored : matches)[(scored.length ? scored : matches).length - 1] ?? null;
  }, [matches]);

  if (!player) {
    return <div className={styles.root}><section className={styles.empty}>暂无可用于球员模式预览的数据</section></div>;
  }

  const points = totalPoints(player.events, year);
  const isPlayerA = recentMatch?.playerAId === player.id;
  const myScore = recentMatch ? (isPlayerA ? recentMatch.scoreA : recentMatch.scoreB) : null;
  const opponentScore = recentMatch ? (isPlayerA ? recentMatch.scoreB : recentMatch.scoreA) : null;
  const opponent = recentMatch ? (isPlayerA ? recentMatch.playerB : recentMatch.playerA) : "";

  return <div className={styles.root}>
    <section className={styles.profileHero}>
      <div className={styles.avatar}>{player.name.slice(0, 1)}</div>
      <div className={styles.profileCopy}>
        <span className={styles.previewTag}>球员模式预览</span>
        <h1>{player.displayName}</h1>
        <div className={styles.identityLine}>
          <b>球员</b>
          <span>{player.currentGroupCode} · {player.currentGroup}</span>
          <span>{genderLabel(player.gender)}</span>
        </div>
      </div>
      <div className={styles.heroMark}>华</div>
    </section>

    <section className={styles.primaryGrid}>
      <article className={styles.featureCard}>
        <header><div><small>我的报名</small><h2>最近报名</h2></div><span className={styles.success}>报名成功</span></header>
        {latestEvent ? <>
          <h3>{latestEvent.title}</h3>
          <p>{latestEvent.year} · {latestEvent.city} · {latestEvent.groupCode} {latestEvent.group}</p>
          <footer><span>参赛成绩</span><strong>{latestEvent.bestResult}</strong></footer>
        </> : <div className={styles.cardEmpty}>暂无报名记录</div>}
      </article>

      <article className={styles.featureCard}>
        <header><div><small>最近比赛</small><h2>比赛成绩</h2></div><span className={recentMatch?.scoreA != null ? styles.ended : styles.pending}>{recentMatch?.scoreA != null ? "已结束" : "待比赛"}</span></header>
        {recentMatch ? <>
          <div className={styles.matchDate}>{shortDate(recentMatch.date)} {recentMatch.time}</div>
          <div className={styles.scoreLine}>
            <strong>{player.displayName}</strong>
            <b>{myScore ?? "-"} <i>:</i> {opponentScore ?? "-"}</b>
            <strong>{opponent}</strong>
          </div>
          <footer><span>{recentMatch.round || recentMatch.progress || "比赛"}</span><strong>{recentMatch.table || "球台待定"}</strong></footer>
        </> : <div className={styles.cardEmpty}>暂无比赛记录</div>}
      </article>
    </section>

    <section className={styles.compactGrid}>
      <article className={styles.compactCard}>
        <span className={styles.cardIcon}>证</span>
        <div><small>参赛证明</small><strong>{player.events.length} 站</strong><p>{latestEvent ? `${latestEvent.year} ${latestEvent.city} · ${latestEvent.bestResult}` : "暂无参赛记录"}</p></div>
        <b>›</b>
      </article>

      <article className={styles.pointsCard}>
        <header><div><small>我的积分</small><strong>{formatPoints(points)}</strong></div><span>积分</span></header>
        <nav className={styles.yearSwitch}>
          <button className={year === "全部" ? styles.active : ""} onClick={() => setYear("全部")}>全部</button>
          {years.map((item) => <button className={year === item ? styles.active : ""} onClick={() => setYear(item)} key={item}>{item}</button>)}
        </nav>
        <div className={styles.pointRows}>
          {player.events.filter((item) => year === "全部" || item.year === year).slice(0, 3).map((item) => <div key={item.eventId}><span>{item.city}</span><b>{formatPoints(item.points)}</b></div>)}
        </div>
      </article>
    </section>

    <section className={styles.infoCard}>
      <header>
        <div><small>个人信息</small><h2>维护个人资料</h2><p>联系方式、昵称、俱乐部、师傅、学校等信息可在这里维护。</p></div>
        <button onClick={() => setEditing((value) => !value)}>{editing ? "收起" : "维护资料"}</button>
      </header>
      <div className={styles.infoSummary}>
        <span><b>姓名</b>{player.displayName}</span>
        <span><b>组别</b>{player.currentGroupCode} {player.currentGroup}</span>
        <span><b>联系方式</b>未绑定</span>
        <span><b>俱乐部</b>未填写</span>
        <span><b>师傅</b>未填写</span>
        <span><b>学校</b>未填写</span>
      </div>
      {editing ? <div className={styles.editor}>
        <div className={styles.previewNotice}>当前为球员 UI 预览模式，填写内容仅用于本页交互预览，不会保存到数据库。</div>
        <label><span>昵称</span><input value={profile.nickname} onChange={(e) => setProfile({ ...profile, nickname: e.target.value })} placeholder="填写昵称" /></label>
        <label><span>联系方式</span><input value={profile.phone} onChange={(e) => setProfile({ ...profile, phone: e.target.value })} placeholder="填写本人手机号" /></label>
        <label><span>俱乐部</span><input value={profile.club} onChange={(e) => setProfile({ ...profile, club: e.target.value })} placeholder="填写所在俱乐部" /></label>
        <label><span>师傅</span><input value={profile.coach} onChange={(e) => setProfile({ ...profile, coach: e.target.value })} placeholder="填写师傅姓名" /></label>
        <label><span>学校</span><input value={profile.school} onChange={(e) => setProfile({ ...profile, school: e.target.value })} placeholder="填写学校" /></label>
      </div> : null}
    </section>
  </div>;
}

export default function MePreview() {
  const [target, setTarget] = useState<HTMLElement | null>(null);
  const [data, setData] = useState<Props>({ player: null, matches: [] });
  const [loading, setLoading] = useState(false);
  const loaded = useMemo(() => ({ current: false }), []);

  useEffect(() => {
    let original: HTMLElement | null = null;
    let host: HTMLElement | null = null;

    const load = async () => {
      if (loaded.current || loading) return;
      setLoading(true);
      try {
        const response = await fetch("/api/public/players/preview", { cache: "no-store" });
        const payload = await response.json() as { data?: Props };
        if (response.ok && payload.data) { setData(payload.data); loaded.current = true; }
      } finally { setLoading(false); }
    };

    const sync = () => {
      const root = document.querySelector<HTMLElement>("main[data-huacai-view]");
      const active = root?.dataset.huacaiView === "me";
      const profile = active ? document.querySelector<HTMLElement>(".profile") : null;
      const stack = profile?.closest<HTMLElement>(".stack") ?? null;
      if (!stack) {
        if (original) original.style.display = "";
        original = null;
        if (host) { host.remove(); host = null; }
        setTarget((current) => current === null ? current : null);
        return;
      }
      if (original !== stack) { if (original) original.style.display = ""; original = stack; }
      stack.style.display = "none";
      if (!host || !host.isConnected) { host = document.createElement("div"); host.dataset.mePreviewHost = "true"; stack.insertAdjacentElement("afterend", host); }
      setTarget((current) => current === host ? current : host);
      void load();
    };

    window.addEventListener("huacai:navigation", sync);
    sync();
    return () => { window.removeEventListener("huacai:navigation", sync); if (original) original.style.display = ""; if (host) host.remove(); };
  }, [loaded, loading]);

  if (!target) return null;
  if (loading && !data.player) return createPortal(<div className={styles.root}><section className={styles.empty}>正在读取球员模式预览…</section></div>, target);
  return createPortal(<PlayerPersonalCenter {...data} />, target);
}
