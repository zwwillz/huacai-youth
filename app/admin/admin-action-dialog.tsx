"use client";

import { ReactNode, useCallback, useEffect, useRef, useState } from "react";
import styles from "./admin-action-dialog.module.css";

export type AdminDialogOptions = {
  title: string;
  description: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "default" | "danger";
  input?: {
    label: string;
    initialValue?: string;
    placeholder?: string;
    type?: "text" | "password";
    minLength?: number;
    required?: boolean;
  };
};

type DialogState = AdminDialogOptions & { value: string };

function AdminActionDialog({ state, onCancel, onConfirm, onValueChange }: { state: DialogState; onCancel: () => void; onConfirm: (value: string | true) => void; onValueChange: (value: string) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { inputRef.current?.focus(); }, []);
  const valid = !state.input || (!state.input.required || state.value.trim().length >= (state.input.minLength ?? 1));
  return <div className={styles.backdrop} role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onCancel(); }}>
    <section className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby="admin-dialog-title">
      <header><span className={state.tone === "danger" ? styles.dangerMark : styles.mark}>{state.tone === "danger" ? "!" : "✓"}</span><div><small>请确认当前操作</small><h2 id="admin-dialog-title">{state.title}</h2></div></header>
      <div className={styles.description}>{state.description}</div>
      {state.input && <label className={styles.input}><span>{state.input.label}</span><input ref={inputRef} type={state.input.type ?? "text"} value={state.value} minLength={state.input.minLength} required={state.input.required} placeholder={state.input.placeholder} onChange={(event) => onValueChange(event.target.value)} onKeyDown={(event) => { if (event.key === "Escape") onCancel(); }} /></label>}
      <footer><button type="button" className={styles.cancel} onClick={onCancel}>{state.cancelLabel || "取消"}</button><button type="button" className={state.tone === "danger" ? styles.danger : styles.confirm} disabled={!valid} onClick={() => onConfirm(state.input ? state.value.trim() : true)}>{state.confirmLabel || "确认"}</button></footer>
    </section>
  </div>;
}

export function useAdminActionDialog() {
  const [state, setState] = useState<DialogState | null>(null);
  const resolver = useRef<((value: string | true | null) => void) | null>(null);

  const ask = useCallback((options: AdminDialogOptions) => new Promise<string | true | null>((resolve) => {
    resolver.current?.(null);
    resolver.current = resolve;
    setState({ ...options, value: options.input?.initialValue ?? "" });
  }), []);

  const finish = useCallback((value: string | true | null) => {
    resolver.current?.(value);
    resolver.current = null;
    setState(null);
  }, []);

  const dialog = state ? <AdminActionDialog
    state={state}
    onCancel={() => finish(null)}
    onConfirm={(value) => finish(value)}
    onValueChange={(value) => setState((current) => current ? { ...current, value } : current)}
  /> : null;

  return { ask, dialog };
}
