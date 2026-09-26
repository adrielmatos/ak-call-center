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
 * Auth compatibility layer: the first getSession call is allowed to initialize
 * the runtime client asynchronously. This prevents a missing NEXT_PUBLIC_*
 * value in the statically built browser bundle from crashing the login page.
 */
const authProxy = new Proxy({} as SupabaseClient["auth"], {
  get(_target, property) {
    if (property === "getSession") {
      return () => ensureClient().then((client) => client.auth.getSession());
    }
    if (property === "onAuthStateChange") {
      return (...args: Parameters<SupabaseClient["auth"]["onAuthStateChange"]>) => {
        if (browserClient) return browserClient.auth.onAuthStateChange(...args);
        return {
          data: {
            subscription: {
              unsubscribe() {},
            },
          },
        } as ReturnType<SupabaseClient["auth"]["onAuthStateChange"]>;
      };
    }
    if (browserClient) {
      const value = Reflect.get(browserClient.auth as object, property);
      return typeof value === "function" ? value.bind(browserClient.auth) : value;
    }
    return undefined;
  },
});

export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, property, receiver) {
    if (property === "auth") return authProxy;
    const client = createClient();
    const value = Reflect.get(client as object, property, receiver);
    return typeof value === "function" ? value.bind(client) : value;
  },
});
