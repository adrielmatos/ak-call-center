import { NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    // A sessão do solicitante é validada com o cliente público/cookies.
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }

    const { data: requester } = await supabase
      .from("operadores")
      .select("id,perfil,ativo")
      .eq("auth_user_id", user.id)
      .maybeSingle();

    if (requester?.perfil !== "admin" || requester.ativo === false) {
      return NextResponse.json({ error: "Apenas administradores ativos podem criar usuários." }, { status: 403 });
    }

    const body = await request.json();
    const nome = String(body.nome || "").trim();
    const email = String(body.email || "").trim().toLowerCase();
    const senha = String(body.senha || "");
    const perfil = ["admin", "gestor", "operador"].includes(body.perfil) ? body.perfil : "operador";

    if (!nome || !email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || senha.length < 8) {
      return NextResponse.json({ error: "Informe nome, e-mail válido e senha com pelo menos 8 caracteres." }, { status: 400 });
    }

    const { data: existingOperator, error: lookupError } = await supabase
      .from("operadores")
      .select("id")
      .ilike("email", email)
      .maybeSingle();

    if (lookupError) {
      return NextResponse.json({ error: "Não foi possível verificar se o usuário já existe.", detail: lookupError.message }, { status: 500 });
    }
    if (existingOperator) {
      return NextResponse.json({ error: "Já existe um usuário operacional com este e-mail." }, { status: 409 });
    }

    const url = String(process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
    const serviceRoleKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
    if (!url || !serviceRoleKey) {
      return NextResponse.json({ error: "Configuração administrativa do Supabase ausente no servidor. Verifique SUPABASE_SERVICE_ROLE_KEY." }, { status: 503 });
    }

    // Chave privilegiada usada exclusivamente no servidor, após validar o administrador.
    // email_confirm=true libera o login imediato e não dispara confirmação de cadastro.
    const admin = createSupabaseClient(url, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
    });

    const { data: created, error: authError } = await admin.auth.admin.createUser({
      email,
      password: senha,
      email_confirm: true,
      user_metadata: { nome },
    });

    if (authError || !created.user) {
      const message = authError?.message || "Não foi possível criar a conta de autenticação.";
      const duplicate = /already|exists|registered|duplicate/i.test(message);
      return NextResponse.json({
        error: duplicate
          ? "Este e-mail já possui uma conta de autenticação. Não foi alterada a senha existente."
          : message,
      }, { status: duplicate ? 409 : 400 });
    }

    const { error: profileError } = await admin.from("operadores").insert({
      nome,
      email,
      perfil,
      ativo: body.ativo !== false,
      auth_user_id: created.user.id,
      permissoes: {},
      preferencias: {},
    });

    if (profileError) {
      // Rollback: evita deixar conta Auth órfã se o perfil operacional falhar.
      await admin.auth.admin.deleteUser(created.user.id);
      return NextResponse.json({
        error: "O perfil operacional não foi salvo. A conta de autenticação criada nesta tentativa foi revertida; tente novamente.",
        detail: profileError.message,
      }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      user_id: created.user.id,
      confirmation_required: false,
      message: "Usuário cadastrado, confirmado e pronto para entrar com a senha definida.",
    }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Erro interno ao cadastrar usuário." }, { status: 500 });
  }
}
