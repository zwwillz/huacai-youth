import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import postgres from "npm:postgres@3.4.7";

type QueryMode = "object" | "array";
type QueryMessage = {
  id?: string;
  type: "query";
  query: string;
  params?: unknown[];
  mode?: QueryMode;
};
type ControlMessage = { id?: string; type: "commit" | "rollback" };
type TransactionMessage = QueryMessage | ControlMessage;

const MAX_QUERY_LENGTH = 250_000;
const MAX_PARAMS = 2_000;

function decodeJwtPayload(token: string) {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  try {
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
    return JSON.parse(atob(padded)) as { role?: unknown; ref?: unknown; exp?: unknown };
  } catch {
    return null;
  }
}

function isServiceRoleRequest(request: Request) {
  // Supabase's verify_jwt gateway validates the signature before this handler
  // runs. Check the verified legacy JWT's authorization claims instead of
  // comparing it byte-for-byte with a runtime secret: legacy and modern keys
  // may coexist and are not guaranteed to have identical string values.
  const authorization = request.headers.get("authorization") || "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
  const claims = decodeJwtPayload(token);
  const projectUrl = Deno.env.get("SUPABASE_URL") || "";
  let projectRef = "";
  try {
    projectRef = new URL(projectUrl).hostname.split(".")[0] || "";
  } catch {
    return false;
  }
  return claims?.role === "service_role"
    && claims.ref === projectRef
    && typeof claims.exp === "number"
    && claims.exp > Math.floor(Date.now() / 1000);
}

function json(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}

function decode(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(decode);
  if (value && typeof value === "object") {
    const tagged = value as Record<string, unknown>;
    if (tagged.__huacai_type === "bigint") return BigInt(String(tagged.value));
    if (tagged.__huacai_type === "date") return new Date(String(tagged.value));
    if (tagged.__huacai_type === "bytes") {
      const binary = atob(String(tagged.value));
      return Uint8Array.from(binary, (character) => character.charCodeAt(0));
    }
    return Object.fromEntries(Object.entries(tagged).map(([key, item]) => [key, decode(item)]));
  }
  return value;
}

function encode(_key: string, value: unknown) {
  if (typeof value === "bigint") return { __huacai_type: "bigint", value: String(value) };
  if (value instanceof Uint8Array) {
    let binary = "";
    for (const byte of value) binary += String.fromCharCode(byte);
    return { __huacai_type: "bytes", value: btoa(binary) };
  }
  return value;
}

function errorPayload(error: unknown) {
  const value = error as { message?: string; code?: string; detail?: string; hint?: string };
  return {
    message: value?.message || "数据库查询失败。",
    ...(value?.code ? { code: value.code } : {}),
    ...(value?.detail ? { detail: value.detail } : {}),
    ...(value?.hint ? { hint: value.hint } : {}),
  };
}

function validateQuery(message: QueryMessage) {
  if (typeof message.query !== "string" || !message.query.trim() || message.query.length > MAX_QUERY_LENGTH) {
    throw new Error("SQL 查询为空或长度超出限制。");
  }
  if (!Array.isArray(message.params) || message.params.length > MAX_PARAMS) throw new Error("SQL 参数格式不正确。");
}

async function execute(sql: postgres.Sql, message: QueryMessage) {
  validateQuery(message);
  const params = (message.params || []).map(decode) as postgres.ParameterOrJSON<never>[];
  const pending = sql.unsafe(message.query, params);
  return message.mode === "array" ? await pending.values() : await pending;
}

function createDatabaseClient() {
  const databaseUrl = Deno.env.get("SUPABASE_DB_URL");
  if (!databaseUrl) throw new Error("SUPABASE_DB_URL is unavailable.");
  return postgres(databaseUrl, {
    max: 1,
    prepare: false,
    connect_timeout: 5,
    idle_timeout: 5,
    max_lifetime: 30,
    connection: { application_name: "huacai-db-bridge" },
  });
}

async function handleQuery(request: Request) {
  let message: QueryMessage;
  try {
    message = await request.json();
  } catch {
    return json({ ok: false, error: { message: "请求内容不是有效 JSON。" } }, 400);
  }
  if (message.type !== "query") return json({ ok: false, error: { message: "不支持的数据库操作。" } }, 400);
  const sql = createDatabaseClient();
  try {
    const rows = await execute(sql, message);
    return new Response(JSON.stringify({ ok: true, rows }, encode), {
      headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
    });
  } catch (error) {
    return json({ ok: false, error: errorPayload(error) }, 400);
  } finally {
    await sql.end({ timeout: 1 });
  }
}

function handleTransaction(request: Request) {
  const { socket, response } = Deno.upgradeWebSocket(request);
  const queue: TransactionMessage[] = [];
  let wake: (() => void) | null = null;
  let disconnected = false;

  const nextMessage = async () => {
    while (!queue.length) {
      if (disconnected) throw new Error("事务调用方已经断开连接。");
      await new Promise<void>((resolve) => { wake = resolve; });
    }
    return queue.shift()!;
  };

  socket.onmessage = (event) => {
    try {
      queue.push(JSON.parse(String(event.data)) as TransactionMessage);
      wake?.();
      wake = null;
    } catch {
      socket.send(JSON.stringify({ ok: false, error: { message: "事务消息不是有效 JSON。" } }));
    }
  };
  socket.onclose = () => {
    disconnected = true;
    wake?.();
    wake = null;
  };

  socket.onopen = async () => {
    const sql = createDatabaseClient();
    let terminalId: string | undefined;
    try {
      await sql.begin(async (tx) => {
        while (true) {
          const message = await nextMessage();
          terminalId = message.id;
          if (message.type === "rollback") throw new Error("HUACAI_TRANSACTION_ROLLBACK");
          if (message.type === "commit") return;
          try {
            const rows = await execute(tx, message);
            socket.send(JSON.stringify({ id: message.id, ok: true, rows }, encode));
          } catch (error) {
            socket.send(JSON.stringify({ id: message.id, ok: false, error: errorPayload(error) }));
            throw error;
          }
        }
      });
      socket.send(JSON.stringify({ id: terminalId, ok: true, committed: true }));
      socket.close(1000, "committed");
    } catch (error) {
      if ((error as Error)?.message !== "HUACAI_TRANSACTION_ROLLBACK") {
        socket.send(JSON.stringify({ id: terminalId, ok: false, error: errorPayload(error) }));
      } else {
        socket.send(JSON.stringify({ id: terminalId, ok: true, rolledBack: true }));
      }
      socket.close(1011, "rolled back");
    } finally {
      await sql.end({ timeout: 1 });
    }
  };

  return response;
}

Deno.serve((request: Request) => {
  if (!isServiceRoleRequest(request)) return json({ ok: false, error: { message: "仅允许受信任的后台服务调用。" } }, 403);
  if (request.headers.get("upgrade")?.toLowerCase() === "websocket") return handleTransaction(request);
  if (request.method !== "POST") return json({ ok: false, error: { message: "仅支持 POST 请求。" } }, 405);
  return handleQuery(request);
});
