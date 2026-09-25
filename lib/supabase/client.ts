"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

let browserClient: SupabaseClient | null = null;

function getConfig() {
  return {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    key: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "",
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

// Não inicializar durante SSR/prerender. O cliente só existe no navegador.
export const supabase: SupabaseClient | null = createClient();
