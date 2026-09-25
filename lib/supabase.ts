export { createClient } from "@/lib/supabase/client";

// Compatibilidade: o cliente `supabase` não é criado durante o import.
// Isso evita inicialização do Supabase durante prerender/build do Next.js.
// Use createClient() dentro de Client Components quando precisar do browser client.
