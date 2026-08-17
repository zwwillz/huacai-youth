import { redirect } from "next/navigation";

export default function SnookerPlayersPage() {
  redirect("/snooker?view=players");
}
