"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type LoginMode = "login" | "setup";
type SubmitPhase = "idle" | "submitting" | "redirecting";
type ConfigState = "checking" | "ready" | "unconfigured" | "error";

export default function LoginForm() {
  const router = useRouter();
  const [mode, setMode] = useState<LoginMode>("login");
  const [configState, setConfigState] = useState<ConfigState>("checking");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [phase, setPhase] = useState<SubmitPhase>("idle");
  const setup = mode === "setup";
  const busy = phase !== "idle";

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/auth/login-state", { cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json() as { data?: { configured: boolean; setup: boolean } };
        if (cancelled || !payload.data) return;
        if (!payload.data.configured) {
          setConfigState("unconfigured");
          return;
        }
        if (payload.data.setup) {
          setMode("setup");
          setUsername("admin");
        }
        setConfigState("ready");
      })
      .catch(() => {
        if (!cancelled) setConfigState("error");
      });
    return () => { cancelled = true; };
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy || configState === "unconfigured") return;
    setPhase("submitting");
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

      // Do not return the button to its idle state after authentication succeeds.
      // The authenticated /admin route can take a moment to verify the new session;
      // keeping this state makes the transition explicit instead of looking like a failed click.
      setPhase("redirecting");
      router.replace("/admin");
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "登录失败，请重试。");
      setPhase("idle");
    }
  }

  const buttonText = setup
    ? phase === "submitting" ? "正在创建管理员…" : phase === "redirecting" ? "设置完成，正在进入工作台…" : "设置密码并进入后台"
    : phase === "submitting" ? "正在验证账号…" : phase === "redirecting" ? "登录成功，正在进入工作台…" : "登录管理后台";

  return <form className="backend-login-form" onSubmit={submit}>
    {setup && <div className="backend-first-setup"><strong>首次管理员设置</strong><p>系统管理员用户名固定为 admin。请先设置密码，设置完成后该入口会自动关闭。</p></div>}
    {configState === "unconfigured" && <div className="backend-config-warning"><strong>后台等待连接数据库</strong><p>请先在部署环境配置 Supabase 数据库 HTTPS 连接后再登录。</p></div>}
    {configState === "error" && <p className="backend-login-status-note">初始化状态暂未读取，不影响已有账号直接登录。</p>}
    <label><span>用户名</span><input value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" placeholder="请输入后台用户名" readOnly={setup} required /></label>
    <label><span>{setup ? "设置密码" : "登录密码"}</span><input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete={setup ? "new-password" : "current-password"} placeholder="至少8个字符" minLength={8} required /></label>
    {setup && <label className="backend-confirm-password"><span>确认密码</span><input type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} autoComplete="new-password" placeholder="再次输入密码" minLength={8} required /></label>}
    {error && <p className="backend-login-error">{error}</p>}
    <button type="submit" disabled={busy || configState === "unconfigured"}>{buttonText}</button>
  </form>;
}
