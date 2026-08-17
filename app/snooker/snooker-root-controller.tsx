"use client";

import { type ComponentProps, useEffect, useMemo, useState } from "react";
import SnookerDataCenterV2 from "./snooker-data-center-v2";
import SnookerViewUrlSync from "./snooker-view-url-sync";
import PlayerDetailInline, { type PlayerRootView } from "./players/player-detail-inline";

type DataCenterProps = ComponentProps<typeof SnookerDataCenterV2>;
type OpenPlayerDetail = { slug: string };

function rootViewFromUrl(url: URL): PlayerRootView {
  const view = url.searchParams.get("view");
  if (view === "matches" || view === "players" || view === "data") return view;
  return "home";
}

function rootHref(view: PlayerRootView, playerSlug?: string | null) {
  const params = new URLSearchParams();
  if (view !== "home") params.set("view", view);
  if (view === "players" && playerSlug) params.set("player", playerSlug);
  const query = params.toString();
  return `/snooker${query ? `?${query}` : ""}`;
}

export default function SnookerRootController({
  initialPlayerSlug = null,
  ...dataCenterProps
}: DataCenterProps & { initialPlayerSlug?: string | null }) {
  const initialRootView = dataCenterProps.initialView ?? "home";
  const [playerSlug, setPlayerSlug] = useState<string | null>(initialPlayerSlug);
  const [rootView, setRootView] = useState<PlayerRootView>(initialRootView);
  const [rootKey, setRootKey] = useState(0);

  const summaryPlayer = useMemo(
    () => playerSlug ? dataCenterProps.initialSnapshot.players.find((player) => player.slug === playerSlug) : undefined,
    [dataCenterProps.initialSnapshot.players, playerSlug],
  );

  useEffect(() => {
    const onOpenPlayer = (event: Event) => {
      const custom = event as CustomEvent<OpenPlayerDetail>;
      const slug = custom.detail?.slug?.trim();
      if (!slug) return;
      setRootView("players");
      setPlayerSlug(slug);
      window.history.pushState(window.history.state, "", rootHref("players", slug));
      window.scrollTo({ top: 0, behavior: "auto" });
    };

    const onPopState = () => {
      const url = new URL(window.location.href);
      const nextView = rootViewFromUrl(url);
      const nextPlayer = nextView === "players" ? url.searchParams.get("player") : null;
      if (nextPlayer) {
        setRootView("players");
        setPlayerSlug(nextPlayer);
      } else {
        const wasPlayerDetail = Boolean(playerSlug);
        setPlayerSlug(null);
        if (!wasPlayerDetail && nextView !== rootView) {
          setRootView(nextView);
          setRootKey((value) => value + 1);
        }
      }
      window.scrollTo({ top: 0, behavior: "auto" });
    };

    window.addEventListener("snooker:open-player", onOpenPlayer as EventListener);
    window.addEventListener("popstate", onPopState);
    return () => {
      window.removeEventListener("snooker:open-player", onOpenPlayer as EventListener);
      window.removeEventListener("popstate", onPopState);
    };
  }, [playerSlug, rootView]);

  const navigateFromDetail = (view: PlayerRootView) => {
    setPlayerSlug(null);
    if (view !== "players") {
      setRootView(view);
      setRootKey((value) => value + 1);
    } else {
      setRootView("players");
    }
    window.history.replaceState(window.history.state, "", rootHref(view));
    window.scrollTo({ top: 0, behavior: "auto" });
  };

  return (
    <>
      <SnookerViewUrlSync />
      <div style={{ display: playerSlug ? "none" : undefined }} aria-hidden={playerSlug ? true : undefined}>
        <SnookerDataCenterV2 key={rootKey} {...dataCenterProps} initialView={rootView} />
      </div>
      {playerSlug ? <PlayerDetailInline key={playerSlug} summaryPlayer={summaryPlayer} slug={playerSlug} onNavigate={navigateFromDetail} /> : null}
    </>
  );
}
