import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  const requestId = request.headers.get("x-request-id") || crypto.randomUUID();
  const response = NextResponse.next({ request: { headers: request.headers } });
  response.headers.set("x-request-id", requestId);

  if (!request.nextUrl.pathname.startsWith("/api/")) return response;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  // Do not turn a missing Vercel configuration into a deployment-wide 500.
  // API handlers still perform their own authenticated Supabase checks.
  if (!url || !key) {
    response.headers.set("cache-control", "no-store");
    return response;
  }

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(values) {
        values.forEach(({ name, value, options }) => {
          request.cookies.set(name, value);
          response.cookies.set(name, value, options);
        });
      },
    },
    cookieOptions: {
      sameSite: "strict",
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      path: "/",
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { error: { code: "unauthenticated", message: "Authentication required" } },
      { status: 401, headers: { "x-request-id": requestId } },
    );
  }

  response.headers.set("cache-control", "no-store");
  return response;
}

export const config = { matcher: ["/api/:path*"] };
