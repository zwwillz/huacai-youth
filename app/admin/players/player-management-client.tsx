"use client";

import { useState } from "react";
import type { PlayerAdminDetail } from "@/db/player-admin-v2";
import type { PlayerDeleteEligibility } from "@/db/player-admin-delete";
import { createPlayerAction, deletePlayerAction, updatePlayerAction } from "./actions";

type ReturnState = { event: string; scope: "event" | "all"; group: "all" | "少年组" | "青年组"; q: string; page: number };

type ProfileFieldsProps = {
  player?: PlayerAdminDetail | null;
  creating?: boolean;
};

function ReturnFields({ state }: { state: ReturnState }) {
  return <>
    <input type="hidden" name="returnEvent" value={state.event} />
    <input type="hidden" name="returnScope" value={state.scope} />
    <input type="hidden" name="returnGroup" value={state.group} />
    <input type="hidden" name="returnQuery" value={state.q} />
    <input type="hidden" name="returnPage" value={state.page} />
  </>;
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h4 className="player-form-section-title">{children}</h4>;
}

function identityTypeLabel(type: string | null) {
  return type === "passport" ? "护照" : "身份证";
}

function identityStatusLabel(status: string) {
  if (status === "conflict") return "证件冲突";
  if (status === "missing") return "证件待补";
  if (status === "verified") return "已核验";
  return "已导入";
}

function value(input: string | null | undefined) {
  return input || "—";
}

function PlayerProfileFields({ player, creating = false }: ProfileFieldsProps) {
  return <>
    <SectionTitle>基本资料</SectionTitle>
    <div className="player-form-grid">
      <label><span>姓名 *</span><input name="fullName" required defaultValue={player?.fullName || ""} /></label>
      <label><span>昵称</span><input name="nickname" defaultValue={player?.nickname || ""} /></label>
      <label><span>性别</span><select name="gender" defaultValue={player?.gender || ""}><option value="">未录入</option><option value="男">男</option><option value="女">女</option></select></label>
      <label><span>出生日期</span><input name="birthDate" type="date" defaultValue={player?.birthDate || ""} /></label>
      <label><span>国籍</span><input name="nationalityCode" defaultValue={player?.nationalityCode || "CN"} maxLength={8} /></label>
      <label><span>省份</span><input name="province" defaultValue={player?.province || ""} /></label>
      <label><span>城市</span><input name="city" defaultValue={player?.city || ""} /></label>
    </div>

    <SectionTitle>证件信息</SectionTitle>
    <div className="player-form-grid">
      <label><span>证件 *</span><select name="identityType" defaultValue={player?.identityType || "id_card"}><option value="id_card">身份证</option><option value="passport">护照</option></select></label>
      <label><span>证件号码 *</span><input name="identityNo" required={creating || Boolean(player?.identityNumber)} autoComplete="off" defaultValue={player?.identityNumber || ""} placeholder={creating ? "请输入身份证或护照号码" : "暂无证件时可留空"} /></label>
    </div>

    <SectionTitle>联系信息</SectionTitle>
    <div className="player-form-grid">
      <label><span>手机号码</span><input name="phone" inputMode="tel" defaultValue={player?.phone || ""} /></label>
      <label><span>邮箱</span><input name="email" type="email" defaultValue={player?.email || ""} /></label>
      <label><span>微信号</span><input name="wechatId" defaultValue={player?.wechatId || ""} /></label>
    </div>

    <SectionTitle>家长信息</SectionTitle>
    <div className="player-form-grid">
      <label><span>家长姓名</span><input name="guardianName" defaultValue={player?.guardianName || ""} /></label>
      <label><span>关系</span><input name="guardianRelationship" defaultValue={player?.guardianRelationship || ""} placeholder="父亲 / 母亲 / 监护人" /></label>
      <label><span>联系方式</span><input name="guardianPhone" inputMode="tel" defaultValue={player?.guardianPhone || ""} /></label>
    </div>

    <SectionTitle>其它信息</SectionTitle>
    <div className="player-form-grid">
      <label><span>俱乐部</span><input name="clubName" defaultValue={player?.clubName || ""} /></label>
      <label><span>学校</span><input name="schoolName" defaultValue={player?.schoolName || ""} /></label>
      <label><span>师傅 / 教练</span><input name="mentorName" defaultValue={player?.mentorName || ""} /></label>
      <label><span>状态</span><select name="profileStatus" defaultValue={player?.profileStatus || "approved"}><option value="approved">正常</option><option value="pending">待审核</option><option value="disabled">停用</option></select></label>
    </div>
  </>;
}

export function PlayerCreateDialog({ state }: { state: ReturnState }) {
  const [open, setOpen] = useState(false);
  return <>
    <button type="button" className="player-primary-button" onClick={() => setOpen(true)}>＋ 新增球员</button>
    {open && <div className="player-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}>
      <section className="player-modal" role="dialog" aria-modal="true" aria-label="新增球员">
        <header><div><small>NEW PLAYER</small><h3>新增球员</h3><p>与编辑球员使用同一套档案字段。证件作为唯一身份依据，球员编号由系统自动生成。</p></div><button type="button" aria-label="关闭新增球员窗口" onClick={() => setOpen(false)}>×</button></header>
        <form action={createPlayerAction} className="player-form player-modal-form">
          <ReturnFields state={state} />
          <PlayerProfileFields creating />
          <div className="player-form-actions"><button type="button" className="secondary" onClick={() => setOpen(false)}>取消</button><button type="submit">保存球员</button></div>
        </form>
      </section>
    </div>}
  </>;
}

function PlayerProfileView({ player }: { player: PlayerAdminDetail }) {
  return <>
    <div className="player-detail-sections">
      <section><h4>基本资料</h4><dl><div><dt>姓名</dt><dd>{player.fullName}</dd></div><div><dt>性别</dt><dd>{value(player.gender)}</dd></div><div><dt>出生日期</dt><dd>{value(player.birthDate)}</dd></div><div><dt>国籍</dt><dd>{player.nationalityCode}</dd></div><div><dt>地区</dt><dd>{[player.province, player.city].filter(Boolean).join(" ") || "—"}</dd></div></dl></section>
      <section><h4>证件信息</h4><dl><div><dt>证件</dt><dd>{identityTypeLabel(player.identityType)}</dd></div><div><dt>证件号码</dt><dd>{value(player.identityNumber)}</dd></div><div><dt>证件状态</dt><dd>{identityStatusLabel(player.identityReviewStatus)}</dd></div></dl></section>
      <section><h4>联系信息</h4><dl><div><dt>手机号码</dt><dd>{value(player.phone)}</dd></div><div><dt>邮箱</dt><dd>{value(player.email)}</dd></div><div><dt>微信号</dt><dd>{value(player.wechatId)}</dd></div></dl></section>
      <section><h4>家长信息</h4><dl><div><dt>家长姓名</dt><dd>{value(player.guardianName)}</dd></div><div><dt>联系方式</dt><dd>{value(player.guardianPhone)}</dd></div><div><dt>关系</dt><dd>{value(player.guardianRelationship)}</dd></div></dl></section>
      <section><h4>其它信息</h4><dl><div><dt>昵称</dt><dd>{value(player.nickname)}</dd></div><div><dt>俱乐部</dt><dd>{value(player.clubName)}</dd></div><div><dt>学校</dt><dd>{value(player.schoolName)}</dd></div><div><dt>师傅 / 教练</dt><dd>{value(player.mentorName)}</dd></div></dl></section>
    </div>

    <section className="player-history"><h4>参赛信息</h4>
      {player.events.length ? player.events.map((event) => <div key={`${event.eventId}-${event.groupName}`}><span><b>{event.eventTitle}</b><small>{event.startDate}</small></span><span>{event.groupName}</span><span>{event.placementLabel || "暂无排名"}</span></div>) : <p>暂无可查看的参赛记录。</p>}
    </section>
  </>;
}

export function PlayerDetailWorkspace({
  state,
  player,
  closeHref,
  isSystemAdmin,
  deleteEligibility,
}: {
  state: ReturnState;
  player: PlayerAdminDetail;
  closeHref: string;
  isSystemAdmin: boolean;
  deleteEligibility: PlayerDeleteEligibility | null;
}) {
  const [editing, setEditing] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  return <section className={editing ? "player-detail-card editing" : "player-detail-card"}>
    <header>
      <div><small>PLAYER PROFILE · {player.playerCode}</small><h3>{editing ? `编辑 · ${player.fullName}` : `${player.fullName}${player.identityLast4 ? ` ${player.identityLast4}` : ""}`}</h3><p>球员编号：{player.playerCode}</p></div>
      <a className="player-detail-close" href={closeHref}>关闭并返回列表</a>
    </header>

    {editing ? <form action={updatePlayerAction} className="player-form player-inline-edit-form">
      <ReturnFields state={state} />
      <input type="hidden" name="playerId" value={player.id} />
      <PlayerProfileFields player={player} />
      <div className="player-form-actions"><button type="button" className="secondary" onClick={() => setEditing(false)}>取消编辑</button><button type="submit">保存修改</button></div>
    </form> : <>
      <PlayerProfileView player={player} />
      <div className="player-detail-actions">
        <button type="button" className="player-primary-button" onClick={() => setEditing(true)}>编辑球员资料</button>
        {isSystemAdmin && <button type="button" className="player-danger-button" onClick={() => setDeleteOpen(true)}>删除球员</button>}
      </div>
    </>}

    {deleteOpen && <div className="player-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setDeleteOpen(false); }}>
      <section className="player-confirm-modal" role="dialog" aria-modal="true" aria-label={deleteEligibility?.canDelete ? "确认删除球员" : "无法删除球员"}>
        {deleteEligibility?.canDelete ? <>
          <div className="player-confirm-icon danger">!</div>
          <h3>确认删除球员档案？</h3>
          <p><b>{player.fullName}（{player.playerCode}）</b> 的球员档案将被永久删除。</p>
          <p className="player-delete-warning">删除后不能恢复，请确认该球员没有需要保留的报名或赛事数据。</p>
          <form action={deletePlayerAction} className="player-confirm-actions">
            <ReturnFields state={state} />
            <input type="hidden" name="playerId" value={player.id} />
            <button type="button" className="secondary" onClick={() => setDeleteOpen(false)}>取消</button>
            <button type="submit" className="danger">确认永久删除</button>
          </form>
        </> : <>
          <div className="player-confirm-icon blocked">×</div>
          <h3>该球员不能删除</h3>
          <p>{deleteEligibility?.reason || "该球员已有需要保留的关联数据，不能删除球员档案。"}</p>
          <p className="player-delete-warning">为避免破坏历史报名、比赛和排名记录，系统已禁止删除。</p>
          <div className="player-confirm-actions"><button type="button" onClick={() => setDeleteOpen(false)}>知道了</button></div>
        </>}
      </section>
    </div>}
  </section>;
}
