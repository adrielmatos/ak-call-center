import { createClient } from "@/lib/supabase/client";

/**
 * Compatibilidade legada com os módulos que ainda importam `supabase`.
 * O cliente real só é criado quando uma propriedade é acessada, evitando
 * inicialização do Supabase durante o prerender/build do Next.js.
 */
export { createClient };

export const supabase = new Proxy({} as ReturnType<typeof createClient>, {
  get(_target, property, receiver) {
    const client = createClient();
    return Reflect.get(client, property, receiver);
  },
});
