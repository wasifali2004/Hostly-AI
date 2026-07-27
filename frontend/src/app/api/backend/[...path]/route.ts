import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const backendApiUrl = (
  process.env.BACKEND_API_URL ??
  process.env.NEXT_PUBLIC_API_URL ??
  "http://localhost:4100/api/v1"
).replace(/\/$/, "");

const hopByHopHeaders = new Set([
  "connection",
  "content-length",
  "host",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade"
]);

type RouteContext = {
  params: Promise<{ path: string[] }>;
};

async function proxyRequest(request: NextRequest, context: RouteContext) {
  const { path } = await context.params;
  const upstreamUrl = new URL(
    `${backendApiUrl}/${path.map(encodeURIComponent).join("/")}`
  );
  upstreamUrl.search = request.nextUrl.search;

  const requestHeaders = new Headers(request.headers);
  for (const header of hopByHopHeaders) {
    requestHeaders.delete(header);
  }

  const requestInit: RequestInit = {
    method: request.method,
    headers: requestHeaders,
    cache: "no-store",
    redirect: "manual"
  };

  if (request.method !== "GET" && request.method !== "HEAD") {
    requestInit.body = await request.arrayBuffer();
  }

  const upstreamResponse = await fetch(upstreamUrl, requestInit);
  const responseHeaders = new Headers();

  upstreamResponse.headers.forEach((value, key) => {
    const normalizedKey = key.toLowerCase();
    if (!hopByHopHeaders.has(normalizedKey) && normalizedKey !== "set-cookie") {
      responseHeaders.append(key, value);
    }
  });

  const headersWithCookies = upstreamResponse.headers as Headers & {
    getSetCookie?: () => string[];
  };
  const setCookies =
    typeof headersWithCookies.getSetCookie === "function"
      ? headersWithCookies.getSetCookie()
      : [];

  if (setCookies.length > 0) {
    for (const cookie of setCookies) {
      responseHeaders.append("set-cookie", cookie);
    }
  } else {
    const combinedCookie = upstreamResponse.headers.get("set-cookie");
    if (combinedCookie) {
      responseHeaders.append("set-cookie", combinedCookie);
    }
  }

  return new Response(upstreamResponse.body, {
    status: upstreamResponse.status,
    statusText: upstreamResponse.statusText,
    headers: responseHeaders
  });
}

export const GET = proxyRequest;
export const POST = proxyRequest;
export const PUT = proxyRequest;
export const PATCH = proxyRequest;
export const DELETE = proxyRequest;
export const OPTIONS = proxyRequest;
