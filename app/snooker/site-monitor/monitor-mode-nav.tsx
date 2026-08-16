"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./monitor-switch.module.css";

export default function MonitorModeNav() {
  const pathname = usePathname();
  const dataActive = pathname.startsWith("/snooker/site-monitor/data");

  return (
    <div className={styles.bar}>
      <div>
        <strong>网站监测</strong>
        <small>访问行为与数据链路分开查看</small>
      </div>
      <nav aria-label="监测模式切换">
        <Link className={!dataActive ? styles.active : ""} href="/snooker/site-monitor">用户访问监测</Link>
        <Link className={dataActive ? styles.active : ""} href="/snooker/site-monitor/data">数据源监测</Link>
      </nav>
    </div>
  );
}
