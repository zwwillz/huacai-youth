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
  const inline: ScrollLogicalPosition = index <= 0 ? "start" : index >= buttons.length - 1 ? "end" : "center";
  active.scrollIntoView({ block: "nearest", inline, behavior: "smooth" });
  // Keep vertical position completely untouched; only the horizontal date strip should move.
  nav.scrollTop = 0;
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
  }

  const active = buttons.find((button) => button.classList.contains("active"));
  if (!active) return;
  replaceDateParam(buttonDate(active));
  positionActiveDay(nav, buttons, active);
}

export default function PublicUxEnhancer() {
  useEffect(() => {
    let frame = 0;
    const queueSync = (preferUrl = false) => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => syncMatchDay(preferUrl));
    };

    const root = document.querySelector<HTMLElement>("main[data-huacai-view]");
    const observer = root ? new MutationObserver(() => queueSync(true)) : null;
    observer?.observe(root!, { childList: true, subtree: true });

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
    };
  }, []);

  return null;
}
