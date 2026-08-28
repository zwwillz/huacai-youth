"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

const RETRY_DELAYS = [5_000, 15_000, 30_000] as const;

export default function SnookerDataUnavailable({ attemptedAt }: { attemptedAt: string }) {
  const router = useRouter();
  const [retrying, setRetrying] = useState(false);
  const [lastAttemptAt, setLastAttemptAt] = useState(attemptedAt);
  const attemptRef = useRef(0);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const probe = async () => {
      if (cancelled || document.hidden) {
        schedule();
        return;
      }
      setRetrying(true);
      setLastAttemptAt(new Date().toISOString());
      try {
        const response = await fetch(`/api/snooker/v1/dashboard?scope=core&probe=${Date.now()}`, {
          cache: "no-store",
          headers: { "cache-control": "no-cache" },
        });
        if (response.ok) {
          router.refresh();
          return;
        }
      } catch {
        // The static shell stays visible while the next retry is scheduled.
      } finally {
        if (!cancelled) setRetrying(false);
      }
      attemptRef.current += 1;
      schedule();
    };

    function schedule() {
      if (cancelled) return;
      const delay = RETRY_DELAYS[Math.min(attemptRef.current, RETRY_DELAYS.length - 1)];
      timer = setTimeout(() => void probe(), delay);
    }

    schedule();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [router]);

  const retryNow = () => {
    setRetrying(true);
    setLastAttemptAt(new Date().toISOString());
    fetch(`/api/snooker/v1/dashboard?scope=core&manual=${Date.now()}`, {
      cache: "no-store",
      headers: { "cache-control": "no-cache" },
    })
      .then((response) => {
        if (response.ok) router.refresh();
      })
      .catch(() => undefined)
      .finally(() => setRetrying(false));
  };

  const time = new Date(lastAttemptAt).toLocaleTimeString("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZone: "Asia/Shanghai",
  });

  return (
    <main style={{ minHeight: "100vh", background: "#f4f7f5", color: "#153a2f", padding: "28px 18px 96px" }}>
      <div style={{ maxWidth: 760, margin: "0 auto" }}>
        <header style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 64 }}>
          <span style={{ display: "grid", placeItems: "center", width: 42, height: 42, borderRadius: 12, background: "#0b7a55", color: "white", fontWeight: 800 }}>S</span>
          <div><strong style={{ display: "block", fontSize: 18 }}>世界斯诺克数据中心</strong><small style={{ color: "#648078", letterSpacing: ".08em" }}>WORLD SNOOKER DATA</small></div>
        </header>

        <section style={{ background: "white", borderRadius: 22, padding: "34px 28px", boxShadow: "0 10px 30px rgba(6,61,45,.08)" }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "7px 11px", borderRadius: 999, background: "#eef5f2", color: "#0b7a55", fontSize: 13, fontWeight: 700 }}>
            <i style={{ width: 8, height: 8, borderRadius: 999, background: "currentColor" }} /> 数据连接中
          </span>
          <h1 style={{ margin: "22px 0 10px", fontSize: 30, lineHeight: 1.2 }}>数据服务暂时不可用</h1>
          <p style={{ margin: 0, color: "#60766f", lineHeight: 1.8 }}>当前没有可安全展示的最新业务数据。页面不会使用过期赛事、排名或球员快照替代真实数据；连接恢复后会自动重新加载。</p>

          <div style={{ display: "grid", gap: 10, marginTop: 28, padding: 18, borderRadius: 16, background: "#f7faf8", fontSize: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 20 }}><span style={{ color: "#74877f" }}>当前状态</span><strong>数据库连接异常</strong></div>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 20 }}><span style={{ color: "#74877f" }}>最近尝试</span><strong>{time}</strong></div>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 20 }}><span style={{ color: "#74877f" }}>自动恢复</span><strong>{retrying ? "正在重试…" : "后台自动重试"}</strong></div>
          </div>

          <button onClick={retryNow} disabled={retrying} style={{ marginTop: 24, width: "100%", border: 0, borderRadius: 14, padding: "14px 18px", background: "#0b7a55", color: "white", fontWeight: 800, cursor: retrying ? "wait" : "pointer", opacity: retrying ? .72 : 1 }}>
            {retrying ? "正在重新连接" : "立即重新尝试"}
          </button>
        </section>
      </div>
    </main>
  );
}
