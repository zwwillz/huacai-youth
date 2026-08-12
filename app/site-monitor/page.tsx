import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getAdminViewer } from "@/app/admin/admin-viewer";
import { getSiteMonitorData, SITE_MONITOR_PAGE_SIZE } from "@/db/site-monitor-runtime";
import type { SiteMonitorRange, SiteMonitorRow } from "@/db/site-monitor";
import styles from "./site-monitor.module.css";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "网站监测",
  robots: { index: false, follow: false },
};

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const RANGE_OPTIONS: Array<{ id: SiteMonitorRange; label: string }> = [
  { id: "today", label: "今天" },
  { id: "yesterday", label: "昨天" },
  { id: "7d", label: "近7天" },
  { id: "30d", label: "近30天" },
];

const CHINA_OFFSET_MS = 8 * 60 * 60 * 1000;

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] || "" : value || "";
}

function normalizeRange(value: string): SiteMonitorRange {
  return RANGE_OPTIONS.some((item) => item.id === value) ? value as SiteMonitorRange : "today";
}

function normalizePage(value: string) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, 10_000) : 1;
}

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function formatChinaTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const shifted = new Date(date.getTime() + CHINA_OFFSET_MS);
  return `${pad(shifted.getUTCMonth() + 1)}-${pad(shifted.getUTCDate())} ${pad(shifted.getUTCHours())}:${pad(shifted.getUTCMinutes())}:${pad(shifted.getUTCSeconds())}`;
}

function typeClass(row: SiteMonitorRow) {
  if (row.type === "前台访问") return styles.typePublic;
  if (row.type === "后台登录") return styles.typeLogin;
  return styles.typeAdmin;
}

function hrefFor(range: SiteMonitorRange, query: string, page = 1) {
  const params = new URLSearchParams({ range });
  if (query) params.set("q", query);
  if (page > 1) params.set("page", String(page));
  return `/site-monitor?${params.toString()}`;
}

export default async function SiteMonitorPage({ searchParams }: PageProps) {
  const viewer = await getAdminViewer();
  if (!viewer) redirect("/admin/login?next=%2Fsite-monitor");
  if (viewer.username !== "admin" || viewer.role !== "system_admin") notFound();

  const params = await searchParams;
  const range = normalizeRange(first(params.range));
  const query = first(params.q).trim().slice(0, 80);
  const requestedPage = normalizePage(first(params.page));

  let rows: SiteMonitorRow[] = [];
  let warnings: string[] = [];
  let currentPage = requestedPage;
  let pageSize = SITE_MONITOR_PAGE_SIZE;
  let hasPrevious = requestedPage > 1;
  let hasNext = false;
  try {
    const data = await getSiteMonitorData(viewer.username, { range, query, page: requestedPage });
    rows = data.rows;
    warnings = data.warnings;
    currentPage = data.page;
    pageSize = data.pageSize;
    hasPrevious = data.hasPrevious;
    hasNext = data.hasNext;
  } catch (error) {
    console.error("[site-monitor] page data load failed", error);
    warnings = ["监测数据暂时读取失败，请稍后刷新重试"];
  }

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <header className={styles.header}>
          <div>
            <h1 className={styles.title}>网站监测</h1>
            <p className={styles.subtitle}>前台访问、后台登录和后台操作统一按时间倒序显示。</p>
          </div>
          <Link className={styles.back} href="/admin">返回后台</Link>
        </header>

        <div className={styles.toolbar}>
          <div className={styles.ranges} aria-label="时间范围">
            {RANGE_OPTIONS.map((item) => (
              <Link
                key={item.id}
                href={hrefFor(item.id, query)}
                className={range === item.id ? styles.rangeActive : styles.range}
              >
                {item.label}
              </Link>
            ))}
          </div>

          <form className={styles.search} action="/site-monitor" method="get">
            <input type="hidden" name="range" value={range} />
            <input
              type="search"
              name="q"
              defaultValue={query}
              maxLength={80}
              placeholder="搜索账号、IP、页面、赛事…"
              aria-label="搜索监测记录"
            />
            <button type="submit">搜索</button>
          </form>

          <span className={styles.count}>第 {currentPage} 页 · 本页 {rows.length} 条 · 每页 {pageSize} 条</span>
        </div>

        {warnings.length > 0 && (
          <div className={styles.warning} role="status">
            部分监测数据暂未读取成功：{warnings.join("、")}。页面其他数据仍可正常查看。
          </div>
        )}

        <section className={styles.tableCard} aria-label="网站监测记录">
          {rows.length ? (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>时间</th>
                    <th>类型</th>
                    <th>用户 / 访客</th>
                    <th>IP</th>
                    <th>地区</th>
                    <th>设备</th>
                    <th>页面 / 模块</th>
                    <th>赛事</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id}>
                      <td>{formatChinaTime(row.time)}</td>
                      <td><span className={typeClass(row)}>{row.type}</span></td>
                      <td>{row.visitor}</td>
                      <td className={row.ip === "未知" ? styles.muted : undefined}>{row.ip}</td>
                      <td className={row.region === "—" || row.region === "未知" ? styles.muted : undefined}>{row.region}</td>
                      <td className={row.device === "未知" ? styles.muted : undefined}>{row.device}</td>
                      <td>{row.page}</td>
                      <td className={row.event === "—" ? styles.muted : undefined}>{row.event}</td>
                      <td>{row.action}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className={styles.empty}>{warnings.length ? "监测数据暂未读取成功，请稍后刷新。" : "当前筛选条件下还没有记录。"}</div>
          )}
        </section>

        <nav className={styles.pagination} aria-label="监测记录分页">
          {hasPrevious ? (
            <Link className={styles.pageButton} href={hrefFor(range, query, currentPage - 1)}>上一页</Link>
          ) : (
            <span className={styles.pageButtonDisabled}>上一页</span>
          )}
          <span className={styles.pageNumber}>第 {currentPage} 页</span>
          {hasNext ? (
            <Link className={styles.pageButton} href={hrefFor(range, query, currentPage + 1)}>下一页</Link>
          ) : (
            <span className={styles.pageButtonDisabled}>下一页</span>
          )}
        </nav>
      </div>
    </main>
  );
}
