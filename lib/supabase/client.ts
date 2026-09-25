"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

let browserClient: SupabaseClient | null = null;

function getConfig() {
  const url = String(process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
  const key = String(
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
      ""
  ).trim();
  return { url, key };
}

export function isSupabaseConfigured() {
  const { url, key } = getConfig();
  return Boolean(url && key);
}

export function createClient(): SupabaseClient | null {
  if (browserClient) return browserClient;
  if (typeof window === "undefined") return null;

  const { url, key } = getConfig();
  if (!url || !key) return null;

  browserClient = createBrowserClient(url, key);
  return browserClient;
}

/**
 * Lazy browser client.
 *
 * The old singleton was created while the module was being evaluated. During
 * Next.js SSR/prerender `window` does not exist, so that singleton became
 * permanently null and the login screen incorrectly reported missing Vercel
 * variables even when the public Supabase variables were configured.
 *
 * The proxy keeps the existing `supabase.auth` / `supabase.from` API intact
 * and resolves the browser client only when a method/property is accessed.
 */
export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, property, receiver) {
    const client = createClient();

    if (!client) {
      if (!isSupabaseConfigured()) {
        throw new Error(
          "Supabase não configurado. Verifique NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY na Vercel."
        );
      }
      throw new Error("Cliente Supabase indisponível fora do navegador.");
    }

    const value = Reflect.get(client as object, property, receiver);
    return typeof value === "function" ? value.bind(client) : value;
  },
});
