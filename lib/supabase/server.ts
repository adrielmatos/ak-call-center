import "server-only";

import { createServerClient } from "@supabase/ssr";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

type SupabasePublicConfig = {
  url: string;
  key: string;
};

// Public browser-safe fallback keeps the server client from crashing when a
// deployment was created without NEXT_PUBLIC_* values. The service-role client
// below remains strict and never falls back to a public key.
const FALLBACK_PUBLIC_CONFIG: SupabasePublicConfig = {
  url: "https://vtwyojpsrjyigsnnfawa.supabase.co",
  key: "sb_publishable_wBm4Vdroz5rdxo8T5glEqA_npwFbbpP",
};

function getPublicConfig(): SupabasePublicConfig {
  const url = String(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  ).trim();

  const envKey = String(
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
      "",
  ).trim();

  return {
    url: url || FALLBACK_PUBLIC_CONFIG.url,
    key: envKey || FALLBACK_PUBLIC_CONFIG.key,
  };
}

function assertPublicConfig(
  config: SupabasePublicConfig,
): void {
  if (!config.url || !config.key) {
    throw new Error(
      "Supabase público não está configurado no servidor.",
    );
  }
}

export async function createClient() {
  const cookieStore = await cookies();
  const config = getPublicConfig();

  assertPublicConfig(config);

  return createServerClient(
    config.url,
    config.key,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },

        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(
              ({ name, value, options }) => {
                cookieStore.set(
                  name,
                  value,
                  options,
                );
              },
            );
          } catch {
            // Server Components podem não permitir escrita de cookies.
            // O middleware é responsável pela renovação da sessão.
          }
        },
      },
    },
  );
}

// Compatibilidade com rotas existentes.
export const createServerSupabaseClient = createClient;

/**
 * Cliente administrativo. Nunca usar em Client Components.
 * SUPABASE_SERVICE_ROLE_KEY jamais deve possuir o prefixo NEXT_PUBLIC_.
 */
export function createServiceClient() {
  const url = String(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  ).trim();

  const serviceRoleKey = String(
    process.env.SUPABASE_SERVICE_ROLE_KEY || "",
  ).trim();

  if (!url || !serviceRoleKey) {
    throw new Error(
      "Supabase Service Role não está configurado.",
    );
  }

  return createSupabaseClient(
    url,
    serviceRoleKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
}
