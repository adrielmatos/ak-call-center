"use client";

import { createPortal } from "react-dom";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase";
import DeskcommParity from "./deskcomm-parity";

export default function OperationsSurface() {
  const pathname = usePathname();
  const [session, setSession] = useState<any>(null);
  const [stats, setStats] = useState({ leads: 0, queue: 0, opportunities: 0, returns: 0, calls: 0, npd: 0, campaigns: 0 });
  const [mount, setMount] = useState<HTMLElement | null>(null);

  useEffect(() => {
    if (!supabase) return;
    let alive = true;
    supabase.auth.getSession().then(({ data }) => { if (alive) setSession(data.session); });
    const { data } = supabase.auth.onAuthStateChange((_event, next) => { if (alive) setSession(next); });
    return () => { alive = false; data.subscription.unsubscribe(); };
  }, []);

  useEffect(() => {
    if (pathname !== "/" || !session) { setMount(null); return; }
    const content = document.querySelector<HTMLElement>("main.content");
    const header = content?.querySelector<HTMLElement>(":scope > .header");
    if (!content || !header) return;
    const host = document.createElement("div");
    host.className = "akOperationsSurfaceHost";
    host.setAttribute("data-ak-operations-surface", "true");
    header.insertAdjacentElement("afterend", host);
    setMount(host);
    return () => { host.remove(); setMount(null); };
  }, [pathname, session]);

  useEffect(() => {
    if (!session || pathname !== "/" || !supabase) return;
    let active = true;
    (async () => {
      const [l, r, c, n, campaigns] = await Promise.all([
        supabase.from("leads").select("id,status,bloqueado,opt_out,telefones(id)", { count: "exact" }).limit(1000),
        supabase.from("retornos").select("id", { count: "exact", head: true }).eq("concluido", false),
        supabase.from("ligacoes").select("id,resultado", { count: "exact" }),
        supabase.from("lista_nao_perturbe").select("id", { count: "exact", head: true }).eq("ativo", true),
        supabase.from("campanhas").select("id", { count: "exact", head: true }).neq("status", "removida"),
      ]);
      if (!active) return;
      const leads = l.data || [];
      const opportunities = (c.data || []).filter((x: any) => ["Interessado", "Simulação", "Proposta", "Contrato"].includes(x.resultado)).length;
      setStats({
        leads: l.count ?? leads.length,
        queue: leads.filter((x: any) => x.status === "disponivel" && !x.bloqueado && !x.opt_out && x.telefones?.length).length,
        opportunities,
        returns: r.count ?? 0,
        calls: c.count ?? 0,
        npd: n.count ?? 0,
        campaigns: campaigns.count ?? 0,
      });
    })();
    return () => { active = false; };
  }, [session, pathname]);

  if (!session || pathname !== "/" || !mount) return null;

  return createPortal(
    <section className="akOperations360" aria-label="Operação 360">
      <header className="akOperations360Head">
        <div>
          <span>OPERAÇÃO 360 • CENTRAL OPERACIONAL</span>
          <h2>Fila, CRM, Customer 360 e operação em um único painel</h2>
          <p>Todos os indicadores e ferramentas do dashboard ficam aqui, usando a mesma base, discadora e histórico do A&K.</p>
        </div>
        <div className="akOperations360Status">● ONLINE</div>
      </header>
      <div className="akOperations360Metrics">
        <div><span>◉ Leads na base</span><strong>{stats.leads}</strong><small>mailing carregado</small></div>
        <div><span>☎ Na fila</span><strong>{stats.queue}</strong><small>prontos para contato</small></div>
        <div><span>↗ Oportunidades</span><strong>{stats.opportunities}</strong><small>interesse ou proposta</small></div>
        <div><span>◷ Retornos</span><strong>{stats.returns}</strong><small>próximas ações</small></div>
        <div><span>⊘ Não Perturbe</span><strong>{stats.npd}</strong><small>bloqueios ativos</small></div>
        <div><span>▣ Campanhas</span><strong>{stats.campaigns}</strong><small>cadastradas</small></div>
        <div><span>▥ Ligações</span><strong>{stats.calls}</strong><small>histórico registrado</small></div>
      </div>
      <div className="akOperations360Workspace"><DeskcommParity /></div>
      <style jsx global>{`
        .akOperationsSurfaceHost{display:block;width:100%;margin:0 0 20px}

        /* O Dashboard agora tem uma única superfície operacional. O conteúdo legado continua
           no código para não quebrar seus módulos, mas não é renderizado em duplicidade na tela inicial. */
        main.content:has(.akOperations360) .metricGrid,
        main.content:has(.akOperations360) .dashboardGrid,
        main.content:has(.akOperations360) .crmSuiteHead,
        main.content:has(.akOperations360) .crmSuiteHead~*,
        main.content:has(.akOperations360) .panel:has(>.crmSuiteHead){display:none!important}

        .akOperations360{width:100%;box-sizing:border-box;border:1px solid #d7e3ef;border-radius:20px;background:#f7faff;overflow:hidden;box-shadow:0 18px 44px rgba(15,35,60,.10)}
        .akOperations360Head{display:flex;justify-content:space-between;align-items:flex-start;gap:20px;padding:24px 26px;background:linear-gradient(135deg,#061a30,#1260aa);color:#fff}
        .akOperations360Head span{font-size:12px;font-weight:900;letter-spacing:1.5px;color:#a9d6ff}
        .akOperations360Head h2{margin:6px 0 5px;font-size:25px;letter-spacing:-.45px;line-height:1.2}
        .akOperations360Head p{margin:0;color:#d7e8f8;font-size:15px;line-height:1.5;max-width:900px}
        .akOperations360Status{font-size:12px;font-weight:900;white-space:nowrap;padding:9px 12px;border-radius:999px;background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.18)}
        .akOperations360Metrics{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:9px;padding:14px 16px;background:#fff;border-bottom:1px solid #dfe8f1}
        .akOperations360Metrics>div{min-width:0;padding:12px 13px;border:1px solid #e1e9f2;border-radius:12px;background:#fff}
        .akOperations360Metrics span{display:block;font-size:12px;font-weight:800;color:#53657a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .akOperations360Metrics strong{display:block;font-size:25px;line-height:1.1;margin:5px 0 3px;color:#0d3158}
        .akOperations360Metrics small{display:block;font-size:11px;color:#718096;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .akOperations360Workspace{padding:0 14px 14px}
        .akOperations360Workspace .dkParity{margin-top:0;border:0;border-radius:0;background:transparent;box-shadow:none;overflow:visible}
        .akOperations360Workspace .dkParity>header{display:none}
        .akOperations360Workspace .dkParity nav{margin:0 -14px;padding:11px 14px;background:#fff;border-bottom:1px solid #dfe8f1;box-shadow:0 1px 0 rgba(15,23,42,.02)}
        .akOperations360Workspace .dkParity nav button{font-size:14px;padding:10px 14px}
        .akOperations360Workspace .dkBody{padding:16px 0}
        .akOperations360Workspace .dkMetric{padding:13px}
        .akOperations360Workspace .dkMetric span{font-size:12px}
        .akOperations360Workspace .dkMetric b{font-size:24px}
        .akOperations360Workspace .dkPanel{padding:15px}
        .akOperations360Workspace .dkPanel h3{font-size:16px}
        @media(max-width:1200px){.akOperations360Metrics{grid-template-columns:repeat(4,minmax(0,1fr))}}
        @media(max-width:760px){.akOperations360Head{padding:19px;flex-direction:column}.akOperations360Head h2{font-size:21px}.akOperations360Head p{font-size:14px}.akOperations360Metrics{grid-template-columns:repeat(2,minmax(0,1fr));padding:10px}.akOperations360Workspace{padding:0 10px 10px}}
      `}</style>
    </section>,
    mount,
  );
}
