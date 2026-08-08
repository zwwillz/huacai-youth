"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

type PendingNavigation = { origin: string; target: string; label: string };

function navigationKey(pathname: string, search: string) {
  return `${pathname}${search ? `?${search}` : ""}`;
}

export default function AdminNavigationFeedback() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentKey = useMemo(() => navigationKey(pathname, searchParams.toString()), [pathname, searchParams]);
  const [pending, setPending] = useState<PendingNavigation | null>(null);
  const [visibleTarget, setVisibleTarget] = useState("");
  const busy = Boolean(pending && pending.origin === currentKey && pending.target !== currentKey);
  const visible = Boolean(busy && pending && visibleTarget === pending.target);

  useEffect(() => {
    if (!busy || !pending) return;
    const target = pending.target;
    const timer = window.setTimeout(() => setVisibleTarget(target), 180);
    return () => window.clearTimeout(timer);
  }, [busy, pending]);

  useEffect(() => {
    const begin = (target: string, label: string) => setPending({ origin: currentKey, target, label: label || "后台页面" });
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = (event.target as Element | null)?.closest("a");
      if (!anchor || anchor.target || anchor.hasAttribute("download")) return;
      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin || !url.pathname.startsWith("/admin")) return;
      const target = navigationKey(url.pathname, url.searchParams.toString());
      if (target === currentKey) return;
      begin(target, anchor.textContent?.replace(/\s+/g, " ").trim().slice(0, 28) || "后台页面");
    };
    const onProgrammaticNavigation = (event: Event) => {
      const detail = (event as CustomEvent<{ target?: string; label?: string }>).detail;
      if (!detail?.target) return;
      const url = new URL(detail.target, window.location.href);
      begin(navigationKey(url.pathname, url.searchParams.toString()), detail.label || "后台页面");
    };
    document.addEventListener("click", onClick, true);
    window.addEventListener("admin:navigation-start", onProgrammaticNavigation);
    return () => {
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("admin:navigation-start", onProgrammaticNavigation);
    };
  }, [currentKey]);

  if (!visible) return null;
  return <div className="admin-navigation-feedback" role="status" aria-live="polite" aria-label={`正在打开${pending?.label || "后台页面"}`}>
    <span className="admin-navigation-progress" />
  </div>;
}
