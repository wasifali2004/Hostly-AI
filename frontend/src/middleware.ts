import { NextResponse, type NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const orgSegments = request.nextUrl.pathname.split("/").filter(Boolean);
  if (orgSegments[0] === "org" && orgSegments.length === 2) {
    return NextResponse.next();
  }

  const hasSession =
    request.cookies.has("access_token") ||
    request.cookies.has("refresh_token") ||
    request.cookies.has("hostly_access_token") ||
    request.cookies.has("hostly_session");

  if (!hasSession) {
    const signIn = new URL("/login", request.url);
    signIn.searchParams.set("next", `${request.nextUrl.pathname}${request.nextUrl.search}`);
    return NextResponse.redirect(signIn);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/org/:path*"]
};
