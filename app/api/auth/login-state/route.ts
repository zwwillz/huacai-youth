import { isInitialSetupAvailable } from "@/db/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const startedAt = performance.now();
  const configured = Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
  if (!configured) {
    return Response.json({ data: { configured: false, setup: false } }, {
      headers: { "Cache-Control": "private, no-store" },
    });
  }

  try {
    const setup = await isInitialSetupAvailable();
    return Response.json({ data: { configured: true, setup } }, {
      headers: {
        "Cache-Control": "private, no-store",
        "Server-Timing": `app;dur=${(performance.now() - startedAt).toFixed(1)}`,
      },
    });
  } catch (error) {
    return Response.json({
      error: error instanceof Error ? error.message : "后台初始化状态读取失败。",
      data: { configured: true, setup: false },
    }, { status: 500, headers: { "Cache-Control": "private, no-store" } });
  }
}
