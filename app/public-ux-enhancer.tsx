"use client";

import { useEffect } from "react";

function eventYear() {
  const params = new URLSearchParams(window.location.search);
  const currentDate = params.get("date");
  if (currentDate && /^\d{4}-\d{2}-\d{2}$/.test(currentDate)) return currentDate.slice(0, 4);
  const eventId = params.get("event") || "";
  const match = eventId.match(/_(\d{4})(?:$|_)/);
  return match?.[1] || new Intl.DateTimeFormat("en", { timeZone: "Asia/Shanghai", year: "numeric" }).format(new Date());
}

function buttonDate(button: HTMLButtonElement) {
  const compact = button.querySelector("b")?.textContent?.trim() || "";
  if (!/^\d{2}-\d{2}$/.test(compact)) return "";
  return `${eventYear()}-${compact}`;
}

function replaceDateParam(value: string) {
  if (!value) return;
  const params = new URLSearchParams(window.location.search);
  if (params.get("date") === value) return;
  params.set("date", value);
  window.history.replaceState(window.history.state, "", `${window.location.pathname}?${params.toString()}${window.location.hash}`);
}

function positionActiveDay(nav: HTMLElement, buttons: HTMLButtonElement[], active: HTMLButtonElement) {
  const index = buttons.indexOf(active);
  const maxLeft = Math.max(0, nav.scrollWidth - nav.clientWidth);
  const centered = active.offsetLeft - (nav.clientWidth - active.offsetWidth) / 2;
  const left = index <= 0 ? 0 : index >= buttons.length - 1 ? maxLeft : Math.min(maxLeft, Math.max(0, centered));
  nav.scrollTo({ left, behavior: "smooth" });
}

function currentEventFinished() {
  const status = document.querySelector<HTMLElement>(".station-hero .live")?.textContent || "";
  return status.includes("已结束") || status.includes("已归档");
}

function syncMatchDay(preferUrl: boolean) {
  const nav = document.querySelector<HTMLElement>(".match-days");
  if (!nav) return;
  const buttons = Array.from(nav.querySelectorAll<HTMLButtonElement>("button"));
  if (!buttons.length) return;

  if (preferUrl) {
    const requested = new URLSearchParams(window.location.search).get("date");
    const requestedButton = requested ? buttons.find((button) => buttonDate(button) === requested) : undefined;
    if (requestedButton && !requestedButton.classList.contains("active")) {
      requestedButton.click();
      return;
    }
    if (!requestedButton && currentEventFinished()) {
      const last = buttons.at(-1);
      if (last && !last.classList.contains("active")) {
        last.click();
        return;
      }
    }
  }

  const active = buttons.find((button) => button.classList.contains("active"));
  if (!active) return;
  replaceDateParam(buttonDate(active));
  positionActiveDay(nav, buttons, active);
}

function createMobileStageTopbar(detail: HTMLElement) {
  const bar = document.createElement("div");
  bar.className = "public-mobile-stage-topbar";

  const back = document.createElement("button");
  back.type = "button";
  back.className = "public-mobile-stage-back";
  back.textContent = "‹ 返回";
  back.setAttribute("aria-label", "返回赛程页");
  back.addEventListener("click", () => {
    detail.closest(".public-competition-overlay")?.querySelector<HTMLButtonElement>(".draw-back")?.click();
  });

  const title = document.createElement("strong");
  title.className = "public-mobile-stage-title";

  bar.append(back, title);
  detail.prepend(bar);
  return bar;
}

function syncMobileStageShell() {
  const detail = document.querySelector<HTMLElement>(".public-live-stage-detail");
  document.documentElement.classList.toggle("public-stage-detail-open", Boolean(detail));
  if (!detail) return;

  const bar = detail.querySelector<HTMLElement>(".public-mobile-stage-topbar") ?? createMobileStageTopbar(detail);
  const title = bar.querySelector<HTMLElement>(".public-mobile-stage-title");
  const stationTitle = document.querySelector<HTMLElement>("main[data-huacai-view] > .top h3")?.textContent?.trim()
    || detail.querySelector<HTMLElement>(".event-name-kicker")?.textContent?.trim()
    || "赛程表";
  if (title && title.textContent !== stationTitle) title.textContent = stationTitle;
}

export default function PublicUxEnhancer() {
  useEffect(() => {
    let frame = 0;
    const queueSync = (preferUrl = false) => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        syncMatchDay(preferUrl);
        syncMobileStageShell();
      });
    };

    const root = document.querySelector<HTMLElement>("main[data-huacai-view]");
    const observer = root ? new MutationObserver(() => queueSync(true)) : null;
    if (root && observer) observer.observe(root, { childList: true, subtree: true });

    const onClick = (event: MouseEvent) => {
      const button = (event.target as HTMLElement | null)?.closest<HTMLButtonElement>(".match-days button");
      if (!button) return;
      const value = buttonDate(button);
      if (value) replaceDateParam(value);
      queueSync(false);
    };
    const onPopState = () => queueSync(true);
    document.addEventListener("click", onClick, true);
    window.addEventListener("popstate", onPopState);
    queueSync(true);

    return () => {
      observer?.disconnect();
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("popstate", onPopState);
      window.cancelAnimationFrame(frame);
      document.documentElement.classList.remove("public-stage-detail-open");
    };
  }, []);

  return null;
}
