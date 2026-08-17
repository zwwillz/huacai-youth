import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";

function replaceOrThrow(source, pattern, replacement, label) {
  if (typeof pattern === "string") {
    if (!source.includes(pattern)) throw new Error(`Missing patch anchor: ${label}`);
    return source.replace(pattern, replacement);
  }
  if (!pattern.test(source)) throw new Error(`Missing patch anchor: ${label}`);
  return source.replace(pattern, () => replacement);
}

const rootPath = "app/snooker/snooker-data-center-v2.tsx";
let root = readFileSync(rootPath, "utf8");

root = replaceOrThrow(root, 'import { useRouter } from "next/navigation";\n', "", "remove-use-router");
root = replaceOrThrow(root, 'import { PlayerDirectoryContent } from "./players/player-directory";\n', 'import { PlayerDirectoryContent } from "./players/player-directory";\nimport PlayerDetailInline from "./players/player-detail-inline";\nimport { prefetchPlayerDetail } from "./players/player-detail-client";\n', "player-imports");
root = replaceOrThrow(root, 'type DetailState =\n  | { type: "event"; slug: string; tab: EventTab }\n  | { type: "match"; matchId: string; eventSlug: string };\n', 'type DetailState =\n  | { type: "event"; slug: string; tab: EventTab }\n  | { type: "match"; matchId: string; eventSlug: string }\n  | { type: "player"; slug: string; returnView: MainView };\n', "player-detail-state");
root = replaceOrThrow(root, '  initialView = "home",\n}: {', '  initialView = "home",\n  initialPlayerSlug,\n}: {', "player-prop-arg");
root = replaceOrThrow(root, '  initialView?: MainView;\n}) {\n  const router = useRouter();\n', '  initialView?: MainView;\n  initialPlayerSlug?: string | null;\n}) {\n', "player-prop-type");
root = replaceOrThrow(root, '  const [activeView, setActiveView] = useState<MainView>(initialView);\n  const [detail, setDetail] = useState<DetailState | null>(null);\n', '  const [activeView, setActiveView] = useState<MainView>(initialPlayerSlug ? "players" : initialView);\n  const [detail, setDetail] = useState<DetailState | null>(() => initialPlayerSlug ? { type: "player", slug: initialPlayerSlug, returnView: "players" } : null);\n', "initial-player-state");
root = replaceOrThrow(root, '  const signatures = useRef(new Map(initialDatabaseEvents.flatMap((event) => allMatches(event)).map((match) => [match.id, matchSignature(match)])));\n', '  const signatures = useRef(new Map(initialDatabaseEvents.flatMap((event) => allMatches(event)).map((match) => [match.id, matchSignature(match)])));\n  const playerDirectoryScrollY = useRef(0);\n', "directory-scroll");

const liveEffectEnd = '  }, [hasLiveMatch, refresh]);\n\n  const today = chinaToday();';
const popStateEffect = `  }, [hasLiveMatch, refresh]);

  useEffect(() => {
    const onPopState = (event: PopStateEvent) => {
      const params = new URLSearchParams(window.location.search);
      const playerSlug = params.get("player")?.trim();
      const viewParam = params.get("view");
      const urlView: MainView = viewParam === "matches" || viewParam === "players" || viewParam === "data" ? viewParam : "home";
      const state = event.state as { snookerReturnView?: MainView; snookerReturnDetail?: DetailState | null } | null;

      if (playerSlug) {
        setActiveView("players");
        setDetail({ type: "player", slug: playerSlug, returnView: "players" });
        window.scrollTo({ top: 0, behavior: "auto" });
        return;
      }

      if (state?.snookerReturnDetail && state.snookerReturnDetail.type !== "player") {
        setActiveView(state.snookerReturnView ?? urlView);
        setDetail(state.snookerReturnDetail);
        window.scrollTo({ top: 0, behavior: "auto" });
        return;
      }

      setDetail((current) => current?.type === "player" ? null : current);
      setActiveView(state?.snookerReturnView ?? urlView);
      if ((state?.snookerReturnView ?? urlView) === "players") {
        window.requestAnimationFrame(() => window.scrollTo({ top: playerDirectoryScrollY.current, behavior: "auto" }));
      }
    };

    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const today = chinaToday();`;
root = replaceOrThrow(root, liveEffectEnd, popStateEffect, "popstate-sync");

root = replaceOrThrow(root, /  const openPlayer = \(playerId: string\) => \{[\s\S]*?  const changeView = \(view: NavId\) => \{/, `  const openPlayer = (playerId: string) => {
    const target = players.get(playerId);
    if (!target?.slug) {
      setDetail(null);
      setActiveView("players");
      return;
    }

    if (activeView === "players" && detail === null) playerDirectoryScrollY.current = window.scrollY;
    prefetchPlayerDetail(target.slug);

    const returnDetail = detail;
    const returnView = activeView;
    const currentState = { ...(window.history.state ?? {}), snookerReturnView: returnView, snookerReturnDetail: returnDetail };
    window.history.replaceState(currentState, "", window.location.href);

    const url = new URL(window.location.href);
    url.searchParams.set("view", "players");
    url.searchParams.set("player", target.slug);
    const nextUrl = \`${url.pathname}\${url.search}\${url.hash}\`;
    window.history.pushState({ ...currentState, snookerPlayerDetail: target.slug }, "", nextUrl);

    setActiveView("players");
    setDetail({ type: "player", slug: target.slug, returnView });
    window.scrollTo({ top: 0, behavior: "auto" });
  };
  const closePlayer = () => {
    if (detail?.type !== "player") return;
    const state = window.history.state as { snookerPlayerDetail?: string } | null;
    if (state?.snookerPlayerDetail === detail.slug && window.history.length > 1) {
      window.history.back();
      return;
    }

    const url = new URL(window.location.href);
    url.searchParams.set("view", "players");
    url.searchParams.delete("player");
    window.history.replaceState(window.history.state, "", \`${url.pathname}\${url.search}\${url.hash}\`);
    setDetail(null);
    setActiveView("players");
    window.requestAnimationFrame(() => window.scrollTo({ top: playerDirectoryScrollY.current, behavior: "auto" }));
  };
  const changeView = (view: NavId) => {`, "open-player-inline");

root = replaceOrThrow(root, '  if (detail?.type === "match") {\n', `  if (detail?.type === "player") {
    const summaryPlayer = snapshot.players.find((player) => player.slug === detail.slug);
    return <main className={styles.appRoot} data-theme={theme}><div className={styles.detailShell}>
      <header className={styles.detailHeader}><button onClick={closePlayer}>‹</button><strong>{summaryPlayer?.nameZh ?? "球员详情"}</strong><span>PLAYER</span></header>
      <PlayerDetailInline summaryPlayer={summaryPlayer} slug={detail.slug} />
    </div></main>;
  }

  if (detail?.type === "match") {
`, "player-detail-branch");
root = replaceOrThrow(root, '      {activeView === "players" ? <PlayerDirectoryContent players={directoryPlayers} /> : null}\n', '      {activeView === "players" ? <PlayerDirectoryContent players={directoryPlayers} onOpenPlayer={(player) => openPlayer(player.id)} onPrefetchPlayer={(player) => prefetchPlayerDetail(player.slug)} /> : null}\n', "directory-callbacks");

if (root.includes("/snooker/players/")) throw new Error("Legacy player route remained in root controller");
if (root.includes("useRouter")) throw new Error("useRouter remained in root controller");
writeFileSync(rootPath, root);

const oldDetailPath = "app/snooker/players/[slug]/player-detail.tsx";
let detail = readFileSync(oldDetailPath, "utf8");
detail = replaceOrThrow(detail, 'import PlayerShell from "../player-shell";\n', "", "detail-shell-import");
detail = replaceOrThrow(detail, 'import styles from "../player.module.css";', 'import styles from "./player.module.css";', "detail-style-path");
detail = replaceOrThrow(detail, 'export default function PlayerDetail({ player }: { player: SnookerPlayerDetail }) {', 'export function PlayerDetailContent({ player }: { player: SnookerPlayerDetail }) {', "detail-export");
detail = replaceOrThrow(detail, '  return (\n    <PlayerShell>\n', '  return (\n    <>\n', "detail-fragment-open");
detail = replaceOrThrow(detail, '    </PlayerShell>\n  );\n}', '    </>\n  );\n}\n\nexport default PlayerDetailContent;\n', "detail-fragment-close");
if (detail.includes("PlayerShell")) throw new Error("PlayerShell remained in extracted player detail");
writeFileSync("app/snooker/players/player-detail-content.tsx", detail);

const removed = [
  "app/snooker/players/page.tsx",
  "app/snooker/players/player-shell.tsx",
  "app/snooker/players/[slug]/loading.tsx",
  "app/snooker/players/[slug]/page.tsx",
  "app/snooker/players/[slug]/player-detail.tsx",
];
for (const path of removed) if (existsSync(path)) rmSync(path);

if (existsSync(".github/workflows/apply-player-phase1.yml")) rmSync(".github/workflows/apply-player-phase1.yml");
if (existsSync("scripts/apply-player-phase1.mjs")) rmSync("scripts/apply-player-phase1.mjs");
