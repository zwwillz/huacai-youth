"use client";

import { useEffect } from "react";
import type { VisitorGeoPayload } from "@/lib/site-monitor";

const VISITOR_KEY = "huacai_public_visitor_v1";
const GEO_KEY = "huacai_public_geo_v1";
const EXCLUDED_PREFIXES = ["/admin", "/site-monitor", "/api"];
const WECHAT_VERIFY_PATH = "/dd8ad1096190a17bbcd86e01faa9c979.txt";

const TAB_LABELS: Record<string, string> = {
  overview: "赛事概览",
  rules: "竞赛规程",
  schedule: "赛程",
  matches: "对阵",
  rankings: "排名",
  guide: "参赛指南",
};

type GeoResponse = VisitorGeoPayload;

function createVisitorId() {
  try {
    const current = window.localStorage.getItem(VISITOR_KEY);
    if (current && /^[a-zA-Z0-9._-]{8,80}$/.test(current)) return current;
    const next = globalThis.crypto?.randomUUID?.() || `visitor_${Date.now()}_${Math.random().toString(36).slice(2, 12)}`;
    window.localStorage.setItem(VISITOR_KEY, next);
    return next;
  } catch {
    return `session_${Date.now()}_${Math.random().toString(36).slice(2, 12)}`;
  }
}

function excludedPath(pathname: string) {
  return pathname === WECHAT_VERIFY_PATH || EXCLUDED_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

function readCachedGeo(): GeoResponse | null {
  try {
    const raw = window.sessionStorage.getItem(GEO_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === "object" ? parsed as GeoResponse : null;
  } catch {
    return null;
  }
}

function cacheGeo(value: GeoResponse) {
  try {
    window.sessionStorage.setItem(GEO_KEY, JSON.stringify(value));
  } catch {
    // Geo is an optional enhancement; tracking must still work without storage.
  }
}

async function loadGeo(): Promise<GeoResponse> {
  const cached = readCachedGeo();
  if (cached) return cached;
  try {
    const response = await fetch("/api/visitor-geo", { cache: "no-store", credentials: "same-origin" });
    if (!response.ok) return {};
    const data = await response.json() as GeoResponse;
    cacheGeo(data);
    return data;
  } catch {
    return {};
  }
}

function currentPageContext() {
  const pathname = window.location.pathname;
  const params = new URLSearchParams(window.location.search);
  const requestedEventId = params.get("event") || "";
  const root = document.querySelector<HTMLElement>("main[data-huacai-view]");
  const view = root?.dataset.huacaiView || "";
  const stationId = root?.dataset.huacaiStation || "";
  const tab = root?.dataset.huacaiTab || "";
  const headerTitle = document.querySelector<HTMLElement>("header.top h3")?.textContent?.trim() || "";

  let pageLabel = pathname === "/" ? "赛事中心" : pathname;
  let eventId = "";
  let eventLabel = "";

  if (pathname.startsWith("/guide/")) {
    pageLabel = "参赛指南";
    eventId = requestedEventId;
  } else if (view === "players") {
    pageLabel = "球员数据";
  } else if (view === "me") {
    pageLabel = "个人中心";
  } else if (view === "event" && stationId) {
    eventId = requestedEventId;
    eventLabel = headerTitle || stationId;
    pageLabel = `${eventLabel} · ${TAB_LABELS[tab] || "赛事页面"}`;
  } else if (view === "event") {
    pageLabel = "赛事中心";
  }

  return {
    path: `${pathname}${window.location.search}`,
    pageLabel,
    eventId,
    eventLabel,
    key: `${view}|${stationId}|${tab}|${pathname}|${window.location.search}`,
  };
}

export default function PublicVisitTracker() {
  useEffect(() => {
    if (excludedPath(window.location.pathname)) return;

    const visitorId = createVisitorId();
    const geoPromise = loadGeo();
    let lastKey = "";
    let lastTrackedAt = 0;
    let timer = 0;

    const track = () => {
      if (excludedPath(window.location.pathname)) return;
      window.clearTimeout(timer);
      timer = window.setTimeout(async () => {
        const context = currentPageContext();
        const now = Date.now();
        if (context.key === lastKey && now - lastTrackedAt < 20_000) return;
        lastKey = context.key;
        lastTrackedAt = now;
        const geo = await geoPromise;
        void fetch("/api/public/visit", {
          method: "POST",
          credentials: "same-origin",
          keepalive: true,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            visitorId,
            path: context.path,
            pageLabel: context.pageLabel,
            eventId: context.eventId,
            eventLabel: context.eventLabel,
            referrer: document.referrer || "",
            geo,
          }),
        }).catch(() => undefined);
      }, 120);
    };

    const onNavigation = () => track();
    const onPopState = () => track();
    window.addEventListener("huacai:navigation", onNavigation as EventListener);
    window.addEventListener("popstate", onPopState);
    timer = window.setTimeout(track, 500);

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("huacai:navigation", onNavigation as EventListener);
      window.removeEventListener("popstate", onPopState);
    };
  }, []);

  return null;
}
