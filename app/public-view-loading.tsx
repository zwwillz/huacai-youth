import playerStyles from "./player-db.module.css";
import meStyles from "./me-preview.module.css";

export function PlayerLoadingShell() {
  return <div className={playerStyles.root} aria-busy="true">
    <section className={playerStyles.hero}>
      <div><small>球员数据库</small><h1>球员数据</h1><p>查看华彩系列赛球员档案、参赛成绩与积分数据</p></div>
      <label><span>⌕</span><input disabled placeholder="搜索球员姓名" /></label>
    </section>
    <section className={playerStyles.listCard}>
      <header className={playerStyles.listHead}><div><small>公开球员</small><h2>全部球员</h2></div></header>
      <div className={playerStyles.countLine}><span>正在读取球员列表…</span><small>页面框架已就绪，数据加载完成后会自动显示</small></div>
      <div className={playerStyles.empty}>首次读取后，再次进入球员页会直接使用本次会话已加载的数据。</div>
    </section>
  </div>;
}

export function PersonalCenterLoadingShell() {
  return <div className={meStyles.root} aria-busy="true">
    <section className={meStyles.profileHero}>
      <div className={meStyles.avatar}>…</div>
      <div className={meStyles.profileCopy}>
        <span className={meStyles.previewTag}>个人中心</span>
        <h1>个人中心</h1>
        <div className={meStyles.identityLine}><b>球员</b><span>正在读取个人数据</span></div>
      </div>
      <div className={meStyles.heroMark}>华</div>
    </section>
    <section className={meStyles.primaryGrid}>
      <article className={meStyles.featureCard}>
        <header><div><small>我的报名</small><h2>最近报名</h2></div></header>
        <div className={meStyles.cardEmpty}>正在读取报名记录…</div>
      </article>
      <article className={meStyles.featureCard}>
        <header><div><small>最近比赛</small><h2>比赛成绩</h2></div></header>
        <div className={meStyles.cardEmpty}>正在读取比赛数据…</div>
      </article>
    </section>
  </div>;
}
