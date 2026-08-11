export const ROOT_SYSTEM_ADMIN_USERNAME = "admin";
export const MAX_SECONDARY_SYSTEM_ADMINS = 2;

export function isRootSystemAdminUsername(username) {
  return String(username || "").trim().toLowerCase() === ROOT_SYSTEM_ADMIN_USERNAME;
}

export function shouldHideRootSystemAdmin(viewerUsername) {
  return !isRootSystemAdminUsername(viewerUsername);
}

export function canManageSystemAdminTarget(actorUsername, targetUsername) {
  return isRootSystemAdminUsername(actorUsername) && !isRootSystemAdminUsername(targetUsername);
}

export function hasSecondarySystemAdminCapacity(currentCount) {
  return Number(currentCount) < MAX_SECONDARY_SYSTEM_ADMINS;
}
