"use client";
/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { useState } from "react";
import type { GuideBlock, GuideEditorItem, GuideManagementData } from "@/db/guides";
import { useAdminActionDialog } from "../../../admin-action-dialog";

function newBlock(type: GuideBlock["type"]): GuideBlock {
  const id = `block_${crypto.randomUUID()}`;
  if (type === "image") return { id, type, imageUrl: "", caption: "" };
  if (type === "columns") return { id, type, left: "", right: "" };
  return { id, type: "paragraph", text: "" };
}

function newGuide(index: number): GuideEditorItem {
  const id = `draft_${crypto.randomUUID()}`;
  return {
    id,
    guideType: `guide_${id.replace(/^draft_/, "")}`,
    title: "新的参赛提示",
    publishStatus: "draft",
    sortOrder: index,
    blocks: [newBlock("paragraph")],
  };
}

export default function GuideManagementClient({ initialData }: { initialData: GuideManagementData }) {
  const [data, setData] = useState(initialData);
  const [guides, setGuides] = useState<GuideEditorItem[]>(initialData.guides);
  const [working, setWorking] = useState(false);
  const [uploading, setUploading] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const { ask, dialog } = useAdminActionDialog();

  const patchGuide = (index: number, patch: Partial<GuideEditorItem>) => {
    setGuides((rows) => rows.map((row, i) => i === index ? { ...row, ...patch } : row));
  };

  const patchBlock = (guideIndex: number, blockIndex: number, patch: Partial<GuideBlock>) => {
    setGuides((rows) => rows.map((guide, i) => i === guideIndex ? {
      ...guide,
      blocks: guide.blocks.map((block, j) => j === blockIndex ? { ...block, ...patch } as GuideBlock : block),
    } : guide));
  };

  const moveGuide = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= guides.length) return;
    setGuides((rows) => {
      const next = [...rows];
      [next[index], next[target]] = [next[target], next[index]];
      return next.map((row, sortOrder) => ({ ...row, sortOrder }));
    });
  };

  const moveBlock = (guideIndex: number, blockIndex: number, direction: -1 | 1) => {
    setGuides((rows) => rows.map((guide, i) => {
      if (i !== guideIndex) return guide;
      const target = blockIndex + direction;
      if (target < 0 || target >= guide.blocks.length) return guide;
      const blocks = [...guide.blocks];
      [blocks[blockIndex], blocks[target]] = [blocks[target], blocks[blockIndex]];
      return { ...guide, blocks };
    }));
  };

  const uploadImage = async (guideIndex: number, blockIndex: number, file: File) => {
    if (!file.type.match(/^image\/(jpeg|png|webp)$/)) return setError("正文图片仅支持 JPG、PNG 或 WebP。");
    if (file.size > 5 * 1024 * 1024) return setError("正文图片不能超过 5MB。");
    const key = `${guideIndex}-${blockIndex}`;
    setUploading(key); setNotice(""); setError("");
    try {
      const form = new FormData();
      form.append("eventId", data.event.id);
      form.append("assetType", "guide_image");
      form.append("file", file);
      const response = await fetch("/api/admin/assets", { method: "POST", body: form });
      const payload = await response.json() as { data?: { url: string }; error?: string };
      if (!response.ok || !payload.data?.url) throw new Error(payload.error || "图片上传失败。");
      patchBlock(guideIndex, blockIndex, { imageUrl: payload.data.url });
      setNotice("正文图片已上传。保存参赛提示后正式绑定到文章。" );
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "图片上传失败。");
    } finally {
      setUploading("");
    }
  };

  const save = async () => {
    setWorking(true); setNotice(""); setError("");
    try {
      const response = await fetch("/api/admin/guides", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ eventId: data.event.id, guides }),
      });
      const payload = await response.json() as { data?: GuideManagementData; error?: string };
      if (!response.ok || !payload.data) throw new Error(payload.error || "参赛提示保存失败。");
      setData(payload.data); setGuides(payload.data.guides);
      setNotice("参赛友好提示已经保存；发布状态会直接决定公众端是否出现入口。" );
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "参赛提示保存失败。");
    } finally {
      setWorking(false);
    }
  };

  return <main className="guide-admin-page">
    <header className="guide-admin-topbar">
      <div><Link href={`/admin/content/${data.event.id}`}>← 返回内容发布</Link><span>参赛友好提示</span></div>
      <div><Link href={`/admin/events/${data.event.id}`}>赛事设置</Link><Link href="/" target="_blank">查看公众前端 ↗</Link><button onClick={save} disabled={working}>{working ? "正在保存…" : "保存全部提示"}</button></div>
    </header>

    <section className="guide-admin-layout">
      <aside className="guide-admin-summary">
        <small>当前赛事</small><h1>{data.event.shortTitle}</h1><p>{data.event.city}</p>
        <dl><div><dt>提示数量</dt><dd>{guides.length}</dd></div><div><dt>已发布</dt><dd>{guides.filter((item) => item.publishStatus === "published").length}</dd></div></dl>
        <div><strong>可自由增加</strong><p>交通住宿、服装要求只是默认示例。以后可以继续增加报到须知、餐饮、停车、家长观赛、天气提醒等内容。</p></div>
      </aside>

      <section className="guide-admin-main">
        {notice && <div className="guide-message success">✓ {notice}<button onClick={() => setNotice("")}>×</button></div>}
        {error && <div className="guide-message error">! {error}<button onClick={() => setError("")}>×</button></div>}
        <section className="guide-admin-head"><div><small>PARTICIPANT GUIDE</small><h2>参赛友好提示</h2><p>采用轻量“内容块”编辑：正文、图片、双栏提示可以自由组合和排序，前端按同样顺序展示。</p></div><button onClick={() => setGuides((rows) => [...rows, newGuide(rows.length)])}>＋ 增加提示</button></section>

        {guides.length ? guides.map((guide, guideIndex) => <article className="guide-editor-card" key={guide.id}>
          <header>
            <div className="guide-order"><button onClick={() => moveGuide(guideIndex, -1)} disabled={guideIndex === 0}>↑</button><button onClick={() => moveGuide(guideIndex, 1)} disabled={guideIndex === guides.length - 1}>↓</button></div>
            <div><small>提示 {String(guideIndex + 1).padStart(2, "0")}</small><input value={guide.title} onChange={(e) => patchGuide(guideIndex, { title: e.target.value })} /></div>
            <label><span>状态</span><select value={guide.publishStatus} onChange={(e) => patchGuide(guideIndex, { publishStatus: e.target.value as "draft" | "published" })}><option value="draft">草稿</option><option value="published">发布</option></select></label>
            <button className="guide-delete" onClick={async () => { const confirmed = await ask({ title: `删除“${guide.title}”`, description: "删除后需点击“保存全部提示”才会写入后台。", confirmLabel: "从编辑列表删除", tone: "danger" }); if (confirmed) setGuides((rows) => rows.filter((_, i) => i !== guideIndex)); }}>删除</button>
          </header>

          <section className="guide-block-list">{guide.blocks.map((block, blockIndex) => <div className={`guide-block block-${block.type}`} key={block.id}>
            <aside><button onClick={() => moveBlock(guideIndex, blockIndex, -1)} disabled={blockIndex === 0}>↑</button><button onClick={() => moveBlock(guideIndex, blockIndex, 1)} disabled={blockIndex === guide.blocks.length - 1}>↓</button><span>{block.type === "paragraph" ? "正文" : block.type === "image" ? "图片" : "双栏"}</span></aside>
            {block.type === "paragraph" && <textarea rows={5} value={block.text} onChange={(e) => patchBlock(guideIndex, blockIndex, { text: e.target.value })} placeholder="输入正文。支持自然分段，前端会保留换行。" />}
            {block.type === "image" && <div className="guide-image-block"><div className="guide-image-preview">{block.imageUrl ? <img src={block.imageUrl} alt={block.caption || guide.title} /> : <span>图片预览</span>}</div><div><label className="guide-file-upload"><input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => { const file = e.target.files?.[0]; if (file) uploadImage(guideIndex, blockIndex, file); e.currentTarget.value = ""; }} />{uploading === `${guideIndex}-${blockIndex}` ? "正在上传…" : "点击上传图片"}</label><input value={block.caption} onChange={(e) => patchBlock(guideIndex, blockIndex, { caption: e.target.value })} placeholder="图片说明（可选）" /></div></div>}
            {block.type === "columns" && <div className="guide-columns-block"><textarea rows={4} value={block.left} onChange={(e) => patchBlock(guideIndex, blockIndex, { left: e.target.value })} placeholder="左栏内容"/><textarea rows={4} value={block.right} onChange={(e) => patchBlock(guideIndex, blockIndex, { right: e.target.value })} placeholder="右栏内容"/></div>}
            <button className="block-delete" onClick={() => patchGuide(guideIndex, { blocks: guide.blocks.filter((_, i) => i !== blockIndex) })}>×</button>
          </div>)}</section>

          <footer><span>插入内容块</span><button onClick={() => patchGuide(guideIndex, { blocks: [...guide.blocks, newBlock("paragraph")] })}>＋ 正文</button><button onClick={() => patchGuide(guideIndex, { blocks: [...guide.blocks, newBlock("image")] })}>＋ 图片</button><button onClick={() => patchGuide(guideIndex, { blocks: [...guide.blocks, newBlock("columns")] })}>＋ 双栏</button></footer>
        </article>) : <section className="guide-empty"><span>＋</span><h2>还没有参赛友好提示</h2><p>点击“增加提示”建立第一篇内容。</p></section>}

        <footer className="guide-savebar"><div><strong>轻量富内容编辑</strong><span>第一版先支持正文、图片、双栏，避免引入过重的网页编辑器。</span></div><button onClick={save} disabled={working}>{working ? "正在保存…" : "保存全部提示"}</button></footer>
      </section>
    </section>
    {dialog}
  </main>;
}
