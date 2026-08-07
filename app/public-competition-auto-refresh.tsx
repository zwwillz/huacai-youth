"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * 公开竞赛页保持原UI不变，只定时刷新服务端数据。
 * 后台确认赛果、晋级或新签表后，已打开的赛程/对阵/排名页无需用户手工刷新浏览器。
 */
export default function PublicCompetitionAutoRefresh() {
  const router = useRouter();

  useEffect(() => {
    const refreshIfNeeded = () => {
      if (document.hidden) return;
      if (!document.querySelector(".content.public-competition-mode")) return;
      router.refresh();
    };
    const timer = window.setInterval(refreshIfNeeded, 20_000);
    const onVisibility = () => { if (!document.hidden) refreshIfNeeded(); };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [router]);

  return null;
}
