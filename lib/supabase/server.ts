import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

function getPublicConfig() {
  const url = String(process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
  const key = String(
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || ""
  ).trim();
  if (!url || !key) {
    throw new Error("Supabase não configurado. Configure NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY no ambiente.");
  }
  return { url, key };
}

export async function createClient() {
  const cookieStore = await cookies();
  const { url, key } = getPublicConfig();
  return createServerClient(url, key, {
    cookies: {
      getAll() { return cookieStore.getAll(); },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Server Components podem não permitir escrita; o middleware renova a sessão.
        }
      },
    },
  });
}
export const createServerSupabaseClient = createClient;
