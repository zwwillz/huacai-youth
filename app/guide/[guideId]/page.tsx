import Link from "next/link";
import { notFound } from "next/navigation";
import { getPublicGuide } from "@/db/guides";
import "../guide.css";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function PublicGuidePage({ params }: { params: Promise<{ guideId: string }> }) {
  const { guideId } = await params;
  const guide = await getPublicGuide(guideId);
  if (!guide) notFound();
  const returnHref = `/?event=${encodeURIComponent(guide.eventId)}&tab=overview`;

  return <main className="public-guide-page">
    <header className="public-guide-topbar"><Link href={returnHref}>← 返回赛事概览</Link><strong>华彩赛事</strong><span /></header>
    <article className="public-guide-shell">
      <section className="public-guide-hero"><small>参赛友好提示</small><h1>{guide.title}</h1><p>{guide.shortTitle} · {guide.city}</p></section>
      <section className="public-guide-content">{guide.blocks.map((block) => {
        // Uploaded editorial images keep their source dimensions; the guide stylesheet handles responsive sizing.
        // eslint-disable-next-line @next/next/no-img-element
        if (block.type === "image") return <figure key={block.id}><img src={block.imageUrl} alt={block.caption || guide.title} />{block.caption && <figcaption>{block.caption}</figcaption>}</figure>;
        if (block.type === "columns") return <div className="public-guide-columns" key={block.id}><p>{block.left}</p><p>{block.right}</p></div>;
        return <p className="public-guide-paragraph" key={block.id}>{block.text}</p>;
      })}</section>
    </article>
  </main>;
}
