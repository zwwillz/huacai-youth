"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { CompetitionPublicationModule } from "@/db/competition-context";

type Props = {
  eventId: string;
  moduleType: CompetitionPublicationModule;
  title: string;
  status: string;
  hasUnpublishedChanges?: boolean;
  viewerRole: string;
  hint: string;
};

export default function CompetitionPublicationBar({ eventId, moduleType, title, status, hasUnpublishedChanges = false, viewerRole, hint }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const canWrite = viewerRole === "system_admin" || viewerRole === "committee";
  const published = status === "published";
  const needsPublish = !published || hasUnpublishedChanges;
  const stateLabel = published
    ? hasUnpublishedChanges ? "用户端保持上一版 · 有更新待发布" : "用户端已发布"
    : hasUnpublishedChanges ? "后台已保存 · 待首次发布" : "尚未发布";

  async function change(nextStatus: "draft" | "published") {
    const text = nextStatus === "published"
      ? `确认把“${title}”${published ? "更新" : "发布"}到用户端？\n\n系统会生成一个新的正式快照。发布完成前，用户端一直保持上一版正式内容，不会看到后台正在编辑的数据。`
      : `确认暂时从用户端撤回“${title}”吗？后台数据和上一版发布快照都不会删除，之后可以再次发布。`;
    if (!window.confirm(text)) return;
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/admin/competition/publication", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ eventId, moduleType, status: nextStatus }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "发布状态更新失败。");
      setMessage(nextStatus === "published" ? "新版本已经发布，用户端已切换到本次正式快照。" : "已从用户端撤回，后台数据仍完整保留。" );
      router.refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : "发布状态更新失败。"); }
    finally { setBusy(false); }
  }

  return <section className="competition-publication-bar">
    <div className="competition-publication-copy">
      <span className={`competition-publication-status ${published && !hasUnpublishedChanges ? "published" : "draft"}`}>{stateLabel}</span>
      <div><strong>{title}</strong><p>{message || hint}</p></div>
    </div>
    {canWrite && <div className="competition-publication-actions">
      {needsPublish && <button type="button" disabled={busy} onClick={() => change("published")}>{busy ? "发布中…" : published ? "发布更新" : "发布到用户端"}</button>}
      {published && <button className="secondary" type="button" disabled={busy} onClick={() => change("draft")}>{busy ? "处理中…" : "撤回前台"}</button>}
    </div>}
  </section>;
}
