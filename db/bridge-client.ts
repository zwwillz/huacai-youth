import type postgres from "postgres";
import WebSocket from "ws";

type QueryMode = "object" | "array";

type EncodedValue =
  | null
  | boolean
  | number
  | string
  | EncodedValue[]
  | { [key: string]: EncodedValue };

type BridgeError = {
  message: string;
  code?: string;
  detail?: string;
  hint?: string;
};

type BridgeReply = {
  id?: string;
  ok: boolean;
  rows?: EncodedValue[];
  error?: BridgeError;
};

type QueryExecutor = (query: string, params: unknown[], mode: QueryMode) => Promise<unknown[]>;

const QUERY_TIMEOUT_MS = 12_000;
const TRANSACTION_TIMEOUT_MS = 25_000;

function bridgeConfig() {
  const url = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error("后台数据库 HTTPS 连接尚未配置，请检查 SUPABASE_URL 和 SUPABASE_SERVICE_ROLE_KEY。");
  }
  return {
    httpUrl: `${url}/functions/v1/huacai-db-bridge`,
    wsUrl: `${url.replace(/^http/, "ws")}/functions/v1/huacai-db-bridge`,
    serviceRoleKey,
  };
}

function encode(value: unknown): EncodedValue {
  if (value === null || typeof value === "boolean" || typeof value === "number" || typeof value === "string") return value;
  if (typeof value === "bigint") return { __huacai_type: "bigint", value: String(value) };
  if (value instanceof Date) return { __huacai_type: "date", value: value.toISOString() };
  if (value instanceof Uint8Array) return { __huacai_type: "bytes", value: Buffer.from(value).toString("base64") };
  if (Array.isArray(value)) return value.map(encode);
  if (typeof value === "object") {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, item]) => [key, encode(item)]));
  }
  throw new Error(`数据库参数类型不受支持：${typeof value}`);
}

function decode(value: EncodedValue): unknown {
  if (Array.isArray(value)) return value.map(decode);
  if (value && typeof value === "object") {
    const tagged = value as Record<string, EncodedValue>;
    if (tagged.__huacai_type === "bigint") return BigInt(String(tagged.value));
    if (tagged.__huacai_type === "date") return String(tagged.value);
    if (tagged.__huacai_type === "bytes") return Buffer.from(String(tagged.value), "base64");
    return Object.fromEntries(Object.entries(tagged).map(([key, item]) => [key, decode(item)]));
  }
  return value;
}

function bridgeError(error?: BridgeError) {
  const message = error?.message || "数据库桥接请求失败。";
  const result = new Error(message) as Error & BridgeError;
  if (error?.code) result.code = error.code;
  if (error?.detail) result.detail = error.detail;
  if (error?.hint) result.hint = error.hint;
  return result;
}

async function executeHttp(query: string, params: unknown[], mode: QueryMode) {
  const { httpUrl, serviceRoleKey } = bridgeConfig();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), QUERY_TIMEOUT_MS);
  try {
    const response = await fetch(httpUrl, {
      method: "POST",
      headers: {
        authorization: `Bearer ${serviceRoleKey}`,
        apikey: serviceRoleKey,
        "content-type": "application/json",
      },
      body: JSON.stringify({ type: "query", query, params: params.map(encode), mode }),
      cache: "no-store",
      signal: controller.signal,
    });
    const body = await response.json() as BridgeReply;
    if (!response.ok || !body.ok) throw bridgeError(body.error || { message: `数据库桥接返回 HTTP ${response.status}。` });
    return (body.rows ?? []).map(decode);
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") throw new Error("数据库 HTTPS 请求超时，请稍后重试。");
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

class PendingBridgeQuery<T> implements PromiseLike<T> {
  constructor(
    private readonly query: string,
    private readonly params: unknown[],
    private readonly execute: QueryExecutor,
  ) {}

  values() {
    return this.execute(this.query, this.params, "array");
  }

  then<TResult1 = T, TResult2 = never>(
    onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    return this.execute(this.query, this.params, "object").then(onfulfilled as never, onrejected);
  }
}

function compileTemplate(strings: TemplateStringsArray, values: unknown[]) {
  let query = strings[0] || "";
  for (let index = 0; index < values.length; index += 1) query += `$${index + 1}${strings[index + 1] || ""}`;
  return { query, params: values };
}

function createSqlTag(execute: QueryExecutor, begin?: <T>(callback: (sql: postgres.Sql) => Promise<T>) => Promise<T>) {
  const tag = (<T extends readonly (object | undefined)[] = postgres.Row[]>(strings: TemplateStringsArray, ...values: unknown[]) => {
    const compiled = compileTemplate(strings, values);
    return new PendingBridgeQuery<T>(compiled.query, compiled.params, execute);
  }) as unknown as postgres.Sql;

  tag.unsafe = ((<T extends readonly (object | undefined)[] = postgres.Row[]>(query: string, params: unknown[] = []) => (
    new PendingBridgeQuery<T>(query, params, execute)
  )) as unknown) as postgres.Sql["unsafe"];
  tag.begin = ((begin || (async () => { throw new Error("当前数据库会话不支持嵌套事务。"); })) as unknown) as postgres.Sql["begin"];
  tag.options = { parsers: {}, serializers: {} } as postgres.Sql["options"];
  return tag;
}

async function executeTransaction<T>(callback: (sql: postgres.Sql) => Promise<T>) {
  const { wsUrl, serviceRoleKey } = bridgeConfig();
  const socket = new WebSocket(wsUrl, {
    headers: {
      authorization: `Bearer ${serviceRoleKey}`,
      apikey: serviceRoleKey,
    },
    handshakeTimeout: QUERY_TIMEOUT_MS,
  });

  const pending = new Map<string, { resolve: (reply: BridgeReply) => void; reject: (error: Error) => void }>();
  let sequence = 0;
  let terminalError: Error | null = null;
  const timer = setTimeout(() => socket.terminate(), TRANSACTION_TIMEOUT_MS);

  const ready = new Promise<void>((resolve, reject) => {
    socket.once("open", resolve);
    socket.once("error", reject);
  });

  socket.on("message", (data) => {
    try {
      const reply = JSON.parse(data.toString()) as BridgeReply;
      if (!reply.id) return;
      const waiter = pending.get(reply.id);
      if (!waiter) return;
      pending.delete(reply.id);
      if (reply.ok) waiter.resolve(reply);
      else waiter.reject(bridgeError(reply.error));
    } catch {
      terminalError = new Error("数据库事务返回了无法识别的响应。");
      socket.terminate();
    }
  });
  socket.on("error", (error) => {
    terminalError = error;
    for (const waiter of pending.values()) waiter.reject(error);
    pending.clear();
  });
  socket.on("close", () => {
    const error = terminalError || new Error("数据库事务连接已提前关闭。");
    for (const waiter of pending.values()) waiter.reject(error);
    pending.clear();
  });

  const send = async (payload: Record<string, unknown>) => {
    await ready;
    const id = String(++sequence);
    const reply = new Promise<BridgeReply>((resolve, reject) => pending.set(id, { resolve, reject }));
    socket.send(JSON.stringify({ ...payload, id }));
    return reply;
  };

  const execute: QueryExecutor = async (query, params, mode) => {
    const reply = await send({ type: "query", query, params: params.map(encode), mode });
    return (reply.rows ?? []).map(decode);
  };

  try {
    await ready;
    const transactionSql = createSqlTag(execute);
    const result = await callback(transactionSql);
    await send({ type: "commit" });
    socket.close(1000, "committed");
    return result;
  } catch (error) {
    if (socket.readyState === WebSocket.OPEN) {
      try { await send({ type: "rollback" }); } catch { /* The original error is more useful. */ }
    }
    socket.close();
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

export function createBridgeSqlClient() {
  return createSqlTag(executeHttp, executeTransaction);
}
