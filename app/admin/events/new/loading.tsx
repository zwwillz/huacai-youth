export default function NewEventLoading() {
  return <main className="event-v2-create-page" aria-busy="true" style={{ pointerEvents: "none" }}>
    <section className="event-v2-create-head"><div><small>CREATE EVENT</small><h2>创建新赛事</h2><p>正在准备赛事基础信息、参赛组别、组织机构和后台成员。</p></div></section>
    <div className="event-v2-create-form">
      <section className="event-v2-form-main">
        {["赛事基本信息", "参赛组别", "赛事组织机构", "组委会与裁判账号"].map((title, index) => <section className="event-v2-section content-loading-card" key={title}><header><div><small>{String(index + 1).padStart(2, "0")}</small><h3>{title}</h3><p>数据正在读取…</p></div></header><div className="content-loading-lines"><i /><i /><i /></div></section>)}
      </section>
      <aside className="event-v2-create-note"><small>创建赛事</small><h3>建立完整后台工作空间</h3><p>页面结构已经准备好，建议站次和可分配账号随后补齐。</p></aside>
    </div>
  </main>;
}
