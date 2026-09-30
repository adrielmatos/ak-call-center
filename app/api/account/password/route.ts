import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { createClient as createPublicClient } from "@supabase/supabase-js";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.email) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

    const { currentPassword, password } = await request.json();
    if (String(password || "").length < 8) return NextResponse.json({ error: "A nova senha precisa ter pelo menos 8 caracteres." }, { status: 400 });

    const url = String(process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
    const key = String(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "").trim();
    if (!url || !key) return NextResponse.json({ error: "Supabase não configurado." }, { status: 503 });

    const verifier = createPublicClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
    const { error: verifyError } = await verifier.auth.signInWithPassword({ email: user.email, password: String(currentPassword || "") });
    if (verifyError) return NextResponse.json({ error: "Senha atual incorreta." }, { status: 400 });

    const admin = createServiceClient();
    const { error } = await admin.auth.admin.updateUserById(user.id, { password: String(password) });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Erro interno." }, { status: 500 });
  }
}
