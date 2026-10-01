import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_API_PATHS = new Set([
  "/api/config",
  "/api/health",
  "/api/calls",
]);

export async function middleware(request: NextRequest) {
  const requestId =
    request.headers.get("x-request-id") ||
    crypto.randomUUID();

  const response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  response.headers.set("x-request-id", requestId);

  const pathname = request.nextUrl.pathname;

  if (!pathname.startsWith("/api/")) {
    return response;
  }

  if (PUBLIC_API_PATHS.has(pathname)) {
    response.headers.set("cache-control", "no-store");
    return response;
  }

  // Protected API routes validate the Supabase session themselves.
  // Keep middleware free of Supabase configuration so a missing build-time
  // environment variable cannot break the entire Next.js build/runtime.
  response.headers.set("cache-control", "no-store");
  return response;
}

export const config = {
  matcher: ["/api/:path*"],
};
