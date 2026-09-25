"use client";
import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

let browserClient: SupabaseClient | null = null;

function getConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  return { url, key };
}

export function createClient(): SupabaseClient | null {
  if (browserClient) return browserClient;
  if (typeof window === "undefined") return null;

  const { url, key } = getConfig();
  if (!url || !key) return null;

  browserClient = createBrowserClient(url, key);
  return browserClient;
}

// Nunca inicializa o cliente Supabase no módulo durante o build/prerender.
// A aplicação já trata `supabase === null` e mostra uma mensagem operacional.
export const supabase: SupabaseClient | null = createClient();
