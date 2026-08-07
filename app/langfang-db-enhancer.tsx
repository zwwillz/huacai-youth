"use client";

import { useEffect } from "react";
import type { CompetitionMatch } from "@/db/competition-matches";

type Group = "少年组" | "青年组";

const POOLS = ["A","B","C","D","E","F","G","H"] as const;

function isLangfangContext(){
  const title=document.querySelector<HTMLElement>(".top h3")?.textContent?.trim()??"";
  return title.includes("廊坊");
}

function readGroup(root: ParentNode): Group {
  return root.querySelector<HTMLElement>(".group-switch button.active span")?.textContent?.trim() === "青年组" ? "青年组" : "少年组";
}

function setText(el: Element | null, value: string) {
  if (el && el.textContent !== value) el.textContent = value;
}

function displayDate(value: string) {
  const [,m,d] = value.split("-");
  return m && d ? `${Number(m)}月${Number(d)}日` : value;
}

function activeDay(root: ParentNode) {
  const text = root.querySelector<HTMLElement>(".match-days button.active b")?.textContent?.trim();
  return text ? `2026-${text}` : "";
}

function scoreValue(value: string | null) {
  if (value == null || value === "") return null;
  if (value.trim().toUpperCase() === "X") return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function winner(match: CompetitionMatch) {
  const a = scoreValue(match.scoreA);
  const b = scoreValue(match.scoreB);
  if (a == null || b == null || a === b) return "晋级者待定";
  return a > b ? match.playerA : match.playerB;
}

function isThirdPlace(match: CompetitionMatch) {
  const value = match.round.replace(/\s/g, "");
  return /三[、,，]?四名/.test(value) || value.includes("季军赛") || value.includes("季军决赛");
}

function isFinal(match: CompetitionMatch) {
  return !isThirdPlace(match) && match.round.replace(/\s/g, "") === "决赛";
}

function patchMatchList(allMatches: CompetitionMatch[]) {
  const page = document.querySelector<HTMLElement>(".match-list-page");
  if (!page) return;
  const group = readGroup(page);
  const day = activeDay(page);
  if (!day) return;

  const candidates = allMatches.filter(match => match.group === group && match.date === day);
  const cards = Array.from(page.querySelectorAll<HTMLElement>(".versus-card"));
  const used = new Set<string>();

  for (const card of cards) {
    const names = Array.from(card.querySelectorAll<HTMLElement>(".match-player strong")).map(el => el.textContent?.trim() ?? "");
    const time = card.querySelector<HTMLElement>("header b")?.textContent?.trim() ?? "";
    const match = candidates.find(item => !used.has(item.id) && item.playerA === names[0] && item.playerB === names[1] && item.time === time)
      ?? candidates.find(item => !used.has(item.id) && item.playerA === names[0] && item.playerB === names[1]);
    if (!match) continue;
    used.add(match.id);

    const score = match.scoreA != null && match.scoreB != null ? `${match.scoreA} : ${match.scoreB}` : "— : —";
    setText(card.querySelector(".match-center > strong"), score);

    const table = card.querySelector<HTMLElement>(".match-center > b");
    if (table) {
      const label = match.table || match.matchCode;
      if (label) setText(table, label);
      table.classList.toggle("tv", match.isTv);
    }
  }
}

function patchArticle(article: HTMLElement | undefined, match: CompetitionMatch | undefined, gameLabel?: string) {
  if (!article || !match) return;
  article.dataset.dbMatchId = match.id;
  article.dataset.dbMatchCode = match.matchCode;
  const lines = article.querySelectorAll<HTMLElement>(".stage-competitor");
  if (lines[0]) {
    setText(lines[0].querySelector("span"), match.playerA);
    setText(lines[0].querySelector("b"), match.scoreA ?? "—");
  }
  if (lines[1]) {
    setText(lines[1].querySelector("span"), match.playerB);
    setText(lines[1].querySelector("b"), match.scoreB ?? "—");
  }
  setText(article.querySelector(".stage-between time"), `${displayDate(match.date)} ${match.time}`.trim());
  const table = article.querySelector<HTMLElement>(".stage-between span");
  if (table) {
    setText(table, match.table || match.matchCode || "球台待定");
    table.classList.toggle("tv", match.isTv);
  }
  setText(article.querySelector(".stage-game-no"), gameLabel || match.matchCode || String(match.order));
}

function patchMainOne(bracket: HTMLElement, allMatches: CompetitionMatch[], group: Group) {
  const board = bracket.querySelector<HTMLElement>(".double-elim-phase-board");
  if (!board) return;
  const phase = allMatches.filter(match => match.group === group && match.phaseId === "main-one");
  const sections = Array.from(board.querySelectorAll<HTMLElement>(".double-elim-group"));

  sections.forEach((section, index) => {
    const pool = POOLS[index];
    const poolMatches = phase.filter(match => match.matchCode.startsWith(pool));
    const byCode = new Map(poolMatches.map(match => [match.matchCode, match]));
    const articles = Array.from(section.querySelectorAll<HTMLElement>(".stage-tree-match"));

    // 保持 main 当前签表 DOM 顺序：首轮1-4、胜部7-8、败部5-6、败部晋级9-10。
    const codes = [`${pool}1`,`${pool}2`,`${pool}3`,`${pool}4`,`${pool}7`,`${pool}8`,`${pool}5`,`${pool}6`,`${pool}9`,`${pool}10`];
    articles.forEach((article, articleIndex) => patchArticle(article, byCode.get(codes[articleIndex]), codes[articleIndex]));

    const terminals = Array.from(section.querySelectorAll<HTMLElement>(".terminal-player strong"));
    [`${pool}7`,`${pool}8`,`${pool}9`,`${pool}10`].forEach((code, terminalIndex) => {
      const match = byCode.get(code);
      if (match) setText(terminals[terminalIndex], winner(match));
    });
  });
}

function removeThirdPlace(tree: HTMLElement) {
  tree.querySelector<HTMLElement>("[data-db-third-place]")?.remove();
}

function ensureThirdPlace(tree: HTMLElement, finalWrap: HTMLElement, match: CompetitionMatch) {
  const stage = tree.querySelector<HTMLElement>(".stage-knockout-stage");
  if (!stage) return;

  let wrap = stage.querySelector<HTMLElement>("[data-db-third-place]");
  if (!wrap) {
    const left = Number.parseFloat(finalWrap.style.left || "0");
    const top = Number.parseFloat(finalWrap.style.top || "0") + 105;
    const width = Number.parseFloat(finalWrap.style.width || "116");

    wrap = document.createElement("div");
    wrap.dataset.dbThirdPlace = "true";
    wrap.style.position = "absolute";
    wrap.style.left = `${left}px`;
    wrap.style.top = `${top}px`;
    wrap.style.width = `${width}px`;
    wrap.style.zIndex = "4";

    const label = document.createElement("div");
    label.dataset.dbThirdPlaceLabel = "true";
    label.textContent = "三、四名决赛";
    label.style.marginBottom = "6px";
    label.style.fontSize = "10px";
    label.style.fontWeight = "800";
    label.style.textAlign = "center";
    label.style.color = "#d8dff8";

    const article = document.createElement("article");
    article.className = "stage-tree-match";
    article.dataset.dbThirdPlaceCard = "true";
    article.style.width = `${width}px`;
    article.innerHTML = `<div class="stage-competitor no-slot"><span></span><b></b></div><div class="stage-between"><time></time><span></span></div><div class="stage-competitor no-slot"><span></span><b></b></div><b class="stage-game-no"></b>`;

    wrap.append(label, article);
    stage.appendChild(wrap);
  }

  const label = wrap.querySelector<HTMLElement>("[data-db-third-place-label]");
  if (label) setText(label, "三、四名决赛");
  const article = wrap.querySelector<HTMLElement>(".stage-tree-match");
  if (article) patchArticle(article, match, match.matchCode || String(match.order));
}

function patchMainTwo(bracket: HTMLElement, allMatches: CompetitionMatch[], group: Group) {
  const tree = bracket.querySelector<HTMLElement>(".stage-knockout-tree");
  if (!tree) return;

  const phase = allMatches
    .filter(match => match.group === group && match.phaseId === "main-two")
    .sort((a,b) => a.order - b.order || a.id.localeCompare(b.id));

  // 三、四名决赛不属于冠军晋级连线，单独放在决赛下方。
  // 以后只要数据库 round_name 标记为“三、四名…/季军赛”，都会自动进入此独立节点。
  const thirdPlace = phase.find(isThirdPlace);
  const bracketMatches = phase.filter(match => !isThirdPlace(match));
  const articles = Array.from(tree.querySelectorAll<HTMLElement>(".stage-tree-match"))
    .filter(article => !article.closest("[data-db-third-place]"));

  bracketMatches.slice(0, articles.length).forEach((match, index) => {
    patchArticle(articles[index], match, match.matchCode || String(match.order));
  });

  const final = bracketMatches.find(isFinal) ?? bracketMatches.at(-1);
  if (final) setText(tree.querySelector(".terminal-player strong"), winner(final));

  const finalIndex = final ? bracketMatches.findIndex(match => match.id === final.id) : -1;
  const finalArticle = finalIndex >= 0 ? articles[finalIndex] : articles.at(-1);
  const finalWrap = finalArticle?.closest<HTMLElement>(".stage-tree-match-wrap");

  if (thirdPlace && finalWrap) ensureThirdPlace(tree, finalWrap, thirdPlace);
  else removeThirdPlace(tree);
}

function applyBracketSearch(bracket: HTMLElement, lastQuery: {value:string}) {
  const input = bracket.querySelector<HTMLInputElement>(".draw-toolbar input");
  const q = input?.value.trim().toLowerCase() ?? "";
  const articles = Array.from(bracket.querySelectorAll<HTMLElement>(".stage-tree-match"));
  for (const article of articles) {
    const haystack = `${article.textContent ?? ""} ${article.dataset.dbMatchCode ?? ""}`.toLowerCase();
    const hit = Boolean(q) && haystack.includes(q);
    article.classList.toggle("match-hit", hit);
    article.querySelectorAll<HTMLElement>(".stage-competitor").forEach(line => {
      line.classList.toggle("search-hit", hit && (line.textContent ?? "").toLowerCase().includes(q));
    });
  }

  if (!q) {
    lastQuery.value = "";
    return;
  }
  if (q === lastQuery.value) return;
  lastQuery.value = q;
  const hit = bracket.querySelector<HTMLElement>(".stage-tree-match.match-hit");
  const viewport = bracket.querySelector<HTMLElement>(".bracket-viewport");
  if (!hit || !viewport) return;
  requestAnimationFrame(() => {
    const h = hit.getBoundingClientRect();
    const v = viewport.getBoundingClientRect();
    viewport.scrollBy({
      left: h.left - v.left - v.width / 2 + h.width / 2,
      top: h.top - v.top - v.height / 2 + h.height / 2,
      behavior: "smooth",
    });
  });
}

function patchBracket(allMatches: CompetitionMatch[], lastQuery: {value:string}) {
  const bracket = document.querySelector<HTMLElement>(".bracket-page");
  if (!bracket) return;
  const group = readGroup(bracket);
  const phaseName = bracket.querySelector<HTMLElement>(".bracket-title h1")?.textContent?.trim();
  if (phaseName === "正赛第一阶段") patchMainOne(bracket, allMatches, group);
  if (phaseName === "正赛第二阶段") patchMainTwo(bracket, allMatches, group);
  if (phaseName === "正赛第一阶段" || phaseName === "正赛第二阶段") applyBracketSearch(bracket, lastQuery);
}

export default function LangfangDbEnhancer({matches}:{matches:CompetitionMatch[]}) {
  useEffect(() => {
    const lastQuery = {value:""};
    const sync = () => {
      // 廊坊静态前端仍由这一层用数据库补数据；其它分站已经走统一动态竞赛层，
      // 这里绝不能再去改写其它分站的签表、对阵或比分。
      if(!isLangfangContext())return;
      patchMatchList(matches);
      patchBracket(matches, lastQuery);
    };
    sync();
    const timer = window.setInterval(sync, 160);
    return () => window.clearInterval(timer);
  }, [matches]);
  return null;
}
