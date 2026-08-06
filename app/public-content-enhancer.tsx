"use client";

import { useEffect } from "react";
import type { PublicContentState } from "@/db/public-content";

const tabModules: Record<string, string> = {
  "竞赛规程": "regulation",
  "赛程": "schedule",
  "对阵": "matches",
  "排名": "rankings",
};

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
      const tipButtons = Array.from(document.querySelectorAll<HTMLButtonElement>(".tip-links button"));
      if (tipSection && tipButtons.length >= 2) {
        tipButtons[0].style.display = state.guides.transport.published ? "" : "none";
        tipButtons[1].style.display = state.guides.clothing.published ? "" : "none";
        tipSection.style.display = state.guides.transport.published || state.guides.clothing.published ? "" : "none";
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

      const guidePage = document.querySelector<HTMLElement>(".guide-page");
      if (guidePage) {
        const heading = guidePage.querySelector(".guide-hero h1")?.textContent?.trim();
        const kind = heading?.includes("服装") ? "clothing" : "transport";
        const guide = state.guides[kind];
        const eventLabel = guidePage.querySelector<HTMLElement>(".guide-hero p");
        if (eventLabel) eventLabel.textContent = state.shortTitle;
        const placeholder = guidePage.querySelector<HTMLElement>(".guide-placeholder");
        const title = placeholder?.querySelector<HTMLElement>("h2");
        const body = placeholder?.querySelector<HTMLElement>("p");
        const marker = placeholder?.querySelector<HTMLElement>("span");
        if (guide.published && guide.body) {
          if (marker) marker.textContent = kind === "transport" ? "行" : "装";
          if (title) title.textContent = guide.title;
          if (body) body.textContent = guide.body;
          placeholder?.classList.add("guide-published");
        }
      }
    };

    const observer = new MutationObserver(sync);
    observer.observe(document.body, { childList: true, subtree: true });
    sync();
    return () => observer.disconnect();
  }, [states]);

  return null;
}
