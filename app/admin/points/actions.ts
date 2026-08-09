"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { updatePlayerPointsRule } from "@/db/player-points";
import { getAdminViewer } from "../admin-viewer";

function number(formData: FormData, key: string, fallback = 0) {
  const value = Number(String(formData.get(key) || ""));
  return Number.isFinite(value) ? value : fallback;
}

export async function updatePointsRuleAction(formData: FormData) {
  const viewer = await getAdminViewer();
  if (!viewer) redirect("/admin/login");
  const year = Math.trunc(number(formData, "year", new Date().getFullYear()));
  let errorMessage = "";
  try {
    await updatePlayerPointsRule(viewer.username, {
      year,
      participationPoints: number(formData, "participationPoints", 10),
      prizeUnitYuan: number(formData, "prizeUnitYuan", 100),
      prizePointsPerUnit: number(formData, "prizePointsPerUnit", 1),
    });
  } catch (error) {
    errorMessage = error instanceof Error ? error.message : "积分规则保存失败。";
  }
  revalidatePath("/admin/points");
  const params = new URLSearchParams();
  params.set(errorMessage ? "error" : "success", errorMessage || "积分规则已更新，排名已按新规则重新计算。");
  redirect(`/admin/points?${params.toString()}`);
}
