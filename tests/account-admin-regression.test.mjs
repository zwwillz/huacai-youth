import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  MAX_SECONDARY_SYSTEM_ADMINS,
  ROOT_SYSTEM_ADMIN_USERNAME,
  canManageSystemAdminTarget,
  hasSecondarySystemAdminCapacity,
  isRootSystemAdminUsername,
  shouldHideRootSystemAdmin,
} from "../db/system-admin-policy.mjs";

const source = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("root system admin identity is exact and secondary admins never see root", () => {
  assert.equal(ROOT_SYSTEM_ADMIN_USERNAME, "admin");
  assert.equal(isRootSystemAdminUsername("admin"), true);
  assert.equal(isRootSystemAdminUsername("ADMIN"), true);
  assert.equal(isRootSystemAdminUsername("lytest_admin"), false);
  assert.equal(shouldHideRootSystemAdmin("lytest_admin"), true);
  assert.equal(shouldHideRootSystemAdmin("admin"), false);
  assert.equal(canManageSystemAdminTarget("lytest_admin", "admin"), false);
  assert.equal(canManageSystemAdminTarget("admin", "lytest_admin"), true);
});

test("secondary system administrator capacity is exactly two", () => {
  assert.equal(MAX_SECONDARY_SYSTEM_ADMINS, 2);
  assert.equal(hasSecondarySystemAdminCapacity(0), true);
  assert.equal(hasSecondarySystemAdminCapacity(1), true);
  assert.equal(hasSecondarySystemAdminCapacity(2), false);
  assert.equal(hasSecondarySystemAdminCapacity(3), false);
});

test("account reader filters root admin for non-root system admins", () => {
  const code = source("db/account-admin.ts");
  assert.match(code, /shouldHideRootSystemAdmin\(actor\.username\)/);
  assert.match(code, /ne\(users\.username, ROOT_SYSTEM_ADMIN_USERNAME\)/);
  assert.match(code, /if \(!isRootSystemAdminUsername\(actorUsername\)\) throw new Error\("没有找到该后台账号。"\)/);
});

test("only root admin can create promote modify or delete secondary system admins", () => {
  const code = source("db/account-admin.ts");
  assert.match(code, /input\.role === "system_admin" && !isRootSystemAdminUsername\(actor\.username\)/);
  assert.match(code, /canManageSystemAdminTarget\(actorUsername, target\.username\)/);
  assert.match(code, /根系统管理员账号受保护/);
  assert.match(code, /pg_advisory_xact_lock/);
  assert.match(code, /MAX_SECONDARY_SYSTEM_ADMINS/);
  assert.match(code, /action: "profile"/);
  assert.match(code, /action: target\.role === "system_admin" \? "delete_system_admin" : "delete_account"/);
});

test("account UI exposes system-admin creation only to root and keeps ordinary account management", () => {
  const page = source("app/admin/accounts/page.tsx");
  const client = source("app/admin/accounts/account-management-client.tsx");
  assert.match(page, /canManageSystemAdmins=\{isRootSystemAdminUsername\(viewer\.username\)\}/);
  assert.match(client, /canManageSystemAdmins && <option value="system_admin"/);
  assert.match(client, /副系统管理员/);
  assert.match(client, /根系统管理员/);
  assert.match(client, /修改名称/);
  assert.match(client, /重置密码/);
  assert.match(client, /删除账号/);
  assert.match(client, /<option value="committee">组委会<\/option>/);
  assert.match(client, /<option value="referee">裁判<\/option>/);
});
