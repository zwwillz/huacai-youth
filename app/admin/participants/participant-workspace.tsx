"use client";

import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import type { ParticipantGroupSummary, ParticipantRosterItem, ParticipantRosterPageData } from "@/db/participant-roster";

const CACHE_TTL_MS = 60_000;
const listCache = new Map<string, { at: number; data: ParticipantRosterPageData }>();

type EditorState = {
  item: ParticipantRosterItem;
  reviewStatus: string;
  feeStatus: string;
  reviewNote: string;
};
type RosterDialog = { action: "confirm-roster" | "lock-roster" | "unlock-roster"; reason: string } | null;

function statusLabel(value: string) {
  if (value === "approved") return "审核通过";
  if (value === "pending") return "待审核";
  if (value === "rejected") return "未通过";
  if (["withdrawn", "cancelled", "canceled"].includes(value)) return "退赛";
  return value || "—";
}
function feeLabel(value: string) {
  if (value === "paid") return "已缴";
  if (value === "unpaid") return "未缴";
  if (["waived", "exempt"].includes(value)) return "免缴";
  return "待核对";
}
function genderLabel(value: string | null) {
  if (!value) return "—";
  if (["male", "m", "男"].includes(value.toLowerCase())) return "男";
  if (["female", "f", "女"].includes(value.toLowerCase())) return "女";
  return value;
}
function identityTypeLabel(value: string | null) {
  if (value === "id_card") return "身份证";
  if (value === "passport") return "护照";
  return value || "待补";
}
function rosterLabel(group: ParticipantGroupSummary) {
  if (group.rosterStatus === "locked") return "已锁定";
  if (group.rosterStatus === "confirmed") return "已确认";
  return "待确认";
}
function rosterClass(group: ParticipantGroupSummary) {
  return group.rosterStatus === "locked" ? "locked" : group.rosterStatus === "confirmed" ? "confirmed" : "draft";
}
function cacheKey(viewerKey: string, input: { eventId: string; groupId: string; query: string; review: string; fee: string; page: number }) {
  return [viewerKey, input.eventId, input.groupId, input.query, input.review, input.fee, input.page].join("|");
}
function updateUrl(input: { eventId: string; groupId: string; query: string; review: string; fee: string; page: number }) {
  const params = new URLSearchParams();
  params.set("event", input.eventId);
  if (input.groupId) params.set("group", input.groupId);
  if (input.query) params.set("q", input.query);
  if (input.review !== "all") params.set("review", input.review);
  if (input.fee !== "all") params.set("fee", input.fee);
  if (input.page > 1) params.set("page", String(input.page));
  window.history.replaceState(window.history.state, "", `/admin/participants?${params.toString()}`);
}

export function ParticipantRosterWorkspace({ viewerKey, viewerRole, initialData }: {
  viewerKey: string;
  viewerRole: string;
  initialData: ParticipantRosterPageData;
}) {
  const [data, setData] = useState(initialData);
  const [queryDraft, setQueryDraft] = useState(initialData.query);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: "success" | "error"; text: string } | null>(null);
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [dialog, setDialog] = useState<RosterDialog>(null);
  const currentGroup = useMemo(() => data.groups.find((group) => group.id === data.selectedGroupId) || data.groups[0], [data]);
  const pageCount = Math.max(1, Math.ceil(data.filteredTotal / data.pageSize));

  async function load(next: Partial<{ groupId: string; query: string; review: string; fee: string; page: number }>, options: { force?: boolean } = {}) {
    const input = {
      eventId: data.eventId,
      groupId: next.groupId ?? data.selectedGroupId,
      query: next.query ?? data.query,
      review: next.review ?? data.reviewFilter,
      fee: next.fee ?? data.feeFilter,
      page: next.page ?? data.page,
    };
    updateUrl(input);
    const key = cacheKey(viewerKey, input);
    const cached = listCache.get(key);
    if (!options.force && cached && Date.now() - cached.at < CACHE_TTL_MS) {
      setData(cached.data);
      setQueryDraft(cached.data.query);
      setMessage(null);
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const params = new URLSearchParams({ event: input.eventId, group: input.groupId, q: input.query, review: input.review, fee: input.fee, page: String(input.page) });
      const response = await fetch(`/api/admin/participants?${params.toString()}`, { cache: "no-store" });
      const body = await response.json() as { data?: ParticipantRosterPageData; error?: string };
      if (!response.ok || !body.data) throw new Error(body.error || "参赛人员读取失败。");
      listCache.set(key, { at: Date.now(), data: body.data });
      setData(body.data);
      setQueryDraft(body.data.query);
    } catch (error) {
      setMessage({ kind: "error", text: error instanceof Error ? error.message : "参赛人员读取失败。" });
    } finally {
      setBusy(false);
    }
  }

  function clearEventCache() {
    const prefix = `${viewerKey}|${data.eventId}|`;
    for (const key of listCache.keys()) if (key.startsWith(prefix)) listCache.delete(key);
  }

  async function mutate(action: string, extra: Record<string, unknown> = {}) {
    if (!currentGroup) return;
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/participants", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action,
          eventId: data.eventId,
          groupId: currentGroup.id,
          query: data.query,
          review: data.reviewFilter,
          fee: data.feeFilter,
          page: data.page,
          ...extra,
        }),
      });
      const body = await response.json() as { data?: ParticipantRosterPageData; error?: string };
      if (!response.ok || !body.data) throw new Error(body.error || "操作失败。");
      clearEventCache();
      setData(body.data);
      setQueryDraft(body.data.query);
      setEditor(null);
      setDialog(null);
      const labels: Record<string, string> = {
        "update-registration": "报名信息已更新。",
        "confirm-roster": "正式参赛名单已确认。",
        "lock-roster": "参赛名单已锁定，当前组别可以开始抽签。",
        "unlock-roster": "参赛名单已解锁，请重新检查并确认名单。",
      };
      setMessage({ kind: "success", text: labels[action] || "操作已完成。" });
    } catch (error) {
      setMessage({ kind: "error", text: error instanceof Error ? error.message : "操作失败。" });
    } finally {
      setBusy(false);
    }
  }

  function submitSearch(event: FormEvent) {
    event.preventDefault();
    void load({ query: queryDraft.trim(), page: 1 });
  }

  if (!currentGroup) {
    return <main className="participant-admin"><section className="participant-empty-card"><small>PARTICIPANT ROSTER</small><h2>参赛人员</h2><p>当前赛事尚未建立参赛组别，请先在赛事管理中配置少年组和青年组。</p></section></main>;
  }

  const locked = currentGroup.rosterStatus === "locked";
  const canConfirm = !locked && currentGroup.pendingCount === 0 && currentGroup.approvedCount >= 2;
  const drawHref = `/admin/competition/draw?event=${encodeURIComponent(data.eventId)}&group=${encodeURIComponent(currentGroup.id)}&phase=qualifier-one`;

  return <main className="participant-admin" aria-busy={busy}>
    <section className="participant-head">
      <div><small>PARTICIPANT ROSTER</small><h2>参赛人员</h2><p>{data.eventTitle} · 报名人员审核完成后，按组别确认并锁定正式参赛名单。名单锁定后才开放资格赛抽签。</p></div>
      <span className={`participant-head-state ${rosterClass(currentGroup)}`}>{currentGroup.name} · {rosterLabel(currentGroup)}</span>
    </section>

    {message && <div className={`participant-notice ${message.kind}`}>{message.text}</div>}

    <nav className="participant-group-switch" aria-label="参赛组别">
      {data.groups.map((group) => <button key={group.id} type="button" className={group.id === currentGroup.id ? "active" : ""} onClick={() => void load({ groupId: group.id, page: 1 })} disabled={busy}>
        <span><b>{group.name}</b><small>{group.code}</small></span>
        <em>{group.totalCount} 人</em>
        <i className={rosterClass(group)}>{rosterLabel(group)}</i>
      </button>)}
    </nav>

    <section className="participant-status-card">
      <div className="participant-status-copy">
        <small>CURRENT GROUP</small>
        <h3>{currentGroup.name}参赛名单</h3>
        {locked
          ? <p>名单已锁定，共 <b>{currentGroup.rosterCount}</b> 名正式参赛人员。报名资料进入只读状态，抽签入口已经开放。</p>
          : currentGroup.rosterStatus === "confirmed"
            ? <p>已确认 <b>{currentGroup.rosterCount}</b> 名正式参赛人员。请复核后锁定，锁定后才能进入抽签。</p>
            : <p>当前有 <b>{currentGroup.approvedCount}</b> 人审核通过。请先处理待审核人员，再确认正式参赛名单。</p>}
        {currentGroup.unknownFeeCount > 0 && <span className="participant-soft-warning">{currentGroup.unknownFeeCount} 人报名费状态待核对；第一版不以报名费状态阻断名单锁定。</span>}
      </div>
      <div className="participant-status-actions">
        {currentGroup.rosterStatus === "draft" && <button type="button" className="participant-primary" disabled={!canConfirm || busy} onClick={() => setDialog({ action: "confirm-roster", reason: "" })}>确认名单</button>}
        {currentGroup.rosterStatus === "confirmed" && <button type="button" className="participant-primary" disabled={busy} onClick={() => setDialog({ action: "lock-roster", reason: "" })}>锁定名单</button>}
        {locked && <Link className="participant-primary link" href={drawHref}>前往抽签</Link>}
        {locked && viewerRole === "system_admin" && <button type="button" className="participant-secondary" disabled={busy} onClick={() => setDialog({ action: "unlock-roster", reason: "" })}>解锁名单</button>}
      </div>
    </section>

    <section className="participant-metrics">
      <article><span>报名人数</span><strong>{currentGroup.totalCount}</strong><small>{currentGroup.name}</small></article>
      <article><span>审核通过</span><strong>{currentGroup.approvedCount}</strong><small>正式名单来源</small></article>
      <article><span>报名费已确认</span><strong>{currentGroup.paidCount + currentGroup.waivedCount}</strong><small>{currentGroup.unknownFeeCount ? `${currentGroup.unknownFeeCount} 人待核对` : "状态已核对"}</small></article>
      <article className={currentGroup.pendingCount ? "attention" : ""}><span>待审核</span><strong>{currentGroup.pendingCount}</strong><small>{currentGroup.pendingCount ? "处理后可确认名单" : "无待审核"}</small></article>
    </section>

    <section className="participant-list-card">
      <div className="participant-toolbar">
        <form className="participant-search" onSubmit={submitSearch}>
          <input value={queryDraft} onChange={(event) => setQueryDraft(event.target.value)} placeholder="搜索姓名、手机号、证件号、家长" aria-label="搜索参赛人员" />
          <button type="submit" disabled={busy}>搜索</button>
          {data.query && <button type="button" className="clear" onClick={() => { setQueryDraft(""); void load({ query: "", page: 1 }); }}>清除</button>}
        </form>
        <div className="participant-filters">
          <label><span>审核</span><select value={data.reviewFilter} onChange={(event) => void load({ review: event.target.value, page: 1 })} disabled={busy}><option value="all">全部状态</option><option value="pending">待审核</option><option value="approved">审核通过</option><option value="rejected">未通过</option><option value="withdrawn">退赛</option></select></label>
          <label><span>报名费</span><select value={data.feeFilter} onChange={(event) => void load({ fee: event.target.value, page: 1 })} disabled={busy}><option value="all">全部状态</option><option value="paid">已缴</option><option value="unpaid">未缴</option><option value="waived">免缴</option><option value="unknown">待核对</option></select></label>
        </div>
      </div>
      <div className="participant-list-meta"><span>共 <b>{data.filteredTotal}</b> 条 · 第 {data.page}/{pageCount} 页</span><small>{busy ? "正在更新列表…" : locked ? "名单已锁定 · 只读" : "点击编辑可调整审核与报名费状态"}</small></div>
      <div className="participant-table-wrap">
        <table className="participant-table">
          <thead><tr><th>序号</th><th>姓名</th><th>性别</th><th>组别</th><th>年龄</th><th>手机号</th><th>证件</th><th>证件号码</th><th>家长</th><th>家长手机</th><th>报名费</th><th>审核状态</th><th>操作</th></tr></thead>
          <tbody>{data.items.map((item, index) => <tr key={item.registrationId}>
            <td className="participant-seq">{(data.page - 1) * data.pageSize + index + 1}</td>
            <td><strong>{item.fullName}</strong></td>
            <td>{genderLabel(item.gender)}</td>
            <td>{item.groupName}</td>
            <td>{item.age ?? "—"}</td>
            <td>{item.phone || "—"}</td>
            <td>{identityTypeLabel(item.identityType)}</td>
            <td className="participant-id">{item.identityDisplay || "—"}</td>
            <td>{item.guardianName || "—"}</td>
            <td>{item.guardianPhone || "—"}</td>
            <td><span className={`participant-badge fee-${item.feeStatus}`}>{feeLabel(item.feeStatus)}</span></td>
            <td><span className={`participant-badge review-${item.reviewStatus}`}>{statusLabel(item.reviewStatus)}</span></td>
            <td><button className="participant-edit" type="button" disabled={locked || busy} onClick={() => setEditor({ item, reviewStatus: item.reviewStatus, feeStatus: ["paid","unpaid","waived"].includes(item.feeStatus) ? item.feeStatus : "unknown", reviewNote: item.reviewNote || "" })}>{locked ? "已锁定" : "编辑"}</button></td>
          </tr>)}</tbody>
        </table>
        {!data.items.length && <div className="participant-empty">当前筛选条件下没有报名人员。</div>}
      </div>
      <div className="participant-pagination">
        <button type="button" disabled={busy || data.page <= 1} onClick={() => void load({ page: data.page - 1 })}>上一页</button>
        <span>{data.page} / {pageCount}</span>
        <button type="button" disabled={busy || data.page >= pageCount} onClick={() => void load({ page: data.page + 1 })}>下一页</button>
      </div>
    </section>

    {editor && <div className="participant-drawer-backdrop" onMouseDown={() => !busy && setEditor(null)}>
      <aside className="participant-drawer" onMouseDown={(event) => event.stopPropagation()}>
        <header><div><small>REGISTRATION</small><h3>{editor.item.fullName}</h3><p>{editor.item.groupName} · 报名资料审核</p></div><button type="button" onClick={() => setEditor(null)} disabled={busy}>×</button></header>
        <section className="participant-drawer-profile">
          <div><span>手机号</span><b>{editor.item.phone || "—"}</b></div><div><span>证件</span><b>{identityTypeLabel(editor.item.identityType)} · {editor.item.identityDisplay || "待补"}</b></div><div><span>家长</span><b>{editor.item.guardianName || "—"}</b></div><div><span>家长手机</span><b>{editor.item.guardianPhone || "—"}</b></div>
        </section>
        <div className="participant-drawer-form">
          <label><span>审核状态</span><select value={editor.reviewStatus} onChange={(event) => setEditor({ ...editor, reviewStatus: event.target.value })}><option value="pending">待审核</option><option value="approved">审核通过</option><option value="rejected">审核不通过</option><option value="withdrawn">退赛</option></select></label>
          <label><span>报名费</span><select value={editor.feeStatus} onChange={(event) => setEditor({ ...editor, feeStatus: event.target.value })}><option value="unknown">待核对</option><option value="unpaid">未缴</option><option value="paid">已缴</option><option value="waived">免缴</option></select></label>
          <label><span>审核备注</span><textarea rows={5} value={editor.reviewNote} onChange={(event) => setEditor({ ...editor, reviewNote: event.target.value })} placeholder="可选：记录未通过、退赛或特殊情况" /></label>
        </div>
        <footer><button type="button" className="participant-secondary" onClick={() => setEditor(null)} disabled={busy}>取消</button><button type="button" className="participant-primary" disabled={busy} onClick={() => void mutate("update-registration", { registrationId: editor.item.registrationId, reviewStatus: editor.reviewStatus, feeStatus: editor.feeStatus, reviewNote: editor.reviewNote })}>{busy ? "保存中…" : "保存修改"}</button></footer>
      </aside>
    </div>}

    {dialog && <div className="participant-dialog-backdrop" onMouseDown={() => !busy && setDialog(null)}>
      <section className="participant-dialog" onMouseDown={(event) => event.stopPropagation()}>
        <span className={`participant-dialog-icon ${dialog.action === "lock-roster" ? "lock" : dialog.action === "unlock-roster" ? "unlock" : "confirm"}`}>{dialog.action === "lock-roster" ? "锁" : dialog.action === "unlock-roster" ? "解" : "✓"}</span>
        <h3>{dialog.action === "confirm-roster" ? `确认${currentGroup.name}参赛名单` : dialog.action === "lock-roster" ? `锁定${currentGroup.name}参赛名单` : `解锁${currentGroup.name}参赛名单`}</h3>
        {dialog.action === "confirm-roster" && <p>将当前 <b>{currentGroup.approvedCount}</b> 名审核通过人员确认为正式参赛名单。确认后仍可修改；一旦修改，名单会自动退回“待确认”。</p>}
        {dialog.action === "lock-roster" && <p>锁定后，当前 <b>{currentGroup.rosterCount}</b> 名正式参赛人员将作为资格赛抽签唯一名单来源，普通操作将不能再修改报名状态。</p>}
        {dialog.action === "unlock-roster" && <><p>只有尚未产生抽签、比赛或晋级数据的组别可以解锁。请填写本次解锁原因。</p><textarea rows={4} value={dialog.reason} onChange={(event) => setDialog({ ...dialog, reason: event.target.value })} placeholder="例如：发现一名球员报名组别需要调整" /></>}
        <div className="participant-dialog-actions"><button type="button" className="participant-secondary" onClick={() => setDialog(null)} disabled={busy}>取消</button><button type="button" className={dialog.action === "unlock-roster" ? "participant-danger" : "participant-primary"} disabled={busy || (dialog.action === "unlock-roster" && dialog.reason.trim().length < 2)} onClick={() => void mutate(dialog.action, dialog.action === "unlock-roster" ? { reason: dialog.reason } : {})}>{busy ? "处理中…" : dialog.action === "confirm-roster" ? "确认名单" : dialog.action === "lock-roster" ? "确认锁定" : "确认解锁"}</button></div>
      </section>
    </div>}
  </main>;
}

export function ParticipantRosterLoadingView() {
  return <main className="participant-admin participant-loading" aria-busy="true" style={{ pointerEvents: "none" }}>
    <section className="participant-head"><div><small>PARTICIPANT ROSTER</small><h2>参赛人员</h2><p>当前赛事报名人员正在读取，页面结构已经可以使用。</p></div><span className="participant-head-state draft">读取中</span></section>
    <nav className="participant-group-switch"><button type="button" className="active"><span><b>少年组</b><small>U16</small></span><em>— 人</em><i className="draft">读取中</i></button><button type="button"><span><b>青年组</b><small>U20</small></span><em>— 人</em><i className="draft">读取中</i></button></nav>
    <section className="participant-status-card"><div className="participant-status-copy"><small>CURRENT GROUP</small><h3>参赛名单正在读取</h3><p>审核与名单锁定状态会在这里直接补齐。</p></div></section>
    <section className="participant-metrics">{["报名人数","审核通过","报名费已确认","待审核"].map((label) => <article key={label}><span>{label}</span><strong>—</strong><small>读取中</small></article>)}</section>
    <section className="participant-list-card"><div className="participant-toolbar"><div className="participant-search"><input placeholder="搜索姓名、手机号、证件号、家长" readOnly /><button type="button">搜索</button></div><div className="participant-filters"><label><span>审核</span><select disabled><option>全部状态</option></select></label><label><span>报名费</span><select disabled><option>全部状态</option></select></label></div></div><div className="participant-table-wrap"><table className="participant-table"><thead><tr><th>序号</th><th>姓名</th><th>性别</th><th>组别</th><th>年龄</th><th>手机号</th><th>证件</th><th>证件号码</th><th>家长</th><th>家长手机</th><th>报名费</th><th>审核状态</th><th>操作</th></tr></thead><tbody>{Array.from({ length: 6 }, (_, index) => <tr key={index}><td>{index + 1}</td><td><strong>—</strong></td>{Array.from({ length: 11 }, (_, cell) => <td key={cell}>—</td>)}</tr>)}</tbody></table></div></section>
  </main>;
}
