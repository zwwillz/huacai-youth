"use client";

import { useEffect, useState } from "react";

export default function AdminLoading() {
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setSlow(true), 8000);
    return () => window.clearTimeout(timer);
  }, []);

  return <main className="admin-route-loading" aria-busy="true" aria-label="正在读取后台数据">
    <section className="admin-route-loading-head"><span /><div><i /><i /></div></section>
    <section className={slow ? "admin-route-loading-message slow" : "admin-route-loading-message"}><b /><div><strong>{slow ? "读取时间比预期稍长" : "正在读取当前工作区…"}</strong><small>{slow ? "可能是网络短暂波动，您可以继续等待或重新加载。" : "赛事、权限与当前阶段数据正在同步"}</small>{slow && <span><button type="button" onClick={() => window.location.reload()}>重新加载</button><button type="button" className="secondary" onClick={() => window.history.back()}>返回上一页</button></span>}</div></section>
    <section className="admin-route-loading-grid">{[0, 1, 2, 3].map((item) => <article key={item}><i /><i /><i /></article>)}</section>
  </main>;
}
