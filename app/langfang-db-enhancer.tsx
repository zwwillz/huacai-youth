"use client";

import { useEffect } from "react";
import type { CompetitionMatch } from "@/db/competition-matches";

type Group = "少年组" | "青年组";

const POOLS = ["A","B","C","D","E","F","G","H"] as const;

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
  if (value.toUpperCase() === "X") return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function winner(match: CompetitionMatch) {
  const a = scoreValue(match.scoreA);
  const b = scoreValue(match.scoreB);
  if (a == null || b == null || a === b) return "晋级者待定";
  return a > b ? match.playerA : match.playerB;
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
    const codes = [`${pool}1`,`${pool}2`,`${pool}3`,`${pool}4`,`${pool}7`,`${pool}8`,`${pool}5`,`${pool}6`,`${pool}9`,`${pool}10`];
    articles.forEach((article, articleIndex) => patchArticle(article, byCode.get(codes[articleIndex]), codes[articleIndex]));

    const terminals = Array.from(section.querySelectorAll<HTMLElement>(".terminal-player strong"));
    [`${pool}7`,`${pool}8`,`${pool}9`,`${pool}10`].forEach((code, terminalIndex) => {
      const match = byCode.get(code);
      if (match) setText(terminals[terminalIndex], winner(match));
    });
  });
}

function ensureThirdPlace(stage: HTMLElement, finalWrap: HTMLElement, match: CompetitionMatch) {
  let wrap = stage.querySelector<HTMLElement>("[data-db-third-place]");
  if (!wrap) {
    wrap = finalWrap.cloneNode(true) as HTMLElement;
    wrap.dataset.dbThirdPlace = "true";
    wrap.classList.add("db-third-place-wrap");
    const top = Number.parseFloat(finalWrap.style.top || "0");
    wrap.style.top = `${top + 112}px`;
    stage.appendChild(wrap);
  }
  const article = wrap.querySelector<HTMLElement>(".stage-tree-match");
  if (article) {
    article.title = "三、四名决赛";
    patchArticle(article, match, `三、四名决赛 · ${match.matchCode || 31}`);
  }
}

function patchMainTwo(bracket: HTMLElement, allMatches: CompetitionMatch[], group: Group) {
  const tree = bracket.querySelector<HTMLElement>(".stage-knockout-tree");
  if (!tree) return;
  const phase = allMatches.filter(match => match.group === group && match.phaseId === "main-two");
  const byOrder = new Map(phase.map(match => [match.order, match]));
  const articles = Array.from(tree.querySelectorAll<HTMLElement>(".stage-tree-match:not([data-third-place-inner])"))
    .filter(article => !article.closest("[data-db-third-place]"));
  const orders = [
    ...Array.from({length:16},(_,i)=>i+1),
    ...Array.from({length:8},(_,i)=>i+17),
    ...Array.from({length:4},(_,i)=>i+25),
    29,30,32,
  ];
  articles.slice(0, orders.length).forEach((article, index) => {
    const match = byOrder.get(orders[index]);
    patchArticle(article, match, match?.matchCode || String(orders[index]));
  });

  const final = byOrder.get(32);
  if (final) setText(tree.querySelector(".terminal-player strong"), winner(final));

  const third = byOrder.get(31);
  const finalArticle = articles[orders.length - 1];
  const finalWrap = finalArticle?.parentElement as HTMLElement | null;
  const stage = tree.querySelector<HTMLElement>(".stage-knockout-stage");
  if (third && finalWrap && stage) ensureThirdPlace(stage, finalWrap, third);
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
      patchMatchList(matches);
      patchBracket(matches, lastQuery);
    };
    sync();
    const timer = window.setInterval(sync, 160);
    return () => window.clearInterval(timer);
  }, [matches]);
  return null;
}
