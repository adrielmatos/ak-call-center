"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type Lead = {
  id: string;
  nome: string;
  cpf?: string;
  cidade?: string;
  uf?: string;
  produto?: string;
  status: string;
  prioridade: number;
  bloqueado: boolean;
  opt_out: boolean;
  dados_extras?: Record<string, any>;
  telefones?: { id: string; numero_normalizado: string }[];
};
type Tab = "fila" | "cliente" | "scripts" | "relatorios";
type TimelineItem = { id: string; _tipo: string; _at: string | null; _text: string };

const bankOf = (lead: Lead) => {
  const extra = lead.dados_extras || {};
  const imported = extra._importacao || {};
  const candidates = [imported.banco, extra.banco, extra.Banco, extra.bank, extra.BANK, extra.BANCO, extra["Banco Atual"]];
  const value = candidates.find((item: any) => String(item ?? "").trim());
  if (value) return String(value).trim();
  const product = String(lead.produto ?? "");
  const match = product.match(/Banco:\s*([^•|]+)$/i);
  return match?.[1]?.trim() || "Não informado";
};

const productOf = (lead: Lead) => {
  const importedProduct = lead.dados_extras?._importacao?.produto_original;
  const product = String(importedProduct || lead.produto || "");
  return product.replace(/\s*•\s*Banco:\s*.+$/i, "").trim() || "Não informado";
};

const formatDate = (value: any) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(date);
};

const initials = (value = "") => value.split(" ").filter(Boolean).slice(0, 2).map((item) => item[0]).join("").toUpperCase();

const PRODUCT_SCRIPTS: Record<string, string> = {
  "SIAPE": `ABERTURA\n"Oi, tudo bem? Falo com [NOME]? Aqui é [SEU NOME], da A&K Soluções Financeiras. Prometo ser rápido. Eu trabalho com atendimento de crédito para servidor federal do SIAPE. Posso te explicar o motivo da ligação?"\n\nMOTIVO\n"Estou entrando em contato para verificar se existe alguma condição de crédito, redução de parcela ou outra opção disponível para o seu perfil. A consulta é uma simulação e não garante aprovação. Se fizer sentido, eu verifico as opções e te explico antes de qualquer contratação."\n\nQUALIFICAÇÃO\n"Hoje você já possui algum consignado ou cartão consignado? E está procurando reduzir parcela, liberar um valor ou apenas conhecer as condições?"\n\nSE HOUVER INTERESSE\n"Perfeito. Vou conferir as condições disponíveis. Se houver uma opção, eu te informo valor, parcela, prazo e instituição antes de você decidir."\n\nOBJEÇÃO — JÁ TENHO CONSIGNADO\n"Sem problema. Podemos verificar se existe alguma alternativa, como refinanciamento ou portabilidade, quando disponível para o seu perfil. Primeiro eu faço a análise e você decide se vale a pena."\n\nFECHAMENTO\n"Posso fazer a simulação e te enviar as condições pelo WhatsApp para você analisar com calma?"`,
  "INSS": `ABERTURA\n"Oi, tudo bem? Falo com [NOME]? Aqui é [SEU NOME], da A&K Soluções Financeiras. Posso falar com você por um minutinho?"\n\nMOTIVO\n"Eu trabalho com atendimento de crédito para aposentados e pensionistas do INSS. Estou entrando em contato para verificar se existe alguma opção disponível para o seu perfil, como novo crédito, refinanciamento ou portabilidade, quando elegível."\n\nQUALIFICAÇÃO\n"Você já possui algum consignado hoje ou está procurando uma opção nova? O que seria mais interessante para você: reduzir parcela ou verificar possibilidade de receber um valor?"\n\nINTERESSE\n"Entendi. Vou verificar as condições disponíveis. A simulação mostra valor, parcela e prazo; a contratação depende da análise e das regras da instituição."\n\nFECHAMENTO\n"Se você quiser, posso te enviar a simulação pelo WhatsApp para conferir tudo com calma antes de tomar qualquer decisão."`,
  "BPC/LOAS": `ABERTURA\n"Oi, tudo bem? Falo com [NOME]? Aqui é [SEU NOME], da A&K Soluções Financeiras. Posso explicar rapidamente o motivo da ligação?"\n\nMOTIVO\n"Nós fazemos atendimento de soluções de crédito e quero verificar se existe alguma opção compatível com o seu benefício e com as regras atuais. Primeiro fazemos a análise; não é promessa de aprovação."\n\nQUALIFICAÇÃO\n"Você já possui algum contrato ou cartão relacionado ao benefício? Está procurando um valor novo, reduzir parcela ou apenas consultar as possibilidades?"\n\nFECHAMENTO\n"Se houver uma opção adequada, eu te apresento as condições completas para você avaliar sem compromisso."`,
  "FGTS": `ABERTURA\n"Oi, [NOME], tudo bem? Aqui é [SEU NOME], da A&K Soluções Financeiras. Posso falar rapidinho sobre uma possibilidade relacionada ao seu FGTS?"\n\nMOTIVO\n"Quero verificar se existe uma opção disponível para antecipação do saque-aniversário do FGTS, conforme as regras e a análise da instituição. Primeiro fazemos a simulação para você conhecer as condições."\n\nQUALIFICAÇÃO\n"Você utiliza o saque-aniversário e já fez alguma antecipação anteriormente?"\n\nFECHAMENTO\n"Posso verificar as condições e te enviar valor, taxas e demais informações para você analisar antes de contratar?"`,
  "CLT": `ABERTURA\n"Oi, [NOME], tudo bem? Aqui é [SEU NOME], da A&K Soluções Financeiras. Posso falar um minutinho?"\n\nMOTIVO\n"Faço atendimento de soluções de crédito para trabalhadores do setor privado. Quero verificar se existe alguma opção disponível para o seu perfil, conforme as regras da modalidade e da instituição."\n\nQUALIFICAÇÃO\n"Você está trabalhando atualmente com carteira assinada? Está procurando um valor novo, organizar parcelas ou apenas conhecer as condições?"\n\nFECHAMENTO\n"Se quiser, faço uma simulação e te mostro valor, parcela, prazo e condições antes de qualquer contratação."`,
  "Consignado Público": `ABERTURA\n"Oi, [NOME], tudo bem? Aqui é [SEU NOME], da A&K Soluções Financeiras. Eu trabalho com atendimento de crédito consignado para servidores públicos. Posso explicar rapidinho?"\n\nMOTIVO\n"Quero verificar se há alguma condição disponível para o seu vínculo, como novo crédito, refinanciamento, portabilidade ou cartão, quando elegível."\n\nFECHAMENTO\n"Faço a análise e te apresento as condições completas. Você decide depois de conferir tudo."`,
  "Consignado Privado": `ABERTURA\n"Oi, [NOME], tudo bem? Aqui é [SEU NOME], da A&K Soluções Financeiras. Posso falar um minutinho?"\n\nMOTIVO\n"Atendemos crédito consignado para trabalhadores de empresas privadas, sujeito às regras do convênio e da instituição. Quero verificar se existe alguma condição para o seu perfil."\n\nQUALIFICAÇÃO\n"Você trabalha atualmente com carteira assinada? Está buscando crédito novo ou alguma alternativa para uma parcela que já possui?"\n\nFECHAMENTO\n"Posso consultar as possibilidades e te passar as condições antes de qualquer decisão?"`,
  "Crédito Pessoal": `ABERTURA\n"Oi, [NOME], tudo bem? Aqui é [SEU NOME], da A&K Soluções Financeiras. Posso te explicar rapidamente o motivo da ligação?"\n\nMOTIVO\n"Trabalhamos com opções de crédito pessoal sujeitas à análise da instituição. Quero entender o que você precisa e verificar se existe alguma condição compatível."\n\nQUALIFICAÇÃO\n"Você está buscando um valor específico ou quer comparar opções de parcela e prazo?"\n\nFECHAMENTO\n"Posso fazer uma simulação e te mostrar as condições para você comparar com calma?"`,
  "Cartão Consignado": `ABERTURA\n"Oi, [NOME], tudo bem? Aqui é [SEU NOME], da A&K Soluções Financeiras. Posso falar rapidinho sobre uma opção de cartão consignado?"\n\nMOTIVO\n"Quero verificar se você é elegível a uma opção de cartão consignado e explicar como funcionam limite, desconto e demais condições antes de qualquer contratação."\n\nFECHAMENTO\n"Se houver uma opção disponível, eu te explico todos os custos e condições para você avaliar."`,
  "Cartão Benefício": `ABERTURA\n"Oi, [NOME], tudo bem? Aqui é [SEU NOME], da A&K Soluções Financeiras. Posso explicar uma opção de cartão benefício?"\n\nMOTIVO\n"Quero verificar se existe uma opção disponível para o seu perfil e explicar como funciona, incluindo as condições, descontos e custos aplicáveis."\n\nFECHAMENTO\n"Posso consultar a elegibilidade e te apresentar as condições antes de você decidir?"`,
  "Seguros": `ABERTURA\n"Oi, [NOME], tudo bem? Aqui é [SEU NOME], da A&K Soluções Financeiras. Posso falar um minutinho?"\n\nMOTIVO\n"Também trabalhamos com opções de proteção, como assistência médica, residencial e funeral. Quero entender se alguma dessas soluções faz sentido para você."\n\nFECHAMENTO\n"Se tiver interesse, eu te apresento cobertura, preço e condições para você comparar antes de contratar."`,
  "Energia Solar": `ABERTURA\n"Oi, [NOME], tudo bem? Aqui é [SEU NOME], da A&K Soluções Financeiras. Posso te explicar uma alternativa para reduzir o custo da energia?"\n\nMOTIVO\n"Trabalhamos com uma solução de energia por assinatura/parceria que pode reduzir a conta sem a instalação de placas no imóvel, conforme disponibilidade e regras da oferta."\n\nFECHAMENTO\n"Posso verificar se existe disponibilidade para sua conta e te explicar a economia e as condições antes de você decidir?"`,
  "Abertura de conta Santander": `ABERTURA\n"Oi, [NOME], tudo bem? Aqui é [SEU NOME], da A&K Soluções Financeiras. Posso falar rapidinho?"\n\nMOTIVO\n"Nós também fazemos indicação para abertura de conta Santander. Quero entender se você teria interesse em conhecer as condições e benefícios da conta."\n\nFECHAMENTO\n"Se tiver interesse, eu te explico o processo e os benefícios informados pela instituição, sem compromisso."`,
  "Atendimento": `ABERTURA\n"Oi, [NOME], tudo bem? Aqui é [SEU NOME], da A&K Soluções Financeiras. Posso falar um minutinho?"\n\nMOTIVO\n"Estou entrando em contato para entender se existe alguma solução financeira que faça sentido para você. Eu faço algumas perguntas rápidas e, se houver uma opção, te explico as condições."\n\nFECHAMENTO\n"Se fizer sentido, seguimos com a simulação. Se não fizer, sem problema."`,
};

const SCRIPT_STORAGE_KEY = "ak-call-center:scripts:v1";

export default function OperationsHub() {
  const [session, setSession] = useState<any>(null);
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("fila");
  const [leads, setLeads] = useState<Lead[]>([]);
  const [calls, setCalls] = useState<any[]>([]);
  const [selected, setSelected] = useState<Lead | null>(null);
  const [timeline, setTimeline] = useState<TimelineItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [filterBank, setFilterBank] = useState("Todos");
  const [filterProduct, setFilterProduct] = useState("Todos");
  const [query, setQuery] = useState("");
  const [scriptProduct, setScriptProduct] = useState("Atendimento");
  const [scriptText, setScriptText] = useState(PRODUCT_SCRIPTS.Atendimento);
  const [savedScripts, setSavedScripts] = useState<Record<string, string>>({});
  const [scriptSaved, setScriptSaved] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(SCRIPT_STORAGE_KEY);
      if (raw) setSavedScripts(JSON.parse(raw));
    } catch {}
  }, []);

  useEffect(() => {
    const custom = savedScripts[scriptProduct];
    setScriptText(custom ?? PRODUCT_SCRIPTS[scriptProduct] ?? PRODUCT_SCRIPTS.Atendimento);
    setScriptSaved(false);
  }, [scriptProduct, savedScripts]);

  useEffect(() => {
    if (!supabase) return;
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => { if (mounted) setSession(data.session); });
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => { if (mounted) setSession(nextSession); });
    return () => { mounted = false; data.subscription.unsubscribe(); };
  }, []);

  useEffect(() => { if (session && open) loadHub(); }, [session, open]);
  useEffect(() => { if (selected && open) loadTimeline(selected.id); }, [selected?.id, open]);

  async function loadHub() {
    if (!supabase) return;
    setLoading(true); setError("");
    try {
      const [leadResult, callResult] = await Promise.all([
        supabase.from("leads").select("id,nome,cpf,cidade,uf,produto,status,prioridade,bloqueado,opt_out,dados_extras,telefones(id,numero_normalizado)").order("prioridade", { ascending: false }).order("created_at", { ascending: false }).limit(1000),
        supabase.from("ligacoes").select("id,lead_id,resultado,observacao,inicio,fim,created_at").order("created_at", { ascending: false }).limit(1500),
      ]);
      if (leadResult.error) throw leadResult.error;
      if (callResult.error) throw callResult.error;
      setLeads((leadResult.data || []) as Lead[]); setCalls(callResult.data || []);
    } catch (caught: any) { setError(caught?.message || "Não foi possível carregar a central operacional."); }
    finally { setLoading(false); }
  }

  async function loadTimeline(leadId: string) {
    if (!supabase) return;
    const [callResult, returnResult, activityResult, proposalResult, taskResult] = await Promise.all([
      supabase.from("ligacoes").select("id,resultado,observacao,inicio,fim,created_at,telefone_id").eq("lead_id", leadId).order("created_at", { ascending: false }).limit(50),
      supabase.from("retornos").select("id,data_hora,observacao,concluido,created_at").eq("lead_id", leadId).order("data_hora", { ascending: true }).limit(30),
      supabase.from("crm_atividades").select("id,tipo,titulo,descricao,data_hora,concluida,created_at").eq("lead_id", leadId).order("data_hora", { ascending: false }).limit(50),
      supabase.from("crm_propostas").select("id,produto,valor,status,observacao,created_at,updated_at").eq("lead_id", leadId).order("created_at", { ascending: false }).limit(20),
      supabase.from("crm_tarefas").select("id,titulo,descricao,prioridade,status,vencimento_at,created_at").eq("lead_id", leadId).order("created_at", { ascending: false }).limit(20),
    ]);
    const items: TimelineItem[] = [];
    for (const item of callResult.data || []) items.push({ id: String(item.id), _tipo: "Ligação", _at: item.created_at || item.inicio || null, _text: item.resultado || "Ligação registrada" });
    for (const item of returnResult.data || []) items.push({ id: String(item.id), _tipo: "Retorno", _at: item.data_hora || item.created_at || null, _text: item.observacao || "Retorno agendado" });
    for (const item of activityResult.data || []) items.push({ id: String(item.id), _tipo: item.tipo || "Atividade", _at: item.data_hora || item.created_at || null, _text: item.titulo || item.descricao || "Atividade registrada" });
    for (const item of proposalResult.data || []) {
      const value = item.valor != null ? `R$ ${Number(item.valor).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : "";
      items.push({ id: String(item.id), _tipo: "Proposta", _at: item.created_at || item.updated_at || null, _text: [item.produto, item.status, value].filter(Boolean).join(" • ") });
    }
    for (const item of taskResult.data || []) items.push({ id: String(item.id), _tipo: "Tarefa", _at: item.vencimento_at || item.created_at || null, _text: item.titulo || item.descricao || "Tarefa" });
    items.sort((left, right) => (right._at ? new Date(right._at).getTime() : 0) - (left._at ? new Date(left._at).getTime() : 0));
    setTimeline(items);
  }

  const banks = useMemo(() => Array.from(new Set(leads.map(bankOf).filter((value) => value && value !== "Não informado"))).sort(), [leads]);
  const products = useMemo(() => Array.from(new Set(leads.map(productOf).filter((value) => value && value !== "Não informado"))).sort(), [leads]);
  const scriptProducts = useMemo(() => Array.from(new Set([...Object.keys(PRODUCT_SCRIPTS).filter((p) => p !== "Atendimento"), ...products, "Atendimento"])), [products]);
  const queue = useMemo(() => leads.filter((lead) => lead.status === "disponivel" && !lead.bloqueado && !lead.opt_out && Boolean(lead.telefones?.length)).filter((lead) => filterBank === "Todos" || bankOf(lead) === filterBank).filter((lead) => filterProduct === "Todos" || productOf(lead) === filterProduct).filter((lead) => !query || `${lead.nome} ${lead.cpf || ""} ${bankOf(lead)} ${productOf(lead)}`.toLowerCase().includes(query.toLowerCase())).slice(0, 100), [leads, filterBank, filterProduct, query]);

  const report = useMemo(() => {
    const map: Record<string, { contatos: number; atendidas: number; interessados: number; propostas: number }> = {};
    for (const lead of leads) { const bank = bankOf(lead); if (!map[bank]) map[bank] = { contatos: 0, atendidas: 0, interessados: 0, propostas: 0 }; map[bank].contatos += 1; }
    for (const call of calls) {
      const lead = leads.find((item) => item.id === call.lead_id); if (!lead) continue;
      const bank = bankOf(lead); if (!map[bank]) map[bank] = { contatos: 0, atendidas: 0, interessados: 0, propostas: 0 };
      const result = String(call.resultado || "").toLowerCase();
      if (!["não atendeu", "numero invalido", "número inválido"].includes(result)) map[bank].atendidas += 1;
      if (result.includes("interess")) map[bank].interessados += 1;
      if (result.includes("proposta")) map[bank].propostas += 1;
    }
    return Object.entries(map).sort((left, right) => right[1].contatos - left[1].contatos);
  }, [leads, calls]);

  function saveScript() {
    try {
      const next = { ...savedScripts, [scriptProduct]: scriptText };
      window.localStorage.setItem(SCRIPT_STORAGE_KEY, JSON.stringify(next));
      setSavedScripts(next); setScriptSaved(true);
    } catch { setError("Não foi possível salvar o script neste navegador."); }
  }

  function resetScript() {
    const base = PRODUCT_SCRIPTS[scriptProduct] ?? PRODUCT_SCRIPTS.Atendimento;
    const next = { ...savedScripts }; delete next[scriptProduct];
    try { window.localStorage.setItem(SCRIPT_STORAGE_KEY, JSON.stringify(next)); } catch {}
    setSavedScripts(next); setScriptText(base); setScriptSaved(false);
  }

  if (!session) return null;

  return (
    <>
      <button className="opsLauncher" onClick={() => setOpen(true)} aria-label="Abrir Operação 360">◈ <span>Operação 360</span></button>
      {open && (
        <div className="opsBackdrop" onClick={() => setOpen(false)}>
          <aside className="opsDrawer" onClick={(event) => event.stopPropagation()}>
            <header className="opsHeader"><div><small>CENTRAL OPERACIONAL</small><h2>Operação 360</h2><p>Fila, cliente, histórico, scripts e indicadores.</p></div><button className="opsClose" onClick={() => setOpen(false)} aria-label="Fechar">×</button></header>
            <nav className="opsTabs">{([ ["fila", "Fila inteligente"], ["cliente", "Customer 360"], ["scripts", "Script de ligação"], ["relatorios", "Relatórios"] ] as [Tab, string][]).map(([id, label]) => <button key={id} className={tab === id ? "active" : ""} onClick={() => setTab(id)}>{label}</button>)}</nav>
            {error && <div className="opsError">{error}</div>}{loading && <div className="opsLoading">Atualizando dados operacionais…</div>}
            {tab === "fila" && <section className="opsSection"><div className="opsFilters"><select value={filterBank} onChange={(event) => setFilterBank(event.target.value)}><option>Todos</option>{banks.map((bank) => <option key={bank}>{bank}</option>)}</select><select value={filterProduct} onChange={(event) => setFilterProduct(event.target.value)}><option>Todos</option>{products.map((product) => <option key={product}>{product}</option>)}</select><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar cliente, banco…" /></div><div className="opsQueueHead"><b>{queue.length}</b><span>leads prontos para trabalho</span></div><div className="opsList">{queue.map((lead) => <button className="opsLead" key={lead.id} onClick={() => { setSelected(lead); setTab("cliente"); }}><span className="opsAvatar">{initials(lead.nome)}</span><span className="opsLeadMain"><b>{lead.nome}</b><small>{bankOf(lead)} • {productOf(lead)}</small><small>{lead.telefones?.[0]?.numero_normalizado || "Sem telefone"}{lead.cidade ? ` • ${lead.cidade}/${lead.uf || ""}` : ""}</small></span><span className="opsPriority">P{lead.prioridade || 0}</span></button>)}</div></section>}
            {tab === "cliente" && <section className="opsSection">{!selected ? <div className="opsEmpty">Selecione um cliente na Fila inteligente para abrir o Customer 360.</div> : <><div className="opsCustomer"><span className="opsAvatar large">{initials(selected.nome)}</span><div><h3>{selected.nome}</h3><p>{bankOf(selected)} • {productOf(selected)}</p><p>{selected.telefones?.[0]?.numero_normalizado || "Sem telefone"} • {selected.cidade || "Cidade não informada"}{selected.uf ? `/${selected.uf}` : ""}</p></div></div><div className="opsFacts"><div><small>Status</small><b>{selected.status}</b></div><div><small>Prioridade</small><b>{selected.prioridade || 0}</b></div><div><small>CPF</small><b>{selected.cpf || "—"}</b></div></div><h4>Linha do tempo</h4><div className="opsTimeline">{timeline.length ? timeline.map((item, index) => <div className="opsEvent" key={`${item._tipo}-${item.id}-${index}`}><span className="opsEventDot" /><div><b>{item._tipo}</b><small>{formatDate(item._at)}</small><p>{item._text}</p></div></div>) : <div className="opsEmpty">Nenhum evento registrado para este cliente.</div>}</div></>}</section>}
            {tab === "scripts" && <section className="opsSection"><div className="scriptChooser">{scriptProducts.map((product) => <button key={product} className={scriptProduct === product ? "active" : ""} onClick={() => setScriptProduct(product)}>{product}</button>)}</div><div className="scriptCard"><small>ROTEIRO OPERACIONAL • EDITÁVEL</small><h3>{scriptProduct}</h3><p className="scriptHelp">Personalize o texto para sua operação. O conteúdo fica salvo por produto neste navegador.</p><textarea value={scriptText} onChange={(event) => { setScriptText(event.target.value); setScriptSaved(false); }} rows={22} aria-label={`Script de ${scriptProduct}`} /><div className="scriptActions"><button onClick={saveScript}>Salvar script</button><button onClick={resetScript}>Restaurar padrão</button>{scriptSaved && <span>✓ Salvo</span>}</div><div className="scriptContext"><b>Banco da ficha:</b> {selected ? bankOf(selected) : "Selecione um cliente na fila"}<br/><small>Use apenas informações confirmadas. Não prometa aprovação, taxa, valor ou economia sem confirmação da instituição.</small></div></div></section>}
            {tab === "relatorios" && <section className="opsSection"><div className="opsStats"><div><small>Leads</small><b>{leads.length}</b></div><div><small>Ligações</small><b>{calls.length}</b></div><div><small>Na fila</small><b>{queue.length}</b></div><div><small>Interessados</small><b>{leads.filter((lead) => ["interessado", "simulação", "proposta", "contrato"].includes(lead.status)).length}</b></div></div><h4>Desempenho por banco</h4><div className="opsTable">{report.map(([bank, values]) => <div className="opsReport" key={bank}><b>{bank}</b><span>{values.contatos} contatos</span><span>{values.atendidas} atendidas</span><span>{values.interessados} interessados</span><span>{values.propostas} propostas</span></div>)}{!report.length && <div className="opsEmpty">Ainda não há dados suficientes para o relatório.</div>}</div></section>}
          </aside>
        </div>
      )}
    </>
  );
}
