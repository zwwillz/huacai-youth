"use client";

import { useState, type FormEvent } from "react";
import styles from "../data-ops/data-ops.module.css";

export default function MonitorLogin() {
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    try {
      const response = await fetch("/api/snooker/data-ops/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: "admin", password }),
      });
      const body = await response.json() as { error?: string; viewer?: { mustChangePassword?: boolean } };
      if (!response.ok || !body.viewer) throw new Error(body.error || "登录失败。");
      if (body.viewer.mustChangePassword) {
        window.location.href = "/snooker/data-ops";
        return;
      }
      window.location.reload();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "登录失败。");
    } finally {
      setPending(false);
    }
  }

  return (
    <main className={styles.loginRoot}>
      <section className={styles.loginCard}>
        <div className={styles.loginBrand}><span>147</span><div><strong>世界斯诺克数据中心</strong><small>MONITOR ADMIN</small></div></div>
        <div className={styles.loginCopy}>
          <small>PROTECTED MONITOR</small>
          <h1>监测与访问日志</h1>
          <p>该页面包含访问日志、完整 IP 与数据源监测信息，仅限 Snooker Admin 登录后查看。</p>
        </div>
        <form className={styles.loginForm} onSubmit={submit}>
          <label>管理员账号<input value="admin" readOnly /></label>
          <label>密码<input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="请输入管理员密码" autoFocus /></label>
          {error ? <p className={styles.formError}>{error}</p> : null}
          <button type="submit" disabled={pending || !password}>{pending ? "正在验证…" : "登录并查看监测"}</button>
        </form>
        <footer><span>Snooker Admin</span><span>HttpOnly Session</span><a href="/snooker/data-ops">数据运维中心</a></footer>
      </section>
    </main>
  );
}
