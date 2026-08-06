"use client";

import { useEffect } from "react";
import type { PublicContentState } from "@/db/public-content";

const tabModules: Record<string, string> = {
  "竞赛规程": "regulation",
  "赛程": "schedule",
  "对阵": "matches",
  "排名": "rankings",
};

function guideIcon(title: string, guideType: string) {
  if (guideType === "transport" || /交通|住宿|停车/.test(title)) return "行";
  if (guideType === "clothing" || /服装|着装/.test(title)) return "装";
  if (/报到|签到|检录/.test(title)) return "报";
  if (/餐|饮食/.test(title)) return "食";
  if (/天气|气温/.test(title)) return "天";
  return title.slice(0, 1) || "提";
}

export default function PublicContentEnhancer({ states }: { states: PublicContentState[] }) {
  useEffect(() => {
    const stateMap = new Map(states.map((state) => [state.stationId, state]));
    let currentStationId = "";

    const detectCurrentStation = () => {
      const hero = document.querySelector<HTMLElement>(".station-hero");
      if (!hero) return;
      const stationClass = Array.from(hero.classList).find((name) => name.startsWith("station-") && name !== "station-hero");
      if (stationClass) currentStationId = stationClass.slice("station-".length);
    };

    const sync = () => {
      detectCurrentStation();
      const state = stateMap.get(currentStationId);
      if (!state) return;

      document.querySelectorAll<HTMLButtonElement>(".tabs button").forEach((button) => {
        const label = button.textContent?.trim() ?? "";
        const moduleType = tabModules[label];
        if (!moduleType) {
          button.style.display = "";
          return;
        }
        button.style.display = state.publishedModules.includes(moduleType) ? "" : "none";
      });

      const tipSection = document.querySelector<HTMLElement>(".participant-tips");
      const tipLinks = tipSection?.querySelector<HTMLElement>(".tip-links");
      if (tipSection && tipLinks) {
        Array.from(tipLinks.children).forEach((child) => child.remove());
        for (const guide of state.guides) {
          const link = document.createElement("a");
          link.href = `/guide/${encodeURIComponent(guide.id)}`;
          link.className = "dynamic-guide-link";
          link.setAttribute("data-dynamic-guide", guide.id);

          const icon = document.createElement("span");
          icon.textContent = guideIcon(guide.title, guide.guideType);
          const copy = document.createElement("div");
          const strong = document.createElement("strong");
          strong.textContent = guide.title;
          const small = document.createElement("small");
          small.textContent = "查看组委会发布的参赛提示";
          copy.append(strong, small);
          const arrow = document.createElement("b");
          arrow.textContent = "查看 ›";
          link.append(icon, copy, arrow);
          tipLinks.append(link);
        }
        tipSection.style.display = state.guides.length ? "" : "none";
      }

      const pdfButtons = Array.from(document.querySelectorAll<HTMLAnchorElement>(".pdf-actions .pdf-button"));
      if (pdfButtons[0]) {
        pdfButtons[0].style.display = state.documents.regulation.published ? "" : "none";
        if (state.documents.regulation.url) pdfButtons[0].href = state.documents.regulation.url;
      }
      if (pdfButtons[1]) {
        pdfButtons[1].style.display = state.documents.referee_list.published ? "" : "none";
        if (state.documents.referee_list.url) pdfButtons[1].href = state.documents.referee_list.url;
      }
    };

    const observer = new MutationObserver(sync);
    observer.observe(document.body, { childList: true, subtree: true });
    sync();
    return () => observer.disconnect();
  }, [states]);

  return null;
}
