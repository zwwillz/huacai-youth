"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type EventRow = { id: string; year: number; stationNo: number; shortTitle: string };
type SnapshotResponse = { data?: { events: EventRow[] }; error?: string };
type SuggestionResponse = { data?: { latestYear: number; nextStationNo: number }; error?: string };

type Draft = {
  fullTitle: string;
  year: number;
  stationNo: number;
  city: string;
  startDate: string;
  endDate: string;
};

type Touched = Partial<Record<keyof Draft, boolean>>;

function defaultTitle(year: number) { return `${year}中国华彩十六球青少年系列赛`; }
function generatedShortTitle(draft: Draft) {
  const place = draft.city.trim();
  return place ? `${draft.year}华彩青少年系列赛${place}站` : `${draft.year}华彩青少年系列赛第${draft.stationNo}站`;
}

export default function NewEventClient({ initialYear }: { initialYear: number }) {
  const router = useRouter();
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const [suggestionState, setSuggestionState] = useState<"loading" | "ready" | "error">("loading");
  const touched = useRef<Touched>({});
  const [draft, setDraft] = useState<Draft>({ fullTitle: defaultTitle(initialYear), year: initialYear, stationNo: 1, city: "", startDate: "", endDate: "" });

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/admin/events/new-defaults", { cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json() as SuggestionResponse;
        if (response.status === 401) {
          window.location.assign("/admin/login");
          throw new Error("登录状态已失效，请重新登录。");
        }
        if (!response.ok || !payload.data) throw new Error(payload.error || "建议站次读取失败。");
        if (cancelled) return;
        const suggestion = payload.data;
        setDraft((current) => ({
          ...current,
          year: touched.current.year ? current.year : suggestion.latestYear,
          stationNo: touched.current.stationNo ? current.stationNo : suggestion.nextStationNo,
          fullTitle: touched.current.fullTitle || touched.current.year ? current.fullTitle : defaultTitle(suggestion.latestYear),
        }));
        setSuggestionState("ready");
      })
      .catch(() => { if (!cancelled) setSuggestionState("error"); });
    return () => { cancelled = true; };
  }, []);

  const update = <K extends keyof Draft>(key: K, value: Draft[K]) => {
    touched.current[key] = true;
    setDraft((current) => {
      const next = { ...current, [key]: value } as Draft;
      if (key === "year" && typeof value === "number" && !touched.current.fullTitle && current.fullTitle === defaultTitle(current.year)) next.fullTitle = defaultTitle(value);
      return next;
    });
  };

  const canSubmit = useMemo(() => Boolean(draft.fullTitle.trim() && draft.city.trim() && draft.startDate && draft.endDate && draft.startDate <= draft.endDate), [draft]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!canSubmit) return;
    setWorking(true); setError("");
    const shortTitle = generatedShortTitle(draft);
    try {
      const response = await fetch("/api/admin/events", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...draft,
          shortTitle,
          venueName: "",
          registrationStartAt: "",
          registrationEndAt: "",
          summary: "",
          status: "draft",
          publishStatus: "draft",
        }),
      });
      const payload = await response.json() as SnapshotResponse;
      if (!response.ok || !payload.data) throw new Error(payload.error || "赛事创建失败。");
      const created = payload.data.events.find((item) => item.year === draft.year && item.stationNo === draft.stationNo && item.shortTitle === shortTitle) ?? payload.data.events[0];
      if (!created) throw new Error("赛事已经创建，但没有读取到新赛事编号。请返回赛事列表确认。");
      router.push(`/admin/events/${created.id}`);
      router.refresh();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "赛事创建失败。");
    } finally { setWorking(false); }
  };

  return <main className="event-v2-create-page">
    <section className="event-v2-create-head">
      <div><small>CREATE EVENT</small><h2>创建新赛事</h2><p>这里只建立赛事最基础的主数据。创建完成后，再在赛事管理补充组别、组织机构和后台成员，在赛事运营完善对外内容。</p></div>
      <Link href="/admin/events">← 返回赛事管理</Link>
    </section>

    <form className="event-v2-create-form" onSubmit={submit}>
      <section className="event-v2-section">
        <header><div><small>01 · BASIC INFORMATION</small><h3>赛事基本信息</h3><p>保持创建过程简单，只填写确定这场赛事身份所需的信息。</p></div><b>{suggestionState === "loading" ? "站次读取中" : suggestionState === "ready" ? "站次已建议" : "可手动填写"}</b></header>
        {error && <div className="event-v2-error">{error}</div>}
        <div className="event-v2-grid">
          <label className="wide"><span>完整赛事名称 *</span><input value={draft.fullTitle} onChange={(e) => update("fullTitle", e.target.value)} required /></label>
          <label><span>赛季年份 *</span><input type="number" min="2025" max="2100" value={draft.year} onChange={(e) => update("year", Number(e.target.value))} required /></label>
          <label><span>第几站 *</span><input type="number" min="1" value={draft.stationNo} onChange={(e) => update("stationNo", Number(e.target.value))} required /></label>
          <label className="wide"><span>城市 *</span><input value={draft.city} onChange={(e) => update("city", e.target.value)} placeholder="例如：河北廊坊" required /></label>
          <label><span>比赛开始日期 *</span><input type="date" value={draft.startDate} onChange={(e) => update("startDate", e.target.value)} required /></label>
          <label><span>比赛结束日期 *</span><input type="date" value={draft.endDate} onChange={(e) => update("endDate", e.target.value)} required /></label>
        </div>
      </section>

      <aside className="event-v2-create-note">
        <small>创建后</small>
        <h3>建立赛事工作空间</h3>
        <p>赛事创建不会自动出现在公众前端。后续所有对外内容统一在“赛事运营”中发布。</p>
        <ul><li>自动建立少年组 U16 与青年组 U20</li><li>准备赛事概览与竞赛规程</li><li>准备报名、主赛程和参赛人员模块</li><li>准备抽签与竞赛执行工作区</li></ul>
        <button className="event-v2-save" type="submit" disabled={working || !canSubmit}>{working ? "正在创建…" : "创建赛事"}</button>
        <Link href="/admin/events">取消</Link>
      </aside>
    </form>
  </main>;
}
