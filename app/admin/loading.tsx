export default function AdminLoading() {
  return <main className="admin-route-loading" aria-busy="true" aria-label="正在读取后台数据">
    <section className="admin-route-loading-head"><span /><div><i /><i /></div></section>
    <section className="admin-route-loading-message"><b /><div><strong>正在读取当前工作区…</strong><small>赛事、权限与当前阶段数据正在同步</small></div></section>
    <section className="admin-route-loading-grid">{[0, 1, 2, 3].map((item) => <article key={item}><i /><i /><i /></article>)}</section>
  </main>;
}
