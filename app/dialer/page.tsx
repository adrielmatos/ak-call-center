import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import DialerWorkspace from "./workspace";

export const dynamic = "force-dynamic";

export default async function DialerPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: operator } = await supabase
    .from("operadores")
    .select("id,nome,email,perfil,ativo")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (!operator || !operator.ativo) redirect("/login?error=operator");

  const [{ data: leads }, { data: scripts }, { data: blocked }] = await Promise.all([
    supabase.from("leads")
      .select("id,nome,cpf,telefone,produto,status,observacoes,dados_extras,cidade,uf,banco,operador_id,created_at")
      .order("created_at", { ascending: false }).limit(150),
    supabase.from("scripts_ligacao")
      .select("id,chave,nome,conteudo,ativo,ordem")
      .eq("ativo", true).order("ordem", { ascending: true }),
    supabase.from("lista_nao_perturbe")
      .select("id,cpf,telefone,motivo,ativo,created_at")
      .eq("ativo", true).order("created_at", { ascending: false }).limit(100),
  ]);

  return <DialerWorkspace
    operator={operator}
    initialLeads={leads || []}
    initialScripts={scripts || []}
    initialBlocked={blocked || []}
  />;
}
