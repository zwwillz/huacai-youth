import { redirect } from "next/navigation";

export default async function SnookerPlayerDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  redirect(`/snooker?view=players&player=${encodeURIComponent(slug)}`);
}
