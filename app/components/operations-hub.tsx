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

type TimelineItem = {
  id: string;
  _tipo: string;
  _at: string | null;
  _text: string;
};

const bankOf = (lead: Lead) => {
  const extra = lead.dados_extras || {};
  const imported = extra._importacao || {};
  const candidates = [
    imported.banco,
    extra.banco,
    extra.Banco,
    extra.bank,
    extra.BANK,
    extra.BANCO,
    extra["Banco Atual"],
  ];
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
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
};

const initials = (value = "") =>
  value
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((item) => item[0])
    .join("")
    .toUpperCase();

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

  useEffect(() => {
    if (!supabase) return;
    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (mounted) setSession(data.session);
    });

    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (mounted) setSession(nextSession);
    });

    return () => {
      mounted = false;
      data.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (session && open) loadHub();
  }, [session, open]);

  useEffect(() => {
    if (selected && open) loadTimeline(selected.id);
  }, [selected?.id, open]);

  async function loadHub() {
    if (!supabase) return;
    setLoading(true);
    setError("");

    try {
      const [leadResult, callResult] = await Promise.all([
        supabase
          .from("leads")
          .select(
            "id,nome,cpf,cidade,uf,produto,status,prioridade,bloqueado,opt_out,dados_extras,telefones(id,numero_normalizado)",
          )
          .order("prioridade", { ascending: false })
          .order("created_at", { ascending: false })
          .limit(1000),
        supabase
          .from("ligacoes")
          .select("id,lead_id,resultado,observacao,inicio,fim,created_at")
          .order("created_at", { ascending: false })
          .limit(1500),
      ]);

      if (leadResult.error) throw leadResult.error;
      if (callResult.error) throw callResult.error;

      setLeads((leadResult.data || []) as Lead[]);
      setCalls(callResult.data || []);
    } catch (caught: any) {
      setError(caught?.message || "Não foi possível carregar a central operacional.");
    } finally {
      setLoading(false);
    }
  }

  async function loadTimeline(leadId: string) {
    if (!supabase) return;

    const [callResult, returnResult, activityResult, proposalResult, taskResult] =
      await Promise.all([
        supabase
          .from("ligacoes")
          .select("id,resultado,observacao,inicio,fim,created_at,telefone_id")
          .eq("lead_id", leadId)
          .order("created_at", { ascending: false })
          .limit(50),
        supabase
          .from("retornos")
          .select("id,data_hora,observacao,concluido,created_at")
          .eq("lead_id", leadId)
          .order("data_hora", { ascending: true })
          .limit(30),
        supabase
          .from("crm_atividades")
          .select("id,tipo,titulo,descricao,data_hora,concluida,created_at")
          .eq("lead_id", leadId)
          .order("data_hora", { ascending: false })
          .limit(50),
        supabase
          .from("crm_propostas")
          .select("id,produto,valor,status,observacao,created_at,updated_at")
          .eq("lead_id", leadId)
          .order("created_at", { ascending: false })
          .limit(20),
        supabase
          .from("crm_tarefas")
          .select("id,titulo,descricao,prioridade,status,vencimento_at,created_at")
          .eq("lead_id", leadId)
          .order("created_at", { ascending: false })
          .limit(20),
      ]);

    const items: TimelineItem[] = [];

    for (const item of callResult.data || []) {
      items.push({
        id: String(item.id),
        _tipo: "Ligação",
        _at: item.created_at || item.inicio || null,
        _text: item.resultado || "Ligação registrada",
      });
    }

    for (const item of returnResult.data || []) {
      items.push({
        id: String(item.id),
        _tipo: "Retorno",
        _at: item.data_hora || item.created_at || null,
        _text: item.observacao || "Retorno agendado",
      });
    }

    for (const item of activityResult.data || []) {
      items.push({
        id: String(item.id),
        _tipo: item.tipo || "Atividade",
        _at: item.data_hora || item.created_at || null,
        _text: item.titulo || item.descricao || "Atividade registrada",
      });
    }

    for (const item of proposalResult.data || []) {
      const value =
        item.valor != null
          ? `R$ ${Number(item.valor).toLocaleString("pt-BR", {
              minimumFractionDigits: 2,
            })}`
          : "";
      items.push({
        id: String(item.id),
        _tipo: "Proposta",
        _at: item.created_at || item.updated_at || null,
        _text: [item.produto, item.status, value].filter(Boolean).join(" • "),
      });
    }

    for (const item of taskResult.data || []) {
      items.push({
        id: String(item.id),
        _tipo: "Tarefa",
        _at: item.vencimento_at || item.created_at || null,
        _text: item.titulo || item.descricao || "Tarefa",
      });
    }

    items.sort((left, right) => {
      const leftTime = left._at ? new Date(left._at).getTime() : 0;
      const rightTime = right._at ? new Date(right._at).getTime() : 0;
      return rightTime - leftTime;
    });

    setTimeline(items);
  }

  const banks = useMemo(
    () =>
      Array.from(
        new Set(leads.map(bankOf).filter((value) => value && value !== "Não informado")),
      ).sort(),
    [leads],
  );

  const products = useMemo(
    () =>
      Array.from(
        new Set(
          leads.map(productOf).filter((value) => value && value !== "Não informado"),
        ),
      ).sort(),
    [leads],
  );

  const queue = useMemo(
    () =>
      leads
        .filter(
          (lead) =>
            lead.status === "disponivel" &&
            !lead.bloqueado &&
            !lead.opt_out &&
            Boolean(lead.telefones?.length),
        )
        .filter((lead) => filterBank === "Todos" || bankOf(lead) === filterBank)
        .filter(
          (lead) => filterProduct === "Todos" || productOf(lead) === filterProduct,
        )
        .filter((lead) => {
          if (!query) return true;
          const haystack = `${lead.nome} ${lead.cpf || ""} ${bankOf(lead)} ${productOf(lead)}`;
          return haystack.toLowerCase().includes(query.toLowerCase());
        })
        .slice(0, 100),
    [leads, filterBank, filterProduct, query],
  );

  const report = useMemo(() => {
    const map: Record<
      string,
      { contatos: number; atendidas: number; interessados: number; propostas: number }
    > = {};

    for (const lead of leads) {
      const bank = bankOf(lead);
      if (!map[bank]) {
        map[bank] = { contatos: 0, atendidas: 0, interessados: 0, propostas: 0 };
      }
      map[bank].contatos += 1;
    }

    for (const call of calls) {
      const lead = leads.find((item) => item.id === call.lead_id);
      if (!lead) continue;

      const bank = bankOf(lead);
      if (!map[bank]) {
        map[bank] = { contatos: 0, atendidas: 0, interessados: 0, propostas: 0 };
      }

      const result = String(call.resultado || "").toLowerCase();
      if (!["não atendeu", "numero invalido", "número inválido"].includes(result)) {
        map[bank].atendidas += 1;
      }
      if (result.includes("interess")) map[bank].interessados += 1;
      if (result.includes("proposta")) map[bank].propostas += 1;
    }

    return Object.entries(map).sort((left, right) => right[1].contatos - left[1].contatos);
  }, [leads, calls]);

  const scripts: Record<string, string[]> = {
    INSS: [
      "Confirme o nome do cliente e se ele pode falar agora.",
      "Explique que você está entrando em contato para verificar uma possibilidade de crédito/benefício.",
      "Confirme o banco informado na base antes de prosseguir.",
      "Se houver interesse, registre a simulação e combine o próximo passo.",
    ],
    FGTS: [
      "Confirme identidade e disponibilidade para atendimento.",
      "Explique de forma objetiva a possibilidade relacionada ao FGTS.",
      "Confirme o banco e o produto antes de simular.",
      "Registre o resultado e, se necessário, agende retorno.",
    ],
    CLT: [
      "Confirme vínculo e disponibilidade para falar.",
      "Explique o produto de forma clara, sem prometer aprovação.",
      "Confirme banco e dados necessários para a simulação.",
      "Registre a próxima ação no CRM.",
    ],
    "BPC/LOAS": [
      "Confirme o nome e a disponibilidade do cliente.",
      "Explique o atendimento de forma objetiva e transparente.",
      "Confirme banco e produto da base.",
      "Registre interesse, retorno ou recusa imediatamente.",
    ],
    default: [
      "Cumprimente e confirme se é um bom momento para falar.",
      "Identifique a necessidade do cliente.",
      "Use banco e produto da ficha para contextualizar o atendimento.",
      "Finalize com uma próxima ação registrada no CRM.",
    ],
  };

  if (!session) return null;

  return (
    <>
      <button className="opsLauncher" onClick={() => setOpen(true)} aria-label="Abrir Operação 360">
        ◈ <span>Operação 360</span>
      </button>

      {open && (
        <div className="opsBackdrop" onClick={() => setOpen(false)}>
          <aside className="opsDrawer" onClick={(event) => event.stopPropagation()}>
            <header className="opsHeader">
              <div>
                <small>CENTRAL OPERACIONAL</small>
                <h2>Operação 360</h2>
                <p>Fila, cliente, histórico, scripts e indicadores.</p>
              </div>
              <button className="opsClose" onClick={() => setOpen(false)} aria-label="Fechar">
                ×
              </button>
            </header>

            <nav className="opsTabs">
              {(
                [
                  ["fila", "Fila inteligente"],
                  ["cliente", "Customer 360"],
                  ["scripts", "Script de ligação"],
                  ["relatorios", "Relatórios"],
                ] as [Tab, string][]
              ).map(([id, label]) => (
                <button key={id} className={tab === id ? "active" : ""} onClick={() => setTab(id)}>
                  {label}
                </button>
              ))}
            </nav>

            {error && <div className="opsError">{error}</div>}
            {loading && <div className="opsLoading">Atualizando dados operacionais…</div>}

            {tab === "fila" && (
              <section className="opsSection">
                <div className="opsFilters">
                  <select value={filterBank} onChange={(event) => setFilterBank(event.target.value)}>
                    <option>Todos</option>
                    {banks.map((bank) => (
                      <option key={bank}>{bank}</option>
                    ))}
                  </select>
                  <select value={filterProduct} onChange={(event) => setFilterProduct(event.target.value)}>
                    <option>Todos</option>
                    {products.map((product) => (
                      <option key={product}>{product}</option>
                    ))}
                  </select>
                  <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar cliente, banco…" />
                </div>
                <div className="opsQueueHead">
                  <b>{queue.length}</b>
                  <span>leads prontos para trabalho</span>
                </div>
                <div className="opsList">
                  {queue.map((lead) => (
                    <button
                      className="opsLead"
                      key={lead.id}
                      onClick={() => {
                        setSelected(lead);
                        setTab("cliente");
                      }}
                    >
                      <span className="opsAvatar">{initials(lead.nome)}</span>
                      <span className="opsLeadMain">
                        <b>{lead.nome}</b>
                        <small>{bankOf(lead)} • {productOf(lead)}</small>
                        <small>
                          {lead.telefones?.[0]?.numero_normalizado || "Sem telefone"}
                          {lead.cidade ? ` • ${lead.cidade}/${lead.uf || ""}` : ""}
                        </small>
                      </span>
                      <span className="opsPriority">P{lead.prioridade || 0}</span>
                    </button>
                  ))}
                </div>
              </section>
            )}

            {tab === "cliente" && (
              <section className="opsSection">
                {!selected ? (
                  <div className="opsEmpty">Selecione um cliente na Fila inteligente para abrir o Customer 360.</div>
                ) : (
                  <>
                    <div className="opsCustomer">
                      <span className="opsAvatar large">{initials(selected.nome)}</span>
                      <div>
                        <h3>{selected.nome}</h3>
                        <p>{bankOf(selected)} • {productOf(selected)}</p>
                        <p>
                          {selected.telefones?.[0]?.numero_normalizado || "Sem telefone"} • {selected.cidade || "Cidade não informada"}
                          {selected.uf ? `/${selected.uf}` : ""}
                        </p>
                      </div>
                    </div>
                    <div className="opsFacts">
                      <div><small>Status</small><b>{selected.status}</b></div>
                      <div><small>Prioridade</small><b>{selected.prioridade || 0}</b></div>
                      <div><small>CPF</small><b>{selected.cpf || "—"}</b></div>
                    </div>
                    <h4>Linha do tempo</h4>
                    <div className="opsTimeline">
                      {timeline.length ? (
                        timeline.map((item, index) => (
                          <div className="opsEvent" key={`${item._tipo}-${item.id}-${index}`}>
                            <span className="opsEventDot" />
                            <div>
                              <b>{item._tipo}</b>
                              <small>{formatDate(item._at)}</small>
                              <p>{item._text}</p>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="opsEmpty">Nenhum evento registrado para este cliente.</div>
                      )}
                    </div>
                  </>
                )}
              </section>
            )}

            {tab === "scripts" && (
              <section className="opsSection">
                <div className="scriptChooser">
                  {products.slice(0, 8).map((product) => (
                    <button key={product} onClick={() => setScriptProduct(product)}>{product}</button>
                  ))}
                </div>
                <div className="scriptCard">
                  <small>ROTEIRO OPERACIONAL</small>
                  <h3>{scriptProduct}</h3>
                  <ol>
                    {(scripts[scriptProduct] || scripts.default).map((text, index) => (
                      <li key={index}>{text}</li>
                    ))}
                  </ol>
                  <div className="scriptContext">
                    <b>Banco da ficha:</b> {selected ? bankOf(selected) : "Selecione um cliente na fila"}
                  </div>
                </div>
              </section>
            )}

            {tab === "relatorios" && (
              <section className="opsSection">
                <div className="opsStats">
                  <div><small>Leads</small><b>{leads.length}</b></div>
                  <div><small>Ligações</small><b>{calls.length}</b></div>
                  <div><small>Na fila</small><b>{queue.length}</b></div>
                  <div><small>Interessados</small><b>{leads.filter((lead) => ["interessado", "simulação", "proposta", "contrato"].includes(lead.status)).length}</b></div>
                </div>
                <h4>Desempenho por banco</h4>
                <div className="opsTable">
                  {report.map(([bank, values]) => (
                    <div className="opsReport" key={bank}>
                      <b>{bank}</b>
                      <span>{values.contatos} contatos</span>
                      <span>{values.atendidas} atendidas</span>
                      <span>{values.interessados} interessados</span>
                      <span>{values.propostas} propostas</span>
                    </div>
                  ))}
                  {!report.length && <div className="opsEmpty">Ainda não há dados suficientes para o relatório.</div>}
                </div>
              </section>
            )}
          </aside>
        </div>
      )}
    </>
  );
}
