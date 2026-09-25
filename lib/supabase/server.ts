import "server-only";

import { createServerClient } from "@supabase/ssr";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

// These are the public project URL and publishable key. The service_role key is
// intentionally never included in this file as a browser-visible fallback.
const DEFAULT_SUPABASE_URL = "https://vtwyojpsrjyigsnnfawa.supabase.co";
const DEFAULT_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_wBm4Vdroz5rdxo8T5glEqA_npwFbbpP";

function getPublicConfig() {
  return {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL || DEFAULT_SUPABASE_URL,
    key:
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
      DEFAULT_SUPABASE_PUBLISHABLE_KEY,
  };
}

export async function createClient() {
  const store = await cookies();
  const { url, key } = getPublicConfig();

  return createServerClient(url, key, {
    cookies: {
      getAll: () => store.getAll(),
      setAll(values) {
        try {
          values.forEach(({ name, value, options }) =>
            store.set(name, value, options),
          );
        } catch {
          // Server Components podem não permitir escrita de cookies.
        }
      },
    },
  });
}

// Compatibilidade com as rotas existentes.
export const createServerSupabaseClient = createClient;

export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || DEFAULT_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  // Nunca usar uma chave pública como service_role.
  if (!key) throw new Error("Supabase service client não configurado.");

  return createSupabaseClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
