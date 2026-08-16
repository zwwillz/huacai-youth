import fs from "node:fs";

const uiPath = "app/snooker/snooker-data-center-v2.tsx";
let ui = fs.readFileSync(uiPath, "utf8");

const reactImport = 'import { useCallback, useEffect, useMemo, useRef, useState } from "react";\n';
if (!ui.includes('import { useRouter } from "next/navigation";')) {
  if (!ui.includes(reactImport)) throw new Error("react import marker missing");
  ui = ui.replace(reactImport, reactImport + 'import { useRouter } from "next/navigation";\n');
}

const stateMarker = "  const [snapshot, setSnapshot] = useState(initialSnapshot);\n";
if (!ui.includes("  const router = useRouter();\n")) {
  if (!ui.includes(stateMarker)) throw new Error("state marker missing");
  ui = ui.replace(stateMarker, "  const router = useRouter();\n" + stateMarker);
}

const oldRoutes = '  const openPlayer = (playerId: string) => { setDetail({ type: "player", playerId }); window.scrollTo({ top: 0, behavior: "smooth" }); };\n  const changeView = (view: MainView) => { setDetail(null); setActiveView(view); window.scrollTo({ top: 0, behavior: "smooth" }); };\n';
const newRoutes = '  const openPlayer = (playerId: string) => {\n    const target = players.get(playerId);\n    router.push(target?.slug ? `/snooker/players/${target.slug}` : "/snooker/players");\n  };\n  const changeView = (view: MainView) => {\n    if (view === "players") {\n      router.push("/snooker/players");\n      return;\n    }\n    setDetail(null);\n    setActiveView(view);\n    window.scrollTo({ top: 0, behavior: "smooth" });\n  };\n';

if (ui.includes(oldRoutes)) {
  ui = ui.replace(oldRoutes, newRoutes);
} else if (!ui.includes('router.push(target?.slug ? `/snooker/players/${target.slug}` : "/snooker/players")')) {
  throw new Error("route marker missing");
}

fs.writeFileSync(uiPath, ui);
