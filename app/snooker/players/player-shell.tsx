"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type MouseEvent, type ReactNode, useState } from "react";
import styles from "./player.module.css";

type Theme = "green" | "red";
export type PlayerShellView = "home" | "matches" | "players" | "data";

const navItems: Array<{ id: PlayerShellView; label: string; icon: string; href: string }> = [
  { id: "home", label: "首页", icon: "⌂", href: "/snooker" },
  { id: "matches", label: "赛事", icon: "◫", href: "/snooker?view=matches" },
  { id: "players", label: "球员", icon: "◎", href: "/snooker?view=players" },
  { id: "data", label: "数据", icon: "▥", href: "/snooker?view=data" },
];

export default function PlayerShell({ children, onNavigate }: { children: ReactNode; onNavigate?: (view: PlayerShellView) => void }) {
  const router = useRouter();
  const [theme, setTheme] = useState<Theme>("green");

  const handleBrand = (event: MouseEvent<HTMLAnchorElement>) => {
    if (!onNavigate || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    onNavigate("home");
  };

  return (
    <main className={styles.appRoot} data-theme={theme}>
      <div className={styles.shell}>
        <header className={styles.header}>
          <Link className={styles.brand} href="/snooker" prefetch aria-label="返回世界斯诺克数据中心首页" onClick={handleBrand}>
            <span>S</span>
            <div><strong>世界斯诺克数据中心</strong><small>WORLD SNOOKER DATA</small></div>
          </Link>
          <div className={styles.headerRight}>
            <span className={styles.versionBadge}>PLAYER v0.4</span>
            <div className={styles.themeSwitch} aria-label="主题色">
              <button className={theme === "green" ? styles.themeActive : ""} onClick={() => setTheme("green")}>绿</button>
              <button className={theme === "red" ? styles.themeActive : ""} onClick={() => setTheme("red")}>红</button>
            </div>
          </div>
        </header>

        <div className={styles.content}>{children}</div>

        <nav className={styles.bottomNav} aria-label="世界斯诺克数据中心主导航">
          {navItems.map((item) => (
            <button
              className={item.id === "players" ? styles.navActive : ""}
              onPointerDown={() => { if (!onNavigate) router.prefetch(item.href); }}
              onClick={() => onNavigate ? onNavigate(item.id) : router.push(item.href)}
              key={item.id}
            >
              <span>{item.icon}</span><b>{item.label}</b>
            </button>
          ))}
        </nav>
      </div>
    </main>
  );
}
