"use client";

import { createPortal } from "react-dom";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase";
import OperationsHub from "./operations-hub";

export default function OperationsSurface() {
  const pathname = usePathname();
  const [session, setSession] = useState<any>(null);
  const [stats, setStats] = useState({ leads: 0, queue: 0, returns: 0, calls: 0 });
  const [mount, setMount] = useState<HTMLElement | null>(null);

  useEffect(() => {
    if (!supabase) return;
    let alive = true;
    supabase.auth.getSession().then(({ data }) => {
      if (alive) setSession(data.session);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, next) => {
      if (alive) setSession(next);
    });
    return () => {
      alive = false;
      data.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (pathname !== "/" || !session) {
      setMount(null);
      return;
    }

    const content = document.querySelector<HTMLElement>("main.content");
    const header = content?.querySelector<HTMLElement>(":scope > .header");
    if (!content || !header) return;

    const host = document.createElement("div");
    host.className = "akOperationsSurfaceHost";
    host.setAttribute("data-ak-operations-surface", "true");
    header.insertAdjacentElement("afterend", host);
    setMount(host);

    return () => {
      host.remove();
      setMount(null);
    };
  }, [pathname, session]);

  useEffect(() => {
    if (!session || pathname !== "/" || !supabase) return;
    let active = true;
    (async () => {
      const [l, r, c] = await Promise.all([
        supabase.from("leads").select("id,status,bloqueado,opt_out,telefones(id)", { count: "exact", head: false }).limit(1000),
        supabase.from("retornos").select("id", { count: "exact", head: true }).eq("concluido", false),
        supabase.from("ligacoes").select("id", { count: "exact", head: true }),
      ]);
      if (!active) return;
      const leads = l.data || [];
      setStats({
        leads: l.count ?? leads.length,
        queue: leads.filter((x: any) => x.status === "disponivel" && !x.bloqueado && !x.opt_out && x.telefones?.length).length,
        returns: r.count ?? 0,
        calls: c.count ?? 0,
      });
    })();
    return () => { active = false; };
  }, [session, pathname]);

  if (!session || pathname !== "/" || !mount) return null;

  const openHub = () => document.querySelector<HTMLButtonElement>(".opsLauncher")?.click();

  return (
    <>
      {createPortal(
        <section className="akOperationsSurface" aria-label="Operação 360">
          <div className="akOpsSurfaceHead">
            <div>
              <span>OPERAÇÃO 360</span>
              <h2>Fila inteligente + Customer 360</h2>
              <p>As novas funções ficam visíveis aqui e continuam usando a mesma discadora, CRM e banco do A&K.</p>
            </div>
            <button onClick={openHub}>Abrir central 360</button>
          </div>
          <div className="akOpsSurfaceGrid">
            <div className="akOpsSurfaceCard"><b>☎ Fila inteligente</b><strong>{stats.queue}</strong><small>contatos prontos para trabalhar</small></div>
            <div className="akOpsSurfaceCard"><b>◉ Customer 360</b><strong>{stats.leads}</strong><small>leads compartilhados entre módulos</small></div>
            <div className="akOpsSurfaceCard"><b>◷ Próximas ações</b><strong>{stats.returns}</strong><small>retornos pendentes</small></div>
            <div className="akOpsSurfaceCard"><b>▣ Indicadores</b><strong>{stats.calls}</strong><small>ligações registradas</small></div>
          </div>
          <div className="akOpsSurfaceFeatures">
            <button onClick={openHub}><b>Customer 360</b><span>linha do tempo de ligações, retornos, propostas e tarefas</span></button>
            <button onClick={openHub}><b>Script de ligação</b><span>roteiro por produto com banco e contexto do lead</span></button>
            <button onClick={openHub}><b>Relatórios por banco</b><span>contatos, atendidas, interessados e propostas</span></button>
            <button onClick={openHub}><b>Filtros de fila</b><span>banco, produto, busca e prioridade</span></button>
          </div>
          <style jsx global>{`
            .akOperationsSurfaceHost{display:block;width:100%;margin:0 0 18px}
            .akOperationsSurface{display:block;width:100%;box-sizing:border-box;background:linear-gradient(135deg,#081a2f,#123c70);color:#fff;border-radius:18px;padding:22px;box-shadow:0 16px 36px rgba(8,32,62,.14)}
            .akOpsSurfaceHead{display:flex;justify-content:space-between;gap:20px;align-items:flex-start;margin-bottom:18px}
            .akOpsSurfaceHead span{font-size:13px;font-weight:900;letter-spacing:1.4px;color:#8ec7ff}
            .akOpsSurfaceHead h2{margin:5px 0;font-size:25px;letter-spacing:-.4px}
            .akOpsSurfaceHead p{margin:0;color:#c9dbf2;font-size:15px;line-height:1.5;max-width:760px}
            .akOpsSurfaceHead button{border:0;border-radius:11px;background:#fff;color:#135fae;padding:13px 17px;font-size:15px;font-weight:900;white-space:nowrap;cursor:pointer}
            .akOpsSurfaceGrid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}
            .akOpsSurfaceCard{background:rgba(255,255,255,.09);border:1px solid rgba(255,255,255,.15);border-radius:13px;padding:14px;min-width:0}
            .akOpsSurfaceCard b{display:block;font-size:14px;color:#eaf4ff}.akOpsSurfaceCard strong{display:block;font-size:27px;margin:6px 0}.akOpsSurfaceCard small{font-size:12px;color:#c2d5eb}
            .akOpsSurfaceFeatures{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:9px;margin-top:10px}
            .akOpsSurfaceFeatures button{text-align:left;border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.055);color:#fff;border-radius:11px;padding:13px;min-height:82px;cursor:pointer}
            .akOpsSurfaceFeatures button:hover{background:rgba(255,255,255,.12)}
            .akOpsSurfaceFeatures b{display:block;font-size:14px;margin-bottom:5px}.akOpsSurfaceFeatures span{display:block;color:#c4d7ed;font-size:12px;line-height:1.45}
            @media(max-width:1100px){.akOpsSurfaceGrid,.akOpsSurfaceFeatures{grid-template-columns:repeat(2,minmax(0,1fr))}}
            @media(max-width:700px){.akOperationsSurface{padding:17px}.akOpsSurfaceHead{flex-direction:column}.akOpsSurfaceGrid,.akOpsSurfaceFeatures{grid-template-columns:1fr}.akOpsSurfaceHead h2{font-size:21px}.akOpsSurfaceHead p{font-size:14px}.akOpsSurfaceHead button{width:100%}}
          `}</style>
        </section>,
        mount,
      )}
      <OperationsHub />
    </>
  );
}
