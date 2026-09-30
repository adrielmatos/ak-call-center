import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    const { channel, to, message } = await request.json();
    const { data: operator } = await supabase.from("operadores").select("id").eq("auth_user_id", user.id).maybeSingle();
    if (!operator) return NextResponse.json({ error: "Operador não encontrado." }, { status: 403 });
    const { data: row, error } = await supabase.from("configuracoes_canais").select("configuracoes").eq("operador_id", operator.id).maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    const cfg = row?.configuracoes?.[channel];
    if (!cfg?.ativo || !cfg?.url) return NextResponse.json({ error: "Canal não está configurado como Online ou não possui endpoint." }, { status: 400 });

    const headers: Record<string,string> = { "content-type":"application/json" };
    if (cfg.token) headers.authorization = "Bearer " + cfg.token;
    const upstream = await fetch(cfg.url, {
      method: "POST",
      headers,
      body: JSON.stringify({ to: String(to || ""), text: String(message || "Teste AK Call Center"), message: String(message || "Teste AK Call Center"), channel }),
      signal: AbortSignal.timeout(10000),
    });
    const body = await upstream.text();
    if (!upstream.ok) return NextResponse.json({ error: "O provedor respondeu HTTP " + upstream.status, detail: body.slice(0,500) }, { status: 502 });
    return NextResponse.json({ ok:true, status:upstream.status, detail:body.slice(0,500) });
  } catch (error:any) {
    return NextResponse.json({ error:error?.message||"Falha no teste do canal." }, { status:500 });
  }
}
