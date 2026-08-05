"use client";

import { FormEvent, useState } from "react";

export default function LoginForm({ setup }: { setup: boolean }) {
  const [username, setUsername] = useState(setup ? "admin" : "");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      if (setup && password !== confirmPassword) throw new Error("两次输入的密码不一致。");
      const response = await fetch(setup ? "/api/auth/setup" : "/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error || "登录失败，请重试。");
      window.location.href = "/admin";
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "登录失败，请重试。");
    } finally {
      setLoading(false);
    }
  }

  return <form className="backend-login-form" onSubmit={submit}>
    {setup && <div className="backend-first-setup"><strong>首次管理员设置</strong><p>系统管理员用户名固定为 admin。请先设置密码，设置完成后该入口会自动关闭。</p></div>}
    <label><span>用户名</span><input value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" placeholder="请输入后台用户名" readOnly={setup} required /></label>
    <label><span>{setup ? "设置密码" : "登录密码"}</span><input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete={setup ? "new-password" : "current-password"} placeholder="至少8个字符" minLength={8} required /></label>
    {setup && <label className="backend-confirm-password"><span>确认密码</span><input type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} autoComplete="new-password" placeholder="再次输入密码" minLength={8} required /></label>}
    {error && <p className="backend-login-error">{error}</p>}
    <button type="submit" disabled={loading}>{loading ? (setup ? "正在创建管理员…" : "正在登录…") : (setup ? "设置密码并进入后台" : "登录管理后台")}</button>
  </form>;
}
