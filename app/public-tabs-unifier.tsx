"use client";

import { useEffect } from "react";

/**
 * Keep database-driven competition tabs visually and behaviorally identical to
 * the native event tabs used by the Langfang station.
 *
 * The live competition enhancer owns schedule/matches/rankings while EventApp
 * owns overview/rules. This bridge makes sure only one side can look active at
 * a time when the user switches back to a native tab.
 */
export default function PublicTabsUnifier() {
  useEffect(() => {
    const sync = () => {
      const tabs = document.querySelector<HTMLElement>(".content > .tabs");
      if (!tabs) return;

      const liveButtons = Array.from(tabs.querySelectorAll<HTMLButtonElement>("button[data-public-comp-tab]"));
      const unified = liveButtons.length > 0;
      tabs.classList.toggle("public-unified-tabs", unified);
      if (unified) tabs.classList.remove("short-tabs");

      // When EventApp has activated 概览 / 竞赛规程, clear any stale active
      // class that the live overlay previously put on 赛程 / 对阵 / 排名.
      const nativeActive = Array.from(tabs.querySelectorAll<HTMLButtonElement>("button.active"))
        .some((button) => !button.dataset.publicCompTab);
      if (nativeActive) liveButtons.forEach((button) => button.classList.remove("active"));
    };

    const onClick = (event: MouseEvent) => {
      const button = (event.target as Element | null)?.closest<HTMLButtonElement>(".content > .tabs button");
      if (!button || button.dataset.publicCompTab) return;

      // Do this immediately, then again after React has committed EventApp's
      // native tab state. This prevents the brief double-active state too.
      document.querySelectorAll<HTMLButtonElement>(".content > .tabs button[data-public-comp-tab]")
        .forEach((item) => item.classList.remove("active"));
      window.requestAnimationFrame(sync);
    };

    window.addEventListener("huacai:navigation", sync);
    document.addEventListener("click", onClick, false);
    sync();

    return () => {
      window.removeEventListener("huacai:navigation", sync);
      document.removeEventListener("click", onClick, false);
    };
  }, []);

  return null;
}
