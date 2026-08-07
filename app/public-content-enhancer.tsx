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

const dynamicGuideCss = `
.tip-links .dynamic-guide-link{border:0;background:#fff;display:grid;grid-template-columns:42px minmax(0,1fr) auto;gap:10px;align-items:center;padding:12px;border-radius:12px;color:inherit;text-decoration:none;cursor:pointer}
.tip-links .dynamic-guide-link>span{width:40px;height:40px;border-radius:11px;color:#fff;background:linear-gradient(145deg,#6a34d1,#d9479c);display:grid;place-items:center;font-size:10px;font-weight:900}
.tip-links .dynamic-guide-link>div{display:flex;flex-direction:column;gap:3px;min-width:0}.tip-links .dynamic-guide-link strong{font-size:11px}.tip-links .dynamic-guide-link small{color:#8e8694;font-size:8px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.tip-links .dynamic-guide-link>b{color:#68409f;font-size:9px}
`;

export default function PublicContentEnhancer({ states }: { states: PublicContentState[] }) {
  useEffect(() => {
    if (!document.getElementById("dynamic-guide-styles")) {
      const style = document.createElement("style");
      style.id = "dynamic-guide-styles";
      style.textContent = dynamicGuideCss;
      document.head.append(style);
    }

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
      const competitionOpened = state.publishedModules.includes("schedule");

      document.querySelectorAll<HTMLButtonElement>(".tabs button").forEach((button) => {
        const label = button.textContent?.trim() ?? "";
        const moduleType = tabModules[label];
        if (!moduleType) {
          button.style.display = "";
          return;
        }
        // 一旦赛程正式发布，赛程、对阵、排名三个竞赛入口全部开放。
        // 后续模块即使暂时没有数据，也由对应页面显示“待公布/等待上一阶段”的说明，避免用户找不到入口。
        const visible = moduleType === "regulation"
          ? state.publishedModules.includes("regulation")
          : competitionOpened || state.publishedModules.includes(moduleType);
        button.style.display = visible ? "" : "none";
      });

      const tipSection = document.querySelector<HTMLElement>(".participant-tips");
      const tipLinks = tipSection?.querySelector<HTMLElement>(".tip-links");
      if (tipSection && tipLinks) {
        const signature = state.guides.map((guide) => guide.id).join("|");
        if (tipLinks.dataset.guideSignature !== signature) {
          tipLinks.replaceChildren();
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
          tipLinks.dataset.guideSignature = signature;
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

    window.addEventListener("huacai:navigation", sync);
    sync();
    return () => window.removeEventListener("huacai:navigation", sync);
  }, [states]);

  return null;
}
