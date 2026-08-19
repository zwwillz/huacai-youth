"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import type {
  SnookerVisitMonitorRow,
  SnookerVisitRange,
} from "@/db/snooker-visit-monitor";
import styles from "./visit-monitor.module.css";

type VisitResponse = {
  ok?: boolean;
  rows?: SnookerVisitMonitorRow[];
  page?: number;
  pageSize?: number;
  hasPrevious?: boolean;
  hasNext?: boolean;
  message?: string;
};

const rangeItems: Array<{ id: SnookerVisitRange; label: string }> = [
  { id: "today", label: "今天" },
  { id: "yesterday", label: "昨天" },
  { id: "7d", label: "近7天" },
  { id: "30d", label: "近30天" },
];

function formatChinaTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("zh-CN", {
    timeZone: "Asia/Shanghai",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).replace("/", "-");
}

export default function SnookerVisitMonitor() {
  const [range, setRange] = useState<SnookerVisitRange>("today");
  const [query, setQuery] = useState("");
  const [appliedQuery, setAppliedQuery] = useState("");
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<SnookerVisitMonitorRow[]>([]);
  const [pageSize, setPageSize] = useState(100);
  const [hasPrevious, setHasPrevious] = useState(false);
  const [hasNext, setHasNext] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [checkedAt, setCheckedAt] = useState<string>(new Date().toISOString());

  const refresh = useCallback(async () => {
    if (typeof document !== "undefined" && document.hidden) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ range, page: String(page) });
      if (appliedQuery) params.set("q", appliedQuery);
      const response = await fetch(`/api/snooker/v1/visits?${params.toString()}`, {
        cache: "no-store",
        headers: { "cache-control": "no-cache" },
      });
      const data = await response.json() as VisitResponse;
      if (response.status === 401 || response.status === 428) {
        window.location.href = "/snooker/data-ops";
        return;
      }
      if (!response.ok || !data.ok || !Array.isArray(data.rows)) {
        throw new Error(data.message || "访问监测接口返回异常");
      }
      setRows(data.rows);
      setPage(data.page || page);
      setPageSize(data.pageSize || 100);
      setHasPrevious(Boolean(data.hasPrevious));
      setHasNext(Boolean(data.hasNext));
      setCheckedAt(new Date().toISOString());
      setError(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "访问监测暂不可用");
    } finally {
      setLoading(false);
    }
  }, [range, page, appliedQuery]);

  useEffect(() => {
    const initialTimer = window.setTimeout(() => void refresh(), 0);
    const timer = window.setInterval(() => void refresh(), 120_000);
    const onVisibility = () => { if (!document.hidden) void refresh(); };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.clearTimeout(initialTimer);
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [refresh]);

  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const next = query.trim();
    if (page !== 1) setPage(1);
    if (next !== appliedQuery) setAppliedQuery(next);
    else void refresh();
  };

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <header className={styles.header}>
          <div>
            <h1>用户访问监测</h1>
            <p>管理员专用访问日志。只记录世界斯诺克数据中心前台访问；日志异步写入，不阻塞用户页面加载。</p>
          </div>
          <div className={styles.headerActions}>
            <button onClick={() => void refresh()} disabled={loading}>{loading ? "刷新中…" : "刷新"}</button>
            <Link href="/snooker/data-ops">数据运维中心</Link>
            <Link href="/snooker">返回斯诺克首页</Link>
          </div>
        </header>

        <div className={styles.toolbar}>
          <div className={styles.ranges}>
            {rangeItems.map((item) => (
              <button key={item.id} className={range === item.id ? styles.rangeActive : ""} onClick={() => { setRange(item.id); setPage(1); }}>{item.label}</button>
            ))}
          </div>
          <form className={styles.search} onSubmit={submitSearch}>
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索访客、IP、页面、赛事…" />
            <button type="submit">搜索</button>
          </form>
          <div className={styles.pageMeta}>第 {page} 页 · 本页 {rows.length} 条 · 每页 {pageSize} 条</div>
        </div>

        <div className={styles.refreshMeta}>
          <span>每 2 分钟刷新一次，仅在监测页打开且可见时运行</span>
          <span>最近检查：{formatChinaTime(checkedAt)}</span>
          <span>管理员权限页 · IP 完整展示</span>
        </div>

        {error ? <div className={styles.error}>访问监测读取失败：{error}。已保留当前页面数据，可点击“刷新”重试。</div> : null}

        <section className={styles.panel}>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead><tr><th>时间</th><th>类型</th><th>用户 / 访客</th><th>IP</th><th>地区</th><th>设备</th><th>页面 / 模块</th><th>赛事</th><th>操作</th></tr></thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td>{formatChinaTime(row.time)}</td>
                    <td><span className={styles.visitBadge}>前台访问</span></td>
                    <td>{row.visitor}</td>
                    <td className={styles.mono}>{row.ip}</td>
                    <td>{row.region}</td>
                    <td>{row.device}</td>
                    <td><b>{row.page}</b></td>
                    <td>{row.event}</td>
                    <td>{row.action}</td>
                  </tr>
                ))}
                {!loading && rows.length === 0 ? <tr><td colSpan={9} className={styles.empty}>当前筛选范围内还没有斯诺克前台访问记录。</td></tr> : null}
                {loading && rows.length === 0 ? <tr><td colSpan={9} className={styles.empty}>正在读取访问记录…</td></tr> : null}
              </tbody>
            </table>
          </div>
        </section>

        <div className={styles.pagination}>
          <button disabled={!hasPrevious || loading} onClick={() => setPage((current) => Math.max(1, current - 1))}>上一页</button>
          <span>第 {page} 页</span>
          <button disabled={!hasNext || loading} onClick={() => setPage((current) => current + 1)}>下一页</button>
        </div>

        <footer className={styles.footer}>本页面与访问日志 API 均受 Snooker Admin 登录保护；监测页自身访问不会计入前台访问数据。</footer>
      </div>
    </main>
  );
}
