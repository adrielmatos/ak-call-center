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

let browserClient: SupabaseClient | null = null;

function getPublicConfig(): PublicConfig {
  // NEXT_PUBLIC_* values are embedded by Next.js at build time.
  // Keep both Supabase public key names for compatibility with existing
  // Vercel projects created with the older ANON_KEY convention.
  const url = String(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim();

  const key = String(
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
      "",
  ).trim();

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
    const missing = [
      !config.url ? "NEXT_PUBLIC_SUPABASE_URL" : null,
      !config.key
        ? "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ou NEXT_PUBLIC_SUPABASE_ANON_KEY"
        : null,
    ]
      .filter(Boolean)
      .join(" e ");

    throw new Error(
      `Supabase não está configurado no bundle de produção. Variável(is) ausente(s): ${missing}. As variáveis NEXT_PUBLIC_* precisam existir no ambiente usado pelo deployment antes do build.`,
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
