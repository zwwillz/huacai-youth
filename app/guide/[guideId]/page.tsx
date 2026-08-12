import { unstable_cache } from "next/cache";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getPublicGuide } from "@/db/guides";
import "../guide.css";

export const revalidate = 300;
export const runtime = "nodejs";

function getCachedGuide(guideId: string) {
  return unstable_cache(() => getPublicGuide(guideId), ["public-guide", guideId], {
    revalidate: 300,
    tags: ["public-content", `public-guide-${guideId}`],
  })();
}

export default async function PublicGuidePage({ params }: { params: Promise<{ guideId: string }> }) {
  const { guideId } = await params;
  const guide = await getCachedGuide(guideId);
  if (!guide) notFound();
  const returnHref = `/?event=${encodeURIComponent(guide.eventId)}&tab=overview`;
  const stationTitle = guide.city.endsWith("站") ? guide.city : `${guide.city}站`;

  return <main className="public-guide-page">
    <header className="top public-guide-third-level-top">
      <Link className="public-guide-top-back" href={returnHref} aria-label="返回赛事概览">← 返回</Link>
      <h3>{stationTitle}</h3>
      <span className="public-guide-top-spacer" aria-hidden="true" />
    </header>
    <article className="public-guide-shell">
      <section className="public-guide-hero"><small>参赛友好提示</small><h1>{guide.title}</h1><p>{guide.shortTitle} · {stationTitle}</p></section>
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
