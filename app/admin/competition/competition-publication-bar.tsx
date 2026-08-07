"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { CompetitionPublicationModule } from "@/db/competition-context";

type Props = {
  eventId: string;
  moduleType: CompetitionPublicationModule;
  title: string;
  status: string;
  viewerRole: string;
  hint: string;
};

export default function CompetitionPublicationBar({ eventId, moduleType, title, status, viewerRole, hint }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const canWrite = viewerRole === "system_admin" || viewerRole === "committee";
  const published = status === "published";

  async function change(nextStatus: "draft" | "published") {
    const text = nextStatus === "published"
      ? `确认把“${title}”发布到用户端？\n\n后台已经保存的数据会从现在开始对公众可见。之后如果继续修改，该模块会重新变成“有未发布更新”。`
      : `确认暂时从用户端撤回“${title}”吗？后台数据不会删除。`;
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
      setMessage(nextStatus === "published" ? "已发布到用户端。" : "已从用户端撤回，后台数据仍保留。" );
      router.refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : "发布状态更新失败。"); }
    finally { setBusy(false); }
  }

  return <section className="competition-publication-bar">
    <div className="competition-publication-copy">
      <span className={`competition-publication-status ${published ? "published" : "draft"}`}>{published ? "用户端已发布" : "后台已保存 · 待发布"}</span>
      <div><strong>{title}</strong><p>{message || hint}</p></div>
    </div>
    {canWrite && <div className="competition-publication-actions">{published ? <button className="secondary" type="button" disabled={busy} onClick={() => change("draft")}>{busy ? "处理中…" : "撤回前台"}</button> : <button type="button" disabled={busy} onClick={() => change("published")}>{busy ? "发布中…" : "发布到用户端"}</button>}</div>}
  </section>;
}
