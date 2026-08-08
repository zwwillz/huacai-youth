"use client";

import { useState } from "react";
import type { CompetitionPublicationModule } from "@/db/competition-context";
import { useAdminActionDialog } from "../admin-action-dialog";

type Props = {
  eventId: string;
  moduleType: CompetitionPublicationModule;
  title: string;
  status: string;
  hasUnpublishedChanges?: boolean;
  viewerRole: string;
  hint: string;
  onChanged?: (status: string, hasUnpublishedChanges: boolean) => void;
};
type LocalPublicationState = { sourceKey: string; status: string; dirty: boolean };
type LocalMessage = { sourceKey: string; text: string; tone: "success" | "error" };

export default function CompetitionPublicationBar({ eventId, moduleType, title, status, hasUnpublishedChanges = false, viewerRole, hint, onChanged }: Props) {
  const sourceKey = `${eventId}:${moduleType}:${status}:${hasUnpublishedChanges ? "1" : "0"}`;
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<LocalMessage | null>(null);
  const [localState, setLocalState] = useState<LocalPublicationState | null>(null);
  const { ask, dialog } = useAdminActionDialog();

  const currentStatus = localState?.sourceKey === sourceKey ? localState.status : status;
  const dirty = localState?.sourceKey === sourceKey ? localState.dirty : hasUnpublishedChanges;
  const visibleMessage = message?.sourceKey === sourceKey ? message : null;
  const canWrite = viewerRole === "system_admin" || viewerRole === "committee";
  const published = currentStatus === "published";
  const needsPublish = !published || dirty;
  const stateLabel = published
    ? dirty ? "用户端保持上一版 · 有更新待发布" : "用户端已发布"
    : dirty ? "后台已保存 · 待首次发布" : "尚未发布";

  async function change(nextStatus: "draft" | "published") {
    const text = nextStatus === "published"
      ? `确认把“${title}”${published ? "更新" : "发布"}到用户端？\n\n系统会生成一个新的正式快照。发布完成前，用户端一直保持上一版正式内容，不会看到后台正在编辑的数据。`
      : `确认暂时从用户端撤回“${title}”吗？后台数据和上一版发布快照都不会删除，之后可以再次发布。`;
    const confirmed = await ask({ title: nextStatus === "published" ? `${published ? "发布更新" : "发布"}“${title}”` : `撤回“${title}”`, description: text, confirmLabel: nextStatus === "published" ? "确认发布" : "确认撤回", tone: nextStatus === "published" ? "default" : "danger" });
    if (!confirmed) return;
    setBusy(true); setMessage(null);
    try {
      const response = await fetch("/api/admin/competition/publication", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ eventId, moduleType, status: nextStatus }),
      });
      const result = await response.json() as { data?: { publications?: Record<string, { status: string; hasUnpublishedChanges: boolean }> }; error?: string };
      if (!response.ok) throw new Error(result.error || "发布状态更新失败。");
      const next = result.data?.publications?.[moduleType];
      const nextState = next?.status || nextStatus;
      const nextDirty = next?.hasUnpublishedChanges ?? false;
      setLocalState({ sourceKey, status: nextState, dirty: nextDirty });
      onChanged?.(nextState, nextDirty);
      setMessage({ sourceKey, text: nextStatus === "published" ? "新版本已经发布，用户端已切换到本次正式快照。" : "已从用户端撤回，后台数据仍完整保留。", tone: "success" });
    } catch (error) { setMessage({ sourceKey, text: error instanceof Error ? error.message : "发布状态更新失败。", tone: "error" }); }
    finally { setBusy(false); }
  }

  return <><section className="competition-publication-bar">
    <div className="competition-publication-copy">
      <span className={`competition-publication-status ${published && !dirty ? "published" : "draft"}`}>{stateLabel}</span>
      <div><strong>{title}</strong><p className={visibleMessage?.tone}>{visibleMessage?.text || hint}</p><small className="competition-publication-flow">后台保存 → 组委会复核 → 发布用户端</small></div>
    </div>
    {canWrite && <div className="competition-publication-actions">
      {needsPublish && <button type="button" disabled={busy} onClick={() => change("published")}>{busy ? "发布中…" : published ? "发布更新" : "发布到用户端"}</button>}
      {published && <button className="secondary" type="button" disabled={busy} onClick={() => change("draft")}>{busy ? "处理中…" : "撤回前台"}</button>}
    </div>}
  </section>{dialog}</>;
}
