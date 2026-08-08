"use client";

import { useState } from "react";
import type { PlayerAdminDetail } from "@/db/player-admin-v2";
import { createPlayerAction, updatePlayerAction } from "./actions";

type ReturnState = { event: string; scope: "event" | "all"; group: "all" | "少年组" | "青年组"; q: string; page: number };

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

export function PlayerCreateDialog({ state }: { state: ReturnState }) {
  const [open, setOpen] = useState(false);
  return <>
    <button type="button" className="player-primary-button" onClick={() => setOpen(true)}>＋ 新增球员</button>
    {open && <div className="player-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}>
      <section className="player-modal" role="dialog" aria-modal="true" aria-label="新增球员">
        <header><div><small>NEW PLAYER</small><h3>新增球员</h3><p>证件作为唯一身份依据，球员编号由系统自动生成。</p></div><button type="button" onClick={() => setOpen(false)}>×</button></header>
        <form action={createPlayerAction} className="player-form player-modal-form">
          <ReturnFields state={state} />
          <SectionTitle>基本资料</SectionTitle>
          <div className="player-form-grid">
            <label><span>姓名 *</span><input name="fullName" required /></label>
            <label><span>昵称</span><input name="nickname" /></label>
            <label><span>性别</span><select name="gender" defaultValue=""><option value="">未录入</option><option value="男">男</option><option value="女">女</option></select></label>
            <label><span>出生日期</span><input name="birthDate" type="date" /></label>
            <label><span>国籍</span><input name="nationalityCode" defaultValue="CN" maxLength={8} /></label>
            <label><span>省份</span><input name="province" /></label>
            <label><span>城市</span><input name="city" /></label>
          </div>
          <SectionTitle>证件信息</SectionTitle>
          <div className="player-form-grid">
            <label><span>证件 *</span><select name="identityType" defaultValue="id_card"><option value="id_card">身份证</option><option value="passport">护照</option></select></label>
            <label><span>证件号码 *</span><input name="identityNo" required autoComplete="off" /></label>
          </div>
          <SectionTitle>联系信息</SectionTitle>
          <div className="player-form-grid">
            <label><span>手机号码</span><input name="phone" inputMode="tel" /></label>
            <label><span>邮箱</span><input name="email" type="email" /></label>
            <label><span>微信号</span><input name="wechatId" /></label>
          </div>
          <SectionTitle>家长信息</SectionTitle>
          <div className="player-form-grid">
            <label><span>家长姓名</span><input name="guardianName" /></label>
            <label><span>关系</span><input name="guardianRelationship" placeholder="父亲 / 母亲 / 监护人" /></label>
            <label><span>联系方式</span><input name="guardianPhone" inputMode="tel" /></label>
          </div>
          <SectionTitle>其它信息</SectionTitle>
          <div className="player-form-grid">
            <label><span>俱乐部</span><input name="clubName" /></label>
            <label><span>学校</span><input name="schoolName" /></label>
            <label><span>师傅 / 教练</span><input name="mentorName" /></label>
          </div>
          <div className="player-form-actions"><button type="button" className="secondary" onClick={() => setOpen(false)}>取消</button><button type="submit">保存球员</button></div>
        </form>
      </section>
    </div>}
  </>;
}

export function PlayerEditPanel({ state, player }: { state: ReturnState; player: PlayerAdminDetail }) {
  const [editing, setEditing] = useState(false);
  if (!editing) return <button type="button" className="player-primary-button player-edit-trigger" onClick={() => setEditing(true)}>编辑球员资料</button>;
  return <section className="player-edit-panel-open">
    <form action={updatePlayerAction} className="player-form">
      <ReturnFields state={state} />
      <input type="hidden" name="playerId" value={player.id} />
      <SectionTitle>基本资料</SectionTitle>
      <div className="player-form-grid">
        <label><span>姓名 *</span><input name="fullName" required defaultValue={player.fullName} /></label>
        <label><span>昵称</span><input name="nickname" defaultValue={player.nickname || ""} /></label>
        <label><span>性别</span><select name="gender" defaultValue={player.gender || ""}><option value="">未录入</option><option value="男">男</option><option value="女">女</option></select></label>
        <label><span>出生日期</span><input name="birthDate" type="date" defaultValue={player.birthDate || ""} /></label>
        <label><span>国籍</span><input name="nationalityCode" defaultValue={player.nationalityCode} maxLength={8} /></label>
        <label><span>省份</span><input name="province" defaultValue={player.province || ""} /></label>
        <label><span>城市</span><input name="city" defaultValue={player.city || ""} /></label>
      </div>
      <SectionTitle>证件信息</SectionTitle>
      <div className="player-form-grid">
        <label><span>证件</span><select name="identityType" defaultValue={player.identityType || "id_card"}><option value="id_card">身份证</option><option value="passport">护照</option></select></label>
        <label><span>替换证件号码</span><input name="identityNo" autoComplete="off" placeholder="留空保持原证件" /></label>
      </div>
      <SectionTitle>联系信息</SectionTitle>
      <div className="player-form-grid">
        <label><span>手机号码</span><input name="phone" inputMode="tel" defaultValue={player.phone || ""} /></label>
        <label><span>邮箱</span><input name="email" type="email" defaultValue={player.email || ""} /></label>
        <label><span>微信号</span><input name="wechatId" defaultValue={player.wechatId || ""} /></label>
      </div>
      <SectionTitle>家长信息</SectionTitle>
      <div className="player-form-grid">
        <label><span>家长姓名</span><input name="guardianName" defaultValue={player.guardianName || ""} /></label>
        <label><span>关系</span><input name="guardianRelationship" defaultValue={player.guardianRelationship || ""} /></label>
        <label><span>联系方式</span><input name="guardianPhone" inputMode="tel" defaultValue={player.guardianPhone || ""} /></label>
      </div>
      <SectionTitle>其它信息</SectionTitle>
      <div className="player-form-grid">
        <label><span>俱乐部</span><input name="clubName" defaultValue={player.clubName || ""} /></label>
        <label><span>学校</span><input name="schoolName" defaultValue={player.schoolName || ""} /></label>
        <label><span>师傅 / 教练</span><input name="mentorName" defaultValue={player.mentorName || ""} /></label>
        <label><span>状态</span><select name="profileStatus" defaultValue={player.profileStatus}><option value="approved">正常</option><option value="pending">待审核</option><option value="disabled">停用</option></select></label>
      </div>
      <div className="player-form-actions"><button type="button" className="secondary" onClick={() => setEditing(false)}>取消编辑</button><button type="submit">保存修改</button></div>
    </form>
  </section>;
}
