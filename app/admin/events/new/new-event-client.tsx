"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type EventRow = { id: string; year: number; stationNo: number; shortTitle: string };
type Account = { id: string; username: string; displayName: string; role: string; status: string };
type SnapshotResponse = { data?: { events: EventRow[] }; error?: string };
type SuggestionResponse = { data?: { latestYear: number; nextStationNo: number; viewerRole: string; assignableAccounts: Account[] }; error?: string };

type GroupDraft = { name: string; code: string; status: string };
type Organizations = { host: string; support: string; operator: string; cooperator: string };
type Draft = {
  fullTitle: string;
  year: number;
  stationNo: number;
  city: string;
  startDate: string;
  endDate: string;
  groups: GroupDraft[];
  organizations: Organizations;
  memberIds: string[];
};

type Touched = Partial<Record<"fullTitle" | "year" | "stationNo" | "city" | "startDate" | "endDate", boolean>>;

const organizationLabels: Record<keyof Organizations, string> = {
  host: "主办单位",
  support: "支持单位",
  operator: "承办单位",
  cooperator: "协办单位",
};

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
  const [viewerRole, setViewerRole] = useState("committee");
  const [accounts, setAccounts] = useState<Account[]>([]);
  const touched = useRef<Touched>({});
  const [draft, setDraft] = useState<Draft>({
    fullTitle: defaultTitle(initialYear),
    year: initialYear,
    stationNo: 1,
    city: "",
    startDate: "",
    endDate: "",
    groups: [
      { name: "少年组", code: "U16", status: "active" },
      { name: "青年组", code: "U20", status: "active" },
    ],
    organizations: { host: "", support: "", operator: "", cooperator: "" },
    memberIds: [],
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
        setViewerRole(suggestion.viewerRole);
        setAccounts(suggestion.assignableAccounts ?? []);
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

  const updateBasic = <K extends "fullTitle" | "year" | "stationNo" | "city" | "startDate" | "endDate">(key: K, value: Draft[K]) => {
    touched.current[key] = true;
    setDraft((current) => {
      const next = { ...current, [key]: value } as Draft;
      if (key === "year" && typeof value === "number" && !touched.current.fullTitle && current.fullTitle === defaultTitle(current.year)) next.fullTitle = defaultTitle(value);
      return next;
    });
  };

  const canSubmit = useMemo(() => Boolean(
    draft.fullTitle.trim() && draft.city.trim() && draft.startDate && draft.endDate && draft.startDate <= draft.endDate
      && draft.groups.some((group) => group.status === "active" && group.name.trim() && group.code.trim()),
  ), [draft]);

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
          fullTitle: draft.fullTitle,
          year: draft.year,
          stationNo: draft.stationNo,
          city: draft.city,
          startDate: draft.startDate,
          endDate: draft.endDate,
          shortTitle,
          venueName: "",
          registrationStartAt: "",
          registrationEndAt: "",
          summary: "",
          status: "draft",
          publishStatus: "draft",
          setup: {
            groups: draft.groups,
            organizations: draft.organizations,
            memberIds: viewerRole === "system_admin" ? draft.memberIds : [],
          },
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
      <div><small>CREATE EVENT</small><h2>创建新赛事</h2><p>一次建立赛事基础信息、参赛组别、组织机构和本站后台成员。主题图、场馆、主要参数和公众内容在赛事运营中继续完善。</p></div>
      <Link href="/admin/events">← 返回赛事管理</Link>
    </section>

    {error && <div className="event-v2-error">{error}</div>}
    <form className="event-v2-create-form" onSubmit={submit}>
      <section className="event-v2-form-main">
        <section className="event-v2-section">
          <header><div><small>01 · BASIC</small><h3>赛事基本信息</h3><p>这里只填写确定这场赛事身份所需的基础内容。</p></div><b>{suggestionState === "loading" ? "站次读取中" : suggestionState === "ready" ? "站次已建议" : "可手动填写"}</b></header>
          <div className="event-v2-grid">
            <label className="wide"><span>完整赛事名称 *</span><input value={draft.fullTitle} onChange={(e) => updateBasic("fullTitle", e.target.value)} required /></label>
            <label><span>赛季年份 *</span><input type="number" min="2025" max="2100" value={draft.year} onChange={(e) => updateBasic("year", Number(e.target.value))} required /></label>
            <label><span>第几站 *</span><input type="number" min="1" value={draft.stationNo} onChange={(e) => updateBasic("stationNo", Number(e.target.value))} required /></label>
            <label className="wide"><span>城市 *</span><input value={draft.city} onChange={(e) => updateBasic("city", e.target.value)} placeholder="例如：河北廊坊" required /></label>
            <label><span>比赛开始日期 *</span><input type="date" value={draft.startDate} onChange={(e) => updateBasic("startDate", e.target.value)} required /></label>
            <label><span>比赛结束日期 *</span><input type="date" value={draft.endDate} onChange={(e) => updateBasic("endDate", e.target.value)} required /></label>
          </div>
        </section>

        <section className="event-v2-section">
          <header><div><small>02 · GROUPS</small><h3>参赛组别</h3><p>默认建立少年组 U16 与青年组 U20，可在创建前调整名称、代码或启用状态。</p></div><b>{draft.groups.filter((group) => group.status === "active").length} 个启用</b></header>
          <div className="event-v2-group-list">{draft.groups.map((group, index) => <div className="event-v2-group-row" key={`${group.code}-${index}`}>
            <label><span>组别名称</span><input value={group.name} onChange={(e) => setDraft((current) => ({ ...current, groups: current.groups.map((row, i) => i === index ? { ...row, name: e.target.value } : row) }))} /></label>
            <label><span>代码</span><input value={group.code} onChange={(e) => setDraft((current) => ({ ...current, groups: current.groups.map((row, i) => i === index ? { ...row, code: e.target.value } : row) }))} /></label>
            <label><span>状态</span><select value={group.status} onChange={(e) => setDraft((current) => ({ ...current, groups: current.groups.map((row, i) => i === index ? { ...row, status: e.target.value } : row) }))}><option value="active">启用</option><option value="disabled">停用</option></select></label>
          </div>)}</div>
        </section>

        <section className="event-v2-section">
          <header><div><small>03 · ORGANIZATIONS</small><h3>赛事组织机构</h3><p>创建时可直接录入；之后仍可在赛事管理中修改。</p></div></header>
          <div className="event-v2-grid">{(Object.keys(organizationLabels) as Array<keyof Organizations>).map((type) => <label className="wide" key={type}><span>{organizationLabels[type]}</span><textarea rows={2} value={draft.organizations[type]} onChange={(e) => setDraft((current) => ({ ...current, organizations: { ...current.organizations, [type]: e.target.value } }))} placeholder="多个单位可用顿号或换行分隔" /></label>)}</div>
        </section>

        {viewerRole === "system_admin" && <section className="event-v2-section">
          <header><div><small>04 · MEMBERS</small><h3>组委会与裁判账号</h3><p>将已有后台账号分配到本站；创建完成后也可以在赛事管理中继续调整。</p></div><b>{draft.memberIds.length} 人</b></header>
          <div className="event-v2-member-list">{accounts.length ? accounts.map((account) => {
            const checked = draft.memberIds.includes(account.id);
            return <label className={checked ? "selected" : ""} key={account.id}><input type="checkbox" checked={checked} disabled={account.status !== "active"} onChange={(e) => setDraft((current) => ({ ...current, memberIds: e.target.checked ? [...current.memberIds, account.id] : current.memberIds.filter((id) => id !== account.id) }))} /><div><strong>{account.displayName}</strong><small>{account.username} · {account.role === "committee" ? "组委会" : "裁判"}{account.status !== "active" ? " · 已停用" : ""}</small></div></label>;
          }) : <p className="event-management-empty">暂无可分配的组委会或裁判账号。</p>}</div>
        </section>}
      </section>

      <aside className="event-v2-create-note">
        <small>创建赛事</small>
        <h3>建立完整后台工作空间</h3>
        <p>创建不会自动出现在公众前端。完成后再进入赛事运营发布概览、规程、报名和主赛程。</p>
        <dl className="event-v2-create-summary"><div><dt>赛季 / 站次</dt><dd>{draft.year} · 第{draft.stationNo}站</dd></div><div><dt>城市</dt><dd>{draft.city || "待填写"}</dd></div><div><dt>组别</dt><dd>{draft.groups.filter((group) => group.status === "active").map((group) => group.name).join(" / ") || "待设置"}</dd></div><div><dt>后台成员</dt><dd>{viewerRole === "system_admin" ? `${draft.memberIds.length} 人` : "创建人自动加入"}</dd></div></dl>
        <button className="event-v2-save" type="submit" disabled={working || !canSubmit}>{working ? "正在创建…" : "创建赛事"}</button>
        <Link href="/admin/events">取消</Link>
      </aside>
    </form>
  </main>;
}
