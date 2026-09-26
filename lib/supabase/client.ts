"use client";

import { createBrowserClient } from "@supabase/ssr";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";

let browserClient: SupabaseClient | null = null;

const BUILD_URL = "https://placeholder.invalid";
const BUILD_KEY = "build-placeholder-key";

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

export function createClient(): SupabaseClient {
  if (browserClient) return browserClient;

  const { url, key } = getConfig();

  // Client Components are prerendered by Next.js during `next build`.
  // Never make the build depend on public env vars being present in the
  // build worker. A server-only placeholder is never used for auth/data.
  if (typeof window === "undefined") {
    return createSupabaseClient(BUILD_URL, BUILD_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }

  if (!url || !key) {
    throw new Error(
      "Supabase não configurado. Verifique NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY na Vercel."
    );
  }

  browserClient = createBrowserClient(url, key);
  return browserClient;
}

/**
 * Lazy compatibility client. Importing this module cannot initialize Supabase
 * during Next.js build/prerender; the actual browser client is resolved only
 * when one of its properties is accessed.
 */
export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, property, receiver) {
    const client = createClient();
    const value = Reflect.get(client as object, property, receiver);
    return typeof value === "function" ? value.bind(client) : value;
  },
});
