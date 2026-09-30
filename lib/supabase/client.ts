"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

type PublicConfig = {
  url: string;
  key: string;
};

type AuthSubscription = ReturnType<
  SupabaseClient["auth"]["onAuthStateChange"]
>;

/**
 * These are intentionally PUBLIC Supabase values.
 * A publishable/anon key is designed to be present in browser applications;
 * never put service_role or secret keys here.
 *
 * The fallback exists because NEXT_PUBLIC_* values are compile-time values in
 * Next.js client bundles. If a Vercel deployment was built without them, the
 * application can still connect to this known Supabase project instead of
 * failing during the initial React render.
 */
const FALLBACK_PUBLIC_CONFIG: PublicConfig = {
  url: "https://vtwyojpsrjyigsnnfawa.supabase.co",
  key: "sb_publishable_wBm4Vdroz5rdxo8T5glEqA_npwFbbpP",
};

let browserClient: SupabaseClient | null = null;

function getPublicConfig(): PublicConfig {
  // Next.js replaces NEXT_PUBLIC_* references at build time for browser code.
  // Keep both modern publishable and legacy anon names for compatibility.
  const envUrl = String(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim();
  const envPublishableKey = String(
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "",
  ).trim();
  const envAnonKey = String(
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
  ).trim();

  const url = envUrl || FALLBACK_PUBLIC_CONFIG.url;
  const key = envPublishableKey || envAnonKey || FALLBACK_PUBLIC_CONFIG.key;

  if (typeof window !== "undefined") {
    // Diagnostic logging deliberately reports only presence/source metadata.
    // Never log the URL value, API key, JWT, service_role key, or secret key.
    console.info("[Supabase] browser bundle configuration", {
      urlFromEnv: Boolean(envUrl),
      publishableKeyFromEnv: Boolean(envPublishableKey),
      anonKeyFromEnv: Boolean(envAnonKey),
      usingFallbackUrl: !envUrl,
      usingFallbackKey: !envPublishableKey && !envAnonKey,
      resolved: Boolean(url && key),
    });
  }

  return { url, key };
}

function assertBrowser(): void {
  if (typeof window === "undefined") {
    throw new Error(
      "O cliente Supabase do navegador não pode ser usado no servidor. Use lib/supabase/server.ts.",
    );
  }
}

function assertConfig(config: PublicConfig): void {
  if (!config.url || !config.key) {
    throw new Error(
      "Supabase não está configurado. Nenhuma configuração pública válida foi encontrada.",
    );
  }
}

export function isSupabaseConfigured(): boolean {
  const config = getPublicConfig();
  return Boolean(config.url && config.key);
}

export async function ensureSupabaseConfig(): Promise<PublicConfig> {
  assertBrowser();

  const config = getPublicConfig();
  assertConfig(config);

  return config;
}

export function createClient(): SupabaseClient {
  assertBrowser();

  if (browserClient) {
    return browserClient;
  }

  const config = getPublicConfig();
  assertConfig(config);

  browserClient = createBrowserClient(config.url, config.key);

  return browserClient;
}

export async function ensureClient(): Promise<SupabaseClient> {
  return createClient();
}

const authProxy = new Proxy({} as SupabaseClient["auth"], {
  get(_target, property) {
    if (property === "getSession") {
      return () =>
        ensureClient().then((client) => client.auth.getSession());
    }

    if (property === "onAuthStateChange") {
      return (
        callback: Parameters<
          SupabaseClient["auth"]["onAuthStateChange"]
        >[0],
      ): AuthSubscription => {
        let active = true;
        let subscription:
          | AuthSubscription["data"]["subscription"]
          | null = null;

        void ensureClient()
          .then((client) => {
            if (!active) return;

            const result = client.auth.onAuthStateChange(callback);
            subscription = result.data.subscription;
          })
          .catch((error) => {
            console.error(
              "Falha ao inicializar a autenticação do Supabase:",
              error,
            );
          });

        return {
          data: {
            subscription: {
              unsubscribe() {
                active = false;
                subscription?.unsubscribe();
              },
            },
          },
        } as AuthSubscription;
      };
    }

    const client = browserClient;
    if (!client) {
      return undefined;
    }

    const value = Reflect.get(client.auth as object, property);

    return typeof value === "function"
      ? value.bind(client.auth)
      : value;
  },
});

export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, property, receiver) {
    if (property === "auth") {
      return authProxy;
    }

    const client = createClient();
    const value = Reflect.get(client as object, property, receiver);

    return typeof value === "function"
      ? value.bind(client)
      : value;
  },
});
