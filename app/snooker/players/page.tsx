import PlayerDirectory from "./player-directory";
import { getSnookerPlayerDirectory } from "@/lib/snooker/player-data";

export const revalidate = 300;

export default async function SnookerPlayersPage() {
  const players = await getSnookerPlayerDirectory();
  return <PlayerDirectory players={players} />;
}
