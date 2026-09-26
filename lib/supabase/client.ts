"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

let browserClient: SupabaseClient | null = null;

const BUILD_URL = "https://placeholder.invalid";
const BUILD_KEY = "build-placeholder-key";

/**
 * Browser Supabase client.
 *
 * IMPORTANT: Next.js prerenders Client Components during `next build`.
 * Therefore this module must never throw merely because public Supabase
 * variables are unavailable in the build environment. During the build/server
 * side we use a harmless placeholder client. In the real browser, missing
 * variables still fail loudly so the login screen can report configuration
 * problems instead of silently operating without a database.
 */
export function isSupabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
  );
}

export function createClient(): SupabaseClient {
  if (browserClient) return browserClient;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Never let a Client Component prerender fail the Vercel build because
  // public env vars are not exposed to the build worker. The placeholder is
  // never used for real browser authentication.
  if (typeof window === "undefined") {
    return createBrowserClient(BUILD_URL, BUILD_KEY);
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
 * Legacy compatibility export. It is intentionally lazy so importing this
 * module can never initialize Supabase during Next.js build/prerender.
 */
export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, property, receiver) {
    const client = createClient();
    return Reflect.get(client, property, receiver);
  },
});
