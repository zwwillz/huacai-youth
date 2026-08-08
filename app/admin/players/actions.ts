"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createAdminPlayer, updateAdminPlayer } from "@/db/player-admin";
import { getAdminViewer } from "../admin-viewer";

function text(formData: FormData, key: string) {
  return String(formData.get(key) || "").trim();
}

function redirectTarget(formData: FormData, messageType: "success" | "error", message: string, playerId?: string) {
  const params = new URLSearchParams();
  const eventId = text(formData, "returnEvent");
  const scope = text(formData, "returnScope");
  const group = text(formData, "returnGroup");
  const query = text(formData, "returnQuery");
  const page = text(formData, "returnPage");
  if (eventId) params.set("event", eventId);
  if (scope) params.set("scope", scope);
  if (group && group !== "all") params.set("group", group);
  if (query) params.set("q", query);
  if (page && page !== "1") params.set("page", page);
  if (playerId) params.set("player", playerId);
  params.set(messageType, message);
  return `/admin/players?${params.toString()}`;
}

export async function createPlayerAction(formData: FormData) {
  const viewer = await getAdminViewer();
  if (!viewer) redirect("/admin/login");

  let playerId = "";
  let errorMessage = "";
  try {
    playerId = await createAdminPlayer(viewer.username, {
      fullName: text(formData, "fullName"),
      gender: text(formData, "gender"),
      birthDate: text(formData, "birthDate"),
      province: text(formData, "province"),
      city: text(formData, "city"),
      clubName: text(formData, "clubName"),
      schoolName: text(formData, "schoolName"),
      phone: text(formData, "phone"),
      email: text(formData, "email"),
      nationalityCode: text(formData, "nationalityCode") || "CN",
      identityType: text(formData, "identityType") || "id_card",
      identityNo: text(formData, "identityNo"),
    });
  } catch (error) {
    errorMessage = error instanceof Error ? error.message : "新增球员失败。";
  }

  if (errorMessage) redirect(redirectTarget(formData, "error", errorMessage));
  revalidatePath("/admin/players");
  redirect(redirectTarget(formData, "success", "球员档案已创建。", playerId));
}

export async function updatePlayerAction(formData: FormData) {
  const viewer = await getAdminViewer();
  if (!viewer) redirect("/admin/login");
  const playerId = text(formData, "playerId");

  let errorMessage = "";
  try {
    await updateAdminPlayer(viewer.username, {
      playerId,
      eventId: text(formData, "returnEvent") || null,
      fullName: text(formData, "fullName"),
      gender: text(formData, "gender"),
      birthDate: text(formData, "birthDate"),
      province: text(formData, "province"),
      city: text(formData, "city"),
      clubName: text(formData, "clubName"),
      schoolName: text(formData, "schoolName"),
      phone: text(formData, "phone"),
      email: text(formData, "email"),
      nationalityCode: text(formData, "nationalityCode") || "CN",
      profileStatus: text(formData, "profileStatus") || "approved",
      identityType: text(formData, "identityType") || "id_card",
      identityNo: text(formData, "identityNo"),
    });
  } catch (error) {
    errorMessage = error instanceof Error ? error.message : "更新球员失败。";
  }

  if (errorMessage) redirect(redirectTarget(formData, "error", errorMessage, playerId));
  revalidatePath("/admin/players");
  redirect(redirectTarget(formData, "success", "球员档案已更新。", playerId));
}
