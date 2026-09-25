"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

let browserClient: SupabaseClient | null = null;

function getConfig() {
  return {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    // Aceita a variável atual (publishable) e a variável anon usada por
    // instalações Supabase mais antigas. Nenhuma service_role é aceita aqui.
    key:
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
      "",
  };
}

export function createClient(): SupabaseClient | null {
  if (browserClient) return browserClient;
  if (typeof window === "undefined") return null;

  const { url, key } = getConfig();
  if (!url || !key) return null;

  browserClient = createBrowserClient(url, key);
  return browserClient;
}

// Não inicializa durante SSR/prerender. O singleton nasce apenas no browser.
export const supabase: SupabaseClient | null = createClient();
