"use client";

import { useEffect, useRef } from "react";

const sectionTitles: Record<string, string> = {
  dashboard: "工作台",
  events: "赛事管理",
  content: "内容发布",
  registrations: "报名审核",
  players: "球员管理",
  competition: "竞赛执行",
  rankings: "排名积分",
  accounts: "账号与日志",
};

const globalTitles = new Set(["工作台", "赛事管理", "排名积分", "账号与日志"]);

export default function AdminDashboardBridge() {
  const initialized = useRef(false);

  useEffect(() => {
    let applying = false;
    const applyContext = () => {
      if (applying) return;
      applying = true;
      try {
        const title = document.querySelector<HTMLElement>(".backend-topbar h1")?.textContent?.trim() || "";
        const eventSelect = document.querySelector<HTMLElement>(".backend-event-select");
        if (eventSelect) eventSelect.style.display = globalTitles.has(title) ? "none" : "";

        if (!initialized.current) {
          const navButtons = Array.from(document.querySelectorAll<HTMLButtonElement>(".backend-sidebar nav button"));
          if (!navButtons.length) return;

          const params = new URLSearchParams(window.location.search);
          const requestedSection = params.get("section");
          const requestedTitle = requestedSection ? sectionTitles[requestedSection] : "";
          if (requestedTitle) {
            const target = navButtons.find((button) => button.querySelector("strong")?.textContent?.trim() === requestedTitle);
            if (target && !target.classList.contains("active")) target.click();
          }

          const requestedEvent = params.get("event");
          const select = document.querySelector<HTMLSelectElement>(".backend-event-select select");
          if (requestedEvent && select && Array.from(select.options).some((option) => option.value === requestedEvent)) {
            select.value = requestedEvent;
            select.dispatchEvent(new Event("change", { bubbles: true }));
          }
          initialized.current = true;
        }
      } finally {
        applying = false;
      }
    };

    const observer = new MutationObserver(applyContext);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    applyContext();
    return () => observer.disconnect();
  }, []);

  return null;
}
