import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

    const { data: operator } = await supabase.from("operadores").select("id,perfil").eq("auth_user_id", user.id).maybeSingle();
    if (operator?.perfil !== "admin") return NextResponse.json({ error: "Apenas administradores podem criar operadores." }, { status: 403 });

    const body = await request.json();
    const nome = String(body.nome || "").trim();
    const email = String(body.email || "").trim().toLowerCase();
    const senha = String(body.senha || "");
    const perfil = ["admin","gestor","operador"].includes(body.perfil) ? body.perfil : "operador";
    if (!nome || !email || senha.length < 8) return NextResponse.json({ error: "Nome, e-mail e senha com pelo menos 8 caracteres são obrigatórios." }, { status: 400 });

    const admin = createServiceClient();
    const { data: created, error: authError } = await admin.auth.admin.createUser({
      email,
      password: senha,
      email_confirm: true,
      user_metadata: { nome },
    });
    if (authError || !created.user) return NextResponse.json({ error: authError?.message || "Não foi possível criar o usuário." }, { status: 400 });

    const { error: opError } = await admin.from("operadores").insert({
      nome,
      email,
      perfil,
      ativo: body.ativo !== false,
      auth_user_id: created.user.id,
      permissoes: {},
      preferencias: {},
    });
    if (opError) {
      await admin.auth.admin.deleteUser(created.user.id);
      return NextResponse.json({ error: opError.message }, { status: 400 });
    }
    return NextResponse.json({ ok: true, user_id: created.user.id });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Erro interno." }, { status: 500 });
  }
}
