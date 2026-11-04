"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

type PublicConfig = { url: string; key: string };
type AuthSubscription = ReturnType<SupabaseClient["auth"]["onAuthStateChange"]>;

function getPublicConfig(): PublicConfig {
  const url = String(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim();
  const key = String(
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? ""
  ).trim();
  return { url, key };
}

let browserClient: SupabaseClient | null = null;

function assertBrowser(): void {
  if (typeof window === "undefined") {
    throw new Error("O cliente Supabase do navegador não pode ser usado no servidor.");
  }
}
function assertConfig(config: PublicConfig): void {
  if (!config.url || !config.key) {
    throw new Error("Supabase não configurado para este ambiente. Configure NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.");
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
  if (browserClient) return browserClient;
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
    if (property === "getSession") return () => ensureClient().then((client) => client.auth.getSession());
    if (property === "onAuthStateChange") {
      return (callback: Parameters<SupabaseClient["auth"]["onAuthStateChange"]>[0]): AuthSubscription => {
        let active = true;
        let subscription: AuthSubscription["data"]["subscription"] | null = null;
        void ensureClient().then((client) => {
          if (!active) return;
          subscription = client.auth.onAuthStateChange(callback).data.subscription;
        }).catch((error) => console.error("Falha ao inicializar a autenticação do Supabase:", error));
        return { data: { subscription: { unsubscribe() { active = false; subscription?.unsubscribe(); } } } } as AuthSubscription;
      };
    }
    const client = browserClient;
    if (!client) return undefined;
    const value = Reflect.get(client.auth as object, property);
    return typeof value === "function" ? value.bind(client.auth) : value;
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
