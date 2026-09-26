"use client";

import { createBrowserClient } from "@supabase/ssr";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";

let browserClient: SupabaseClient | null = null;

const BUILD_URL = "https://placeholder.invalid";
const BUILD_KEY = "build-placeholder-key";

/**
 * Returns whether the public Supabase configuration was embedded in this
 * client bundle. The publishable key is preferred, with anon key kept as a
 * backwards-compatible fallback for existing Vercel configurations.
 */
export function isSupabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
  );
}

/**
 * Creates the browser Supabase client lazily.
 *
 * Next.js 15 prerenders Client Components during `next build`. A browser
 * client must therefore never be eagerly constructed at module import time.
 * On the server/build side we return a harmless supabase-js placeholder. It
 * is never used for authentication because the real browser path is selected
 * after hydration. In the browser, missing public variables still produce a
 * clear configuration error.
 */
export function createClient(): SupabaseClient {
  if (browserClient) return browserClient;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

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
 * Legacy compatibility export. Property access is lazy, so importing this
 * module can never initialize Supabase during Next.js build/prerender.
 */
export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, property, receiver) {
    const client = createClient();
    return Reflect.get(client, property, receiver);
  },
});
