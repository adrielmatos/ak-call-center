import { NextResponse } from "next/server";
import { createClient as createPublicClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

    const { data: operator } = await supabase.from("operadores")
      .select("id,perfil").eq("auth_user_id", user.id).maybeSingle();
    if (operator?.perfil !== "admin") {
      return NextResponse.json({ error: "Apenas administradores podem criar operadores." }, { status: 403 });
    }

    const body = await request.json();
    const nome = String(body.nome || "").trim();
    const email = String(body.email || "").trim().toLowerCase();
    const senha = String(body.senha || "");
    const perfil = ["admin","gestor","operador"].includes(body.perfil) ? body.perfil : "operador";
    if (!nome || !email || senha.length < 8) {
      return NextResponse.json({ error: "Nome, e-mail e senha com pelo menos 8 caracteres são obrigatórios." }, { status: 400 });
    }

    const url = String(process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
    const key = String(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "").trim();
    if (!url || !key) return NextResponse.json({ error: "Supabase não configurado." }, { status: 503 });

    // Cria o usuário Auth com a chave publicável; o cadastro do operador é feito
    // pela sessão autenticada do administrador e protegido por RLS.
    const authClient = createPublicClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
    const { data: created, error: authError } = await authClient.auth.signUp({
      email, password: senha, options: { data: { nome } },
    });
    if (authError || !created.user) {
      return NextResponse.json({ error: authError?.message || "Não foi possível criar o usuário." }, { status: 400 });
    }

    const { error: opError } = await supabase.from("operadores").insert({
      nome, email, perfil, ativo: body.ativo !== false, auth_user_id: created.user.id,
      permissoes: {}, preferencias: {},
    });
    if (opError) {
      return NextResponse.json({
        error: "A conta de autenticação foi criada, mas o perfil operacional não foi salvo. Contate o administrador.",
        detail: opError.message, user_id: created.user.id,
      }, { status: 400 });
    }
    return NextResponse.json({
      ok: true, user_id: created.user.id,
      confirmation_required: !created.session,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Erro interno." }, { status: 500 });
  }
}
