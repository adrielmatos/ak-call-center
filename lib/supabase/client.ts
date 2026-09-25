"use client";
import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

let browserClient: SupabaseClient | null = null;

export function createClient(): SupabaseClient {
  if (browserClient) return browserClient;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("Supabase não configurado.");
  browserClient = createBrowserClient(url, key);
  return browserClient;
}

// Intentionally no eager `supabase = createClient()` export here.
// The authenticated dashboard is prerendered by Next.js during build, so
// creating the browser client at module evaluation time would make a build
// fail whenever Preview/Build has no browser environment variables.
