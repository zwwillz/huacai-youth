"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type EventRow = { id: string; year: number; stationNo: number; shortTitle: string };
type SnapshotResponse = { data?: { events: EventRow[] }; error?: string };
type SuggestionResponse = { data?: { latestYear: number; nextStationNo: number }; error?: string };

type Draft = {
  fullTitle: string;
  shortTitle: string;
  year: number;
  stationNo: number;
  city: string;
  venueName: string;
  startDate: string;
  endDate: string;
  registrationStartAt: string;
  registrationEndAt: string;
  summary: string;
  status: string;
  publishStatus: string;
};

type Touched = Partial<Record<keyof Draft, boolean>>;

export default function NewEventClient({ initialYear }: { initialYear: number }) {
  const router = useRouter();
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const [suggestionState, setSuggestionState] = useState<"loading" | "ready" | "error">("loading");
  const touched = useRef<Touched>({});
  const [draft, setDraft] = useState<Draft>({
    fullTitle: `${initialYear}中国华彩十六球青少年系列赛`,
    shortTitle: `${initialYear}华彩青少年系列赛新分站`,
    year: initialYear,
    stationNo: 1,
    city: "",
    venueName: "",
    startDate: "",
    endDate: "",
    registrationStartAt: "",
    registrationEndAt: "",
    summary: "",
    status: "draft",
    publishStatus: "draft",
  });

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
          fullTitle: touched.current.fullTitle ? current.fullTitle : `${suggestion.latestYear}中国华彩十六球青少年系列赛`,
          shortTitle: touched.current.shortTitle ? current.shortTitle : `${suggestion.latestYear}华彩青少年系列赛新分站`,
        }));
        setSuggestionState("ready");
      })
      .catch(() => {
        if (!cancelled) setSuggestionState("error");
      });
    return () => { cancelled = true; };
  }, []);

  const update = <K extends keyof Draft>(key: K, value: Draft[K]) => {
    touched.current[key] = true;
    setDraft((current) => ({ ...current, [key]: value }));
  };
  const canSubmit = useMemo(() => Boolean(draft.fullTitle.trim() && draft.shortTitle.trim() && draft.city.trim() && draft.startDate && draft.endDate), [draft]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!canSubmit) return;
    setWorking(true); setError("");
    try {
      const response = await fetch("/api/admin/events", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(draft) });
      const payload = await response.json() as SnapshotResponse;
      if (!response.ok || !payload.data) throw new Error(payload.error || "赛事创建失败。");
      const created = payload.data.events.find((item) => item.year === draft.year && item.stationNo === draft.stationNo && item.shortTitle === draft.shortTitle) ?? payload.data.events[0];
      if (!created) throw new Error("赛事已经创建，但没有读取到新赛事编号。请返回赛事列表确认。");
      router.push(`/admin/events/${created.id}`);
      router.refresh();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "赛事创建失败。");
    } finally { setWorking(false); }
  };

  return <main className="new-event-page">
    <section className="new-event-head"><div><small>CREATE EVENT</small><h2>创建新赛事</h2><p>这里只建立一场赛事的基础主数据。创建成功后会自动建立少年组、青年组以及基础发布模块，然后进入“赛事完整设置”继续上传主题图、配置赞助商、组织机构和后台成员。</p></div><Link href="/admin/events">← 返回赛事列表</Link></section>
    <form className="new-event-form" onSubmit={submit}>
      <section className="new-event-main">
        <header><div><small>01 · BASIC INFORMATION</small><h3>赛事基础信息</h3></div><span className={`new-event-suggestion ${suggestionState}`}>{suggestionState === "loading" ? "正在补充建议年份 / 站次" : suggestionState === "ready" ? "建议年份 / 站次已就绪" : "建议值暂未读取，可手动填写"}</span></header>
        {error && <p className="new-event-message error">{error}</p>}
        <div className="new-event-grid">
          <label className="wide"><span>完整赛事名称 *</span><input value={draft.fullTitle} onChange={(e) => update("fullTitle", e.target.value)} required /></label>
          <label className="wide"><span>前端显示简称 *</span><input value={draft.shortTitle} onChange={(e) => update("shortTitle", e.target.value)} required /></label>
          <label><span>赛季年份 *</span><input type="number" min="2025" value={draft.year} onChange={(e) => update("year", Number(e.target.value))} required /></label>
          <label><span>第几站 *</span><input type="number" min="1" value={draft.stationNo} onChange={(e) => update("stationNo", Number(e.target.value))} required /></label>
          <label><span>城市 *</span><input value={draft.city} onChange={(e) => update("city", e.target.value)} placeholder="例如：山东济南" required /></label>
          <label><span>比赛场馆</span><input value={draft.venueName} onChange={(e) => update("venueName", e.target.value)} placeholder="可先填写场馆名称，详细地址后补" /></label>
          <label><span>比赛开始日期 *</span><input type="date" value={draft.startDate} onChange={(e) => update("startDate", e.target.value)} required /></label>
          <label><span>比赛结束日期 *</span><input type="date" value={draft.endDate} onChange={(e) => update("endDate", e.target.value)} required /></label>
          <label><span>报名开始时间</span><input type="datetime-local" value={draft.registrationStartAt} onChange={(e) => update("registrationStartAt", e.target.value)} /></label>
          <label><span>报名截止时间</span><input type="datetime-local" value={draft.registrationEndAt} onChange={(e) => update("registrationEndAt", e.target.value)} /></label>
          <label><span>赛事状态</span><select value={draft.status} onChange={(e) => update("status", e.target.value)}><option value="draft">草稿</option><option value="registration_open">报名中</option><option value="registration_closed">报名截止</option><option value="in_progress">比赛中</option><option value="finished">已结束</option></select></label>
          <label><span>前端发布</span><select value={draft.publishStatus} onChange={(e) => update("publishStatus", e.target.value)}><option value="draft">先保存草稿</option><option value="published">立即公开赛事</option></select></label>
          <label className="wide"><span>赛事简介</span><textarea rows={4} value={draft.summary} onChange={(e) => update("summary", e.target.value)} placeholder="可先写一句简要说明，完整内容之后在内容发布中继续完善" /></label>
        </div>
      </section>
      <aside className="new-event-side"><small>创建后的系统动作</small><h3>先建立赛事，再进入本站工作区</h3><p>新赛事创建后，系统会自动准备基础结构，不需要重复创建后续模块。</p><ul><li>建立赛事主记录</li><li>自动建立少年组 U16</li><li>自动建立青年组 U20</li><li>建立概览 / 规程 / 文件发布模块</li><li>预留赛程 / 对阵 / 排名动态模块</li></ul><div className="new-event-actions"><button type="submit" disabled={working || !canSubmit}>{working ? "正在创建…" : "创建赛事并继续设置"}</button><Link href="/admin/events">取消创建</Link></div></aside>
    </form>
  </main>;
}
