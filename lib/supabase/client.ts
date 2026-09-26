"use client";

import { createBrowserClient } from "@supabase/ssr";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";

let browserClient: SupabaseClient | null = null;
let configPromise: Promise<{ url: string; key: string }> | null = null;

const BUILD_URL = "https://placeholder.invalid";
const BUILD_KEY = "build-placeholder-key";

function getEmbeddedConfig() {
  const url = String(process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
  const key = String(
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
      ""
  ).trim();
  return { url, key };
}

export function isSupabaseConfigured() {
  const { url, key } = getEmbeddedConfig();
  return Boolean(url && key);
}

/**
 * Resolves the public Supabase configuration at runtime when Vercel did not
 * inject NEXT_PUBLIC_* variables into the client bundle during the build.
 * Only the public URL and publishable/anon key are ever returned.
 */
export async function ensureSupabaseConfig() {
  const embedded = getEmbeddedConfig();
  if (embedded.url && embedded.key) return embedded;

  if (!configPromise) {
    configPromise = fetch("/api/config", {
      method: "GET",
      cache: "no-store",
      credentials: "same-origin",
    })
      .then(async (response) => {
        const body = await response.json().catch(() => null);
        if (!response.ok || !body?.configured || !body.url || !body.key) {
          throw new Error(
            "Conexão com o banco não foi configurada no servidor. Verifique as variáveis públicas do Supabase na Vercel."
          );
        }
        return { url: String(body.url).trim(), key: String(body.key).trim() };
      })
      .catch((error) => {
        configPromise = null;
        throw error;
      });
  }

  return configPromise;
}

/**
 * Returns the browser Supabase client. During Next.js prerender this function
 * uses a harmless placeholder and never contacts Supabase. In the browser,
 * callers should use ensureClient() so runtime Vercel configuration is loaded
 * before auth/data operations begin.
 */
export function createClient(): SupabaseClient {
  if (browserClient) return browserClient;

  const { url, key } = getEmbeddedConfig();

  if (typeof window === "undefined") {
    return createSupabaseClient(BUILD_URL, BUILD_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }

  if (!url || !key) {
    throw new Error("Supabase ainda não foi inicializado no navegador.");
  }

  browserClient = createBrowserClient(url, key);
  return browserClient;
}

export async function ensureClient(): Promise<SupabaseClient> {
  if (browserClient) return browserClient;
  if (typeof window === "undefined") return createClient();

  const { url, key } = await ensureSupabaseConfig();
  browserClient = createBrowserClient(url, key);
  return browserClient;
}

/**
 * Compatibility proxy used by the existing application. It is safe only after
 * ensureClient() has completed in browser code; existing server/build imports
 * remain compatible and no Supabase network client is created during build.
 */
export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, property, receiver) {
    const client = createClient();
    const value = Reflect.get(client as object, property, receiver);
    return typeof value === "function" ? value.bind(client) : value;
  },
});
