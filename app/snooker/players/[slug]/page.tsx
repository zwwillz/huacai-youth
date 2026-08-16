import { notFound } from "next/navigation";
import PlayerDetail from "./player-detail";
import { getSnookerPlayerDetail } from "@/lib/snooker/player-data";

export const revalidate = 300;

export default async function SnookerPlayerDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const player = await getSnookerPlayerDetail(slug);
  if (!player) notFound();
  return <PlayerDetail player={player} />;
}
