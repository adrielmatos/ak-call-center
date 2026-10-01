import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_API_PATHS = new Set([
  "/api/config",
  "/api/health",
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

  response.headers.set(
    "x-request-id",
    requestId,
  );

  const pathname = request.nextUrl.pathname;

  if (!pathname.startsWith("/api/")) {
    return response;
  }

  // Endpoints públicos usados por monitoramento e diagnóstico.
  if (PUBLIC_API_PATHS.has(pathname) || pathname === "/api/calls") {
    response.headers.set(
      "cache-control",
      "no-store",
    );

    return response;
  }

  const url = String(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  ).trim();

  const key = String(
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
      "",
  ).trim();

  /**
   * API protegida sem Supabase configurado deve falhar fechada.
   * Nunca liberar a requisição apenas porque a configuração está ausente.
   */
  if (!url || !key) {
    return NextResponse.json(
      {
        error: {
          code: "supabase_not_configured",
          message:
            "Serviço de autenticação temporariamente indisponível.",
        },
      },
      {
        status: 503,
        headers: {
          "x-request-id": requestId,
          "cache-control": "no-store",
        },
      },
    );
  }

  const supabase = createServerClient(
    url,
    key,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },

        setAll(values) {
          values.forEach(
            ({ name, value, options }) => {
              request.cookies.set(
                name,
                value,
              );

              response.cookies.set(
                name,
                value,
                options,
              );
            },
          );
        },
      },
    },
  );

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return NextResponse.json(
      {
        error: {
          code: "unauthenticated",
          message: "Authentication required",
        },
      },
      {
        status: 401,
        headers: {
          "x-request-id": requestId,
          "cache-control": "no-store",
        },
      },
    );
  }

  response.headers.set(
    "cache-control",
    "no-store",
  );

  return response;
}

export const config = {
  matcher: ["/api/:path*"],
};
