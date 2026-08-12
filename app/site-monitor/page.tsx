import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getAdminViewer } from "@/app/admin/admin-viewer";
import { getSiteMonitorRows, type SiteMonitorRange, type SiteMonitorRow } from "@/db/site-monitor";
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

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] || "" : value || "";
}

function normalizeRange(value: string): SiteMonitorRange {
  return RANGE_OPTIONS.some((item) => item.id === value) ? value as SiteMonitorRange : "today";
}

function formatChinaTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(date).replace("/", "-").replace("/", "-");
}

function typeClass(row: SiteMonitorRow) {
  if (row.type === "前台访问") return styles.typePublic;
  if (row.type === "后台登录") return styles.typeLogin;
  return styles.typeAdmin;
}

function hrefFor(range: SiteMonitorRange, query: string) {
  const params = new URLSearchParams({ range });
  if (query) params.set("q", query);
  return `/site-monitor?${params.toString()}`;
}

export default async function SiteMonitorPage({ searchParams }: PageProps) {
  const viewer = await getAdminViewer();
  if (!viewer) redirect("/admin/login?next=%2Fsite-monitor");
  if (viewer.username !== "admin" || viewer.role !== "system_admin") notFound();

  const params = await searchParams;
  const range = normalizeRange(first(params.range));
  const query = first(params.q).trim().slice(0, 80);
  const rows = await getSiteMonitorRows(viewer.username, { range, query });

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

          <span className={styles.count}>显示 {rows.length} 条 · 最多 500 条</span>
        </div>

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
            <div className={styles.empty}>当前筛选条件下还没有记录。</div>
          )}
        </section>
      </div>
    </main>
  );
}
