import { notFound } from "next/navigation";
import PlayerDetail from "./player-detail";
import { getSnookerPlayerDetailFast } from "@/lib/snooker/player-detail-fast";

export const revalidate = 300;

export default async function SnookerPlayerDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const player = await getSnookerPlayerDetailFast(slug);
  if (!player) notFound();
  return <PlayerDetail player={player} />;
}
