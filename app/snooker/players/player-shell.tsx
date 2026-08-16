"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type ReactNode, useEffect, useState } from "react";
import styles from "./player.module.css";

type Theme = "green" | "red";

const navItems = [
  { label: "首页", icon: "⌂", href: "/snooker" },
  { label: "比赛", icon: "◫", href: "/snooker?view=matches" },
  { label: "球员", icon: "◎", href: "/snooker/players" },
  { label: "数据", icon: "▥", href: "/snooker?view=data" },
] as const;

export default function PlayerShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [theme, setTheme] = useState<Theme>("green");

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem("snooker-data-theme");
      if (saved === "green" || saved === "red") setTheme(saved);
    } catch {
      // Theme persistence is optional.
    }
  }, []);

  const chooseTheme = (nextTheme: Theme) => {
    setTheme(nextTheme);
    try {
      window.localStorage.setItem("snooker-data-theme", nextTheme);
    } catch {
      // Ignore storage failures.
    }
  };

  return (
    <main className={styles.appRoot} data-theme={theme}>
      <div className={styles.shell}>
        <header className={styles.header}>
          <Link className={styles.brand} href="/snooker" aria-label="返回世界斯诺克数据中心首页">
            <span>S</span>
            <div><strong>世界斯诺克数据中心</strong><small>WORLD SNOOKER DATA</small></div>
          </Link>
          <div className={styles.headerRight}>
            <span className={styles.versionBadge}>PLAYER v0.4</span>
            <div className={styles.themeSwitch} aria-label="主题色">
              <button className={theme === "green" ? styles.themeActive : ""} onClick={() => chooseTheme("green")}>绿</button>
              <button className={theme === "red" ? styles.themeActive : ""} onClick={() => chooseTheme("red")}>红</button>
            </div>
          </div>
        </header>

        <div className={styles.content}>{children}</div>

        <nav className={styles.bottomNav} aria-label="世界斯诺克数据中心主导航">
          {navItems.map((item) => (
            <button
              className={item.label === "球员" ? styles.navActive : ""}
              onClick={() => router.push(item.href)}
              key={item.label}
            >
              <span>{item.icon}</span><b>{item.label}</b>
            </button>
          ))}
        </nav>
      </div>
    </main>
  );
}
