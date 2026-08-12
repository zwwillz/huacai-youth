const WECHAT_VERIFICATION_TOKEN = "719b5c7962598f01bdabe4a58927b6bd6f24d1ef";

export const dynamic = "force-static";

export function GET() {
  return new Response(WECHAT_VERIFICATION_TOKEN, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=300",
    },
  });
}

export function HEAD() {
  return new Response(null, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=300",
    },
  });
}
