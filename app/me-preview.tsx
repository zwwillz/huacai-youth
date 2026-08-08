"use client";

import { useState } from "react";
import styles from "./me-preview.module.css";

export default function MePreview() {
  const [editing, setEditing] = useState(false);
  const [profile, setProfile] = useState({ nickname: "", phone: "", club: "", coach: "", school: "" });

  return <div className={styles.root}>
    <section className={styles.profileHero}>
      <div className={styles.avatar}>我</div>
      <div className={styles.profileCopy}>
        <span className={styles.previewTag}>球员模式预览</span>
        <h1>个人中心</h1>
        <div className={styles.identityLine}><b>球员账户</b><span>登录后自动显示本人档案</span></div>
      </div>
      <div className={styles.heroMark}>华</div>
    </section>

    <section className={styles.primaryGrid}>
      <article className={styles.featureCard}>
        <header><div><small>我的报名</small><h2>最近报名</h2></div><span className={styles.pending}>待登录</span></header>
        <div className={styles.cardEmpty}>登录后，这里会立即显示最近报名、审核和缴费状态。</div>
      </article>
      <article className={styles.featureCard}>
        <header><div><small>最近比赛</small><h2>比赛成绩</h2></div><span className={styles.pending}>待登录</span></header>
        <div className={styles.cardEmpty}>登录后，这里会显示最近比赛、检录时间、球台和成绩。</div>
      </article>
    </section>

    <section className={styles.compactGrid}>
      <article className={styles.compactCard}>
        <span className={styles.cardIcon}>证</span>
        <div><small>参赛证明</small><strong>—</strong><p>登录后自动汇总参赛记录</p></div>
        <b>›</b>
      </article>
      <article className={styles.pointsCard}>
        <header><div><small>我的积分</small><strong>—</strong></div><span>积分</span></header>
        <div className={styles.pointRows}><div><span>当前赛季</span><b>登录后显示</b></div></div>
      </article>
    </section>

    <section className={styles.infoCard}>
      <header>
        <div><small>个人信息</small><h2>维护个人资料</h2><p>当前阶段为球员个人中心 UI 预览，不再为了预览页面实时查询数据库。</p></div>
        <button onClick={() => setEditing((value) => !value)}>{editing ? "收起" : "维护资料"}</button>
      </header>
      <div className={styles.infoSummary}>
        <span><b>姓名</b>登录后同步</span>
        <span><b>组别</b>登录后同步</span>
        <span><b>联系方式</b>未绑定</span>
        <span><b>俱乐部</b>未填写</span>
        <span><b>师傅</b>未填写</span>
        <span><b>学校</b>未填写</span>
      </div>
      {editing ? <div className={styles.editor}>
        <div className={styles.previewNotice}>当前为 UI 预览模式，填写内容仅用于本页交互预览，不会保存到数据库。</div>
        <label><span>昵称</span><input value={profile.nickname} onChange={(e) => setProfile({ ...profile, nickname: e.target.value })} placeholder="填写昵称" /></label>
        <label><span>联系方式</span><input value={profile.phone} onChange={(e) => setProfile({ ...profile, phone: e.target.value })} placeholder="填写本人手机号" /></label>
        <label><span>俱乐部</span><input value={profile.club} onChange={(e) => setProfile({ ...profile, club: e.target.value })} placeholder="填写所在俱乐部" /></label>
        <label><span>师傅</span><input value={profile.coach} onChange={(e) => setProfile({ ...profile, coach: e.target.value })} placeholder="填写师傅姓名" /></label>
        <label><span>学校</span><input value={profile.school} onChange={(e) => setProfile({ ...profile, school: e.target.value })} placeholder="填写学校" /></label>
      </div> : null}
    </section>
  </div>;
}
