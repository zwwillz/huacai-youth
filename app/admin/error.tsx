"use client";

import { useEffect } from "react";

export default function AdminError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("Admin route failed", error);
  }, [error]);

  return <main className="backend-state admin-recovery-state">
    <div className="backend-state-logo">!</div>
    <small>后台连接暂时中断</small>
    <h1>这个页面没有成功加载</h1>
    <p>通常是数据库连接或网络出现了短暂波动，已经保存的数据不会受到影响。您可以先重新加载；如果登录状态已经过期，请返回登录页重新进入。</p>
    <button type="button" onClick={reset}>重新加载当前页面</button>
    <a href="/admin/login">返回后台登录</a>
  </main>;
}
