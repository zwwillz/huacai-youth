"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createAdminPlayer, updateAdminPlayer } from "@/db/player-admin-v2";
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
  if (scope === "all") params.set("scope", "all");
  if (group && group !== "all") params.set("group", group);
  if (query) params.set("q", query);
  if (page && page !== "1") params.set("page", page);
  if (playerId) params.set("player", playerId);
  params.set(messageType, message);
  return `/admin/players?${params.toString()}`;
}

function playerFields(formData: FormData) {
  return {
    fullName: text(formData, "fullName"),
    nickname: text(formData, "nickname"),
    gender: text(formData, "gender"),
    birthDate: text(formData, "birthDate"),
    nationalityCode: text(formData, "nationalityCode") || "CN",
    province: text(formData, "province"),
    city: text(formData, "city"),
    identityType: text(formData, "identityType") || "id_card",
    identityNo: text(formData, "identityNo"),
    phone: text(formData, "phone"),
    email: text(formData, "email"),
    wechatId: text(formData, "wechatId"),
    guardianName: text(formData, "guardianName"),
    guardianRelationship: text(formData, "guardianRelationship"),
    guardianPhone: text(formData, "guardianPhone"),
    clubName: text(formData, "clubName"),
    schoolName: text(formData, "schoolName"),
    mentorName: text(formData, "mentorName"),
  };
}

export async function createPlayerAction(formData: FormData) {
  const viewer = await getAdminViewer();
  if (!viewer) redirect("/admin/login");

  let playerId = "";
  let errorMessage = "";
  try {
    const fields = playerFields(formData);
    playerId = await createAdminPlayer(viewer.username, {
      ...fields,
      identityType: fields.identityType,
      identityNo: fields.identityNo,
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
      ...playerFields(formData),
      playerId,
      eventId: text(formData, "returnEvent") || null,
      profileStatus: text(formData, "profileStatus") || "approved",
    });
  } catch (error) {
    errorMessage = error instanceof Error ? error.message : "更新球员失败。";
  }

  if (errorMessage) redirect(redirectTarget(formData, "error", errorMessage, playerId));
  revalidatePath("/admin/players");
  redirect(redirectTarget(formData, "success", "球员档案已更新。", playerId));
}
