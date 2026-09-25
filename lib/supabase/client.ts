"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

// Publishable Supabase configuration is intentionally safe to expose in the browser.
// The fallback keeps the production app operational even if Vercel env vars were not
// configured yet. No service_role key is ever placed here.
const DEFAULT_SUPABASE_URL = "https://vtwyojpsrjyigsnnfawa.supabase.co";
const DEFAULT_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_wBm4Vdroz5rdxo8T5glEqA_npwFbbpP";

let browserClient: SupabaseClient | null = null;

function getConfig() {
  return {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL || DEFAULT_SUPABASE_URL,
    key:
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
      DEFAULT_SUPABASE_PUBLISHABLE_KEY,
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

// Importante: não inicializar o cliente durante SSR/prerender.
// No navegador, a inicialização ocorre uma única vez.
export const supabase: SupabaseClient | null = createClient();
