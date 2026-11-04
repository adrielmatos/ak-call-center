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

    // Impede duplicidade no cadastro operacional antes de criar a conta Auth.
    const body = await request.json();
    const nome = String(body.nome || "").trim();
    const email = String(body.email || "").trim().toLowerCase();
    const senha = String(body.senha || "");
    const perfil = ["admin","gestor","operador"].includes(body.perfil) ? body.perfil : "operador";
    if (!nome || !email || senha.length < 8) {
      return NextResponse.json({ error: "Nome, e-mail e senha com pelo menos 8 caracteres são obrigatórios." }, { status: 400 });
    }
    const { data: existingOperator } = await supabase.from("operadores")
      .select("id").ilike("email", email).maybeSingle();
    if (existingOperator) {
      return NextResponse.json({ error: "Já existe um cadastro operacional com este e-mail. Use a recuperação de acesso ou confira o cadastro existente." }, { status: 409 });
    }
    if (operator?.perfil !== "admin") {
      return NextResponse.json({ error: "Apenas administradores podem criar operadores." }, { status: 403 });
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
    // Supabase pode retornar um usuário fictício sem erro quando o e-mail já existe.
    // Não associar esse ID a um novo perfil nem informar sucesso.
    if (created.user.identities?.length === 0) {
      return NextResponse.json({ error: "Este e-mail já possui uma conta de acesso. Não foi criada uma nova senha. Use a recuperação de senha ou informe outro e-mail." }, { status: 409 });
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
      ok: true,
      user_id: created.user.id,
      confirmation_required: !created.session,
      message: created.session
        ? "Usuário cadastrado e pronto para acessar."
        : "Cadastro criado. O usuário precisa confirmar o e-mail antes do primeiro acesso.",
    }, { status: created.session ? 201 : 202 });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Erro interno." }, { status: 500 });
  }
}
