"use client";
export const dynamic = "force-dynamic";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { parseFile, phone, cpf } from "@/lib/importer";

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
  telefones?: { id: string; numero_normalizado: string }[];
};
type Stage = { id: string; nome: string; cor: string; ordem: number };
type Campaign = {
  id: string;
  nome: string;
  produto?: string;
  status: string;
  created_at: string;
  inicio_at?: string;
  fim_at?: string;
};
type ReturnRow = {
  id: string;
  lead_id: string;
  operador_id?: string;
  data_hora: string;
  observacao?: string;
  concluido: boolean;
  lead?: any;
};
type UserRow = {
  id: string;
  nome: string;
  email?: string;
  perfil: string;
  ativo: boolean;
  auth_user_id?: string;
  permissoes?: Record<string, boolean>;
  preferencias?: Record<string, any>;
};

const APP_VERSION = "2.1.0";
const results = [
  "Interessado",
  "Retorno",
  "Simulação",
  "Proposta",
  "Contrato",
  "Não atendeu",
  "Não interessado",
  "Número inválido",
  "Sem perfil",
];

const mask = (v = "") => v.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
const initials = (v = "") =>
  v
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((x) => x[0])
    .join("")
    .toUpperCase();

const whatsappHref = (value: any) => {
  const d = String(value ?? "").replace(/\D/g, "");
  const n =
    d.startsWith("55") && (d.length === 12 || d.length === 13)
      ? d
      : d.length === 10 || d.length === 11
      ? "55" + d
      : d;
  return n.length >= 12 && n.length <= 13 ? "https://wa.me/" + n : "";
};

export default function Home() {
  const [session, setSession] = useState<any>(null);
  const [operator, setOperator] = useState<any>(null);
  const [mode, setMode] = useState("dashboard");
  const [leads, setLeads] = useState<Lead[]>([]);
  const [npd, setNpd] = useState<any[]>([]);
  const [stages, setStages] = useState<Stage[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [returns, setReturns] = useState<ReturnRow[]>([]);
  const [calls, setCalls] = useState<any[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showImport, setShowImport] = useState(false);
  const [previews, setPreviews] = useState<any[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const [msg, setMsg] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [recovery, setRecovery] = useState(false);
  const [channelConfig, setChannelConfig] = useState<any>(null);
  const [dialerConfig, setDialerConfig] = useState<any>(null);
  const [bootTimeout, setBootTimeout] = useState(false);

  const pageSize = 50;
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 250);
    return () => clearTimeout(t);
  }, [search]);

  const filtered = useMemo(
    () =>
      leads.filter((l) =>
        [l.nome, l.cpf, l.cidade, l.uf, l.produto, l.status]
          .join(" ")
          .toLowerCase()
          .includes(debouncedSearch.toLowerCase())
      ),
    [leads, debouncedSearch]
  );
  const paged = filtered.slice((page - 1) * pageSize, page * pageSize);
  const available = useMemo(
    () =>
      leads.filter(
        (l) => l.status === "disponivel" && !l.bloqueado && !l.opt_out && l.telefones?.length
      ),
    [leads]
  );
  const current = available[0];

  useEffect(() => {
    if (!supabase) {
      setError(
        "Conexão com o banco não foi carregada. Verifique as variáveis NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY na Vercel."
      );
      setAuthReady(true);
      return;
    }

    let alive = true;

    // Timeout de segurança para destravar a tela caso a conexão trave
    const timer = setTimeout(() => {
      if (alive && !authReady) {
        setBootTimeout(true);
        setAuthReady(true);
      }
    }, 4000);

    supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (!alive) return;
        clearTimeout(timer);
        if (error) setError(error.message);
        setSession(data.session);
        setAuthReady(true);
      })
      .catch((err) => {
        if (!alive) return;
        clearTimeout(timer);
        setError("Falha ao inicializar o serviço de autenticação.");
        setAuthReady(true);
      });

    const { data } = supabase.auth.onAuthStateChange((event, s) => {
      if (event === "PASSWORD_RECOVERY") setRecovery(true);
      if (event === "SIGNED_OUT") setSession(null);
      else if (s) setSession(s);
    });

    return () => {
      alive = false;
      clearTimeout(timer);
      data?.subscription?.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (session) loadOperator();
  }, [session]);

  useEffect(() => setPage(1), [search]);

  useEffect(() => {
    if (session) load(mode);
  }, [mode, session]);

  async function load(targetMode = mode) {
    if (!supabase) return;
    setLoading(true);
    setError("");
    try {
      const leadSelect =
        "id,nome,cpf,cidade,uf,produto,status,prioridade,bloqueado,opt_out,created_at,updated_at,telefones(id,numero_normalizado)";
      const jobs: any[] = [];
      if (
        ["dashboard", "discador", "crm", "leads", "retornos", "resultados", "relatorios"].includes(
          targetMode
        )
      )
        jobs.push(
          supabase
            .from("leads")
            .select(leadSelect)
            .order("prioridade", { ascending: false })
            .order("created_at", { ascending: false })
            .limit(1000)
            .then((x) => ["leads", x])
        );
      if (["dashboard", "npd"].includes(targetMode))
        jobs.push(
          supabase
            .from("lista_nao_perturbe")
            .select("id,cpf,telefone,nome,origem,motivo,ativo,data_bloqueio")
            .eq("ativo", true)
            .order("data_bloqueio", { ascending: false })
            .limit(500)
            .then((x) => ["npd", x])
        );
      if (["dashboard", "crm", "resultados", "leads"].includes(targetMode))
        jobs.push(
          supabase
            .from("crm_etapas")
            .select("id,nome,cor,ordem")
            .eq("ativo", true)
            .order("ordem")
            .then((x) => ["stages", x])
        );
      if (["dashboard", "campanhas"].includes(targetMode))
        jobs.push(
          supabase
            .from("campanhas")
            .select("id,nome,produto,status,created_at,inicio_at,fim_at")
            .neq("status", "removida")
            .order("created_at", { ascending: false })
            .limit(100)
            .then((x) => ["campaigns", x])
        );
      if (["dashboard", "retornos", "crm"].includes(targetMode))
        jobs.push(
          supabase
            .from("retornos")
            .select(
              "id,lead_id,operador_id,data_hora,observacao,concluido,leads(id,nome,cpf,cidade,uf,produto,telefones(id,numero_normalizado))"
            )
            .eq("concluido", false)
            .order("data_hora", { ascending: true })
            .limit(500)
            .then((x) => ["returns", x])
        );
      if (["dashboard", "resultados", "relatorios"].includes(targetMode))
        jobs.push(
          supabase
            .from("ligacoes")
            .select(
              "id,lead_id,operador_id,telefone_id,inicio,fim,resultado,observacao,created_at,leads(id,nome,cpf)"
            )
            .order("created_at", { ascending: false })
            .limit(1000)
            .then((x) => ["calls", x])
        );

      const resultsData = await Promise.all(jobs);
      let loadedLeads: Lead[] = [];
      for (const [key, res] of resultsData) {
        if (res.error) {
          setError(res.error.message);
          continue;
        }
        if (key === "leads") {
          loadedLeads = (res.data || []) as Lead[];
          setLeads(loadedLeads);
        }
        if (key === "npd") setNpd(res.data || []);
        if (key === "stages") setStages(res.data || []);
        if (key === "campaigns") setCampaigns((res.data || []) as Campaign[]);
        if (key === "returns")
          setReturns(
            (res.data || []).map((r: any) => ({
              ...r,
              lead: r.lead || loadedLeads.find((l: Lead) => l.id === r.lead_id) || null,
            })) as ReturnRow[]
          );
        if (key === "calls") setCalls(res.data || []);
      }
    } catch (e: any) {
      setError("Não foi possível atualizar os dados.");
    } finally {
      setLoading(false);
    }
  }

  async function loadOperator() {
    if (!supabase || !session?.user?.id) return;
    const { data, error } = await supabase
      .from("operadores")
      .select("*")
      .eq("auth_user_id", session.user.id)
      .maybeSingle();
    if (error) {
      setError(error.message);
      return;
    }
    setOperator(data);
    if (!data) return;
    const [cc, dc] = await Promise.all([
      supabase.from("configuracoes_canais").select("*").eq("operador_id", data.id).maybeSingle(),
      supabase.from("configuracoes_discador").select("*").eq("operador_id", data.id).maybeSingle(),
    ]);
    if (cc.error) setError(cc.error.message);
    else setChannelConfig(cc.data);
    if (dc.error) setError(dc.error.message);
    else setDialerConfig(dc.data);
    if (data.perfil === "admin") {
      const { data: all, error: ue } = await supabase
        .from("operadores")
        .select("*")
        .order("created_at", { ascending: true });
      if (ue) setError(ue.message);
      else setUsers((all || []) as UserRow[]);
    } else setUsers([data as UserRow]);
  }

  async function audit(acao: string, entidade?: string, entidade_id?: string, detalhes?: any) {
    if (!supabase || !operator?.id) return;
    await supabase.from("auditoria").insert({
      operador_id: operator.id,
      acao,
      entidade: entidade || null,
      entidade_id: entidade_id || null,
      detalhes: detalhes || {},
    });
  }

  async function auth(email: string, password: string, signup: boolean, nome: string) {
    if (!supabase) {
      setError("Banco não configurado.");
      return;
    }
    setError("");
    setMsg("");
    if (!email || !password) {
      setError("Informe e-mail e senha.");
      return;
    }
    if (password.length < 8) {
      setError("Use uma senha com pelo menos 8 caracteres.");
      return;
    }
    const r = signup
      ? await supabase.auth.signUp({
          email,
          password,
          options: { data: { nome }, emailRedirectTo: window.location.origin },
        })
      : await supabase.auth.signInWithPassword({ email, password });
    if (r.error) {
      setError(r.error.message);
      return;
    }
    if (signup && !r.data.session) {
      setMsg(
        "Cadastro criado. Confirme seu e-mail para liberar o primeiro acesso. Se o e-mail não chegar, confira Spam/Lixo eletrônico."
      );
      return;
    }
    setMsg("Acesso autorizado.");
    setSession(r.data.session);
  }

  async function resetPassword(email: string) {
    if (!supabase || !email) {
      setError("Informe seu e-mail.");
      return;
    }
    setError("");
    const r = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin,
    });
    if (r.error) setError(r.error.message);
    else setMsg("Link de recuperação enviado. Abra o e-mail e defina uma nova senha.");
  }

  async function updatePassword(password: string) {
    if (!supabase) return;
    if (password.length < 8) {
      setError("A nova senha precisa ter pelo menos 8 caracteres.");
      return;
    }
    const { error } = await supabase.auth.updateUser({ password });
    if (error) setError(error.message);
    else {
      setRecovery(false);
      setMsg("Senha alterada com sucesso. Você já pode usar a central.");
    }
  }

  async function doImport() {
    if (!supabase || !files.length || !previews.length) return;
    setLoading(true);
    setError("");
    setMsg("");
    let adicionados = 0,
      duplicados = 0,
      bloqueados = 0,
      semTelefone = 0,
      importados = 0;
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i],
          preview = previews[i];
        const { data: imp, error: ie } = await supabase
          .from("importacoes")
          .insert({
            nome_arquivo: file.name,
            extensao: preview.ext,
            total: preview.total,
            validos: 0,
            duplicados: 0,
            invalidos: preview.total - preview.validos,
            sem_telefone: 0,
            mapeamento: preview.map,
          })
          .select()
          .single();
        if (ie) throw ie;
        const rows = preview.rows.map((r: any) => ({
          nome: String(r.nome || "").trim(),
          cpf: r.cpf || null,
          cidade: r.cidade || "",
          uf: r.uf || "",
          produto: r.produto || "",
          observacao: r.observacao || "",
          extras: r.extras || {},
          telefone_original: r.telefone || "",
          telefone_normalizado: phone(r.telefone || "") || null,
          telefone2_original: r.telefone2 || "",
          telefone2_normalizado: phone(r.telefone2 || "") || null,
        }));
        const { data: result, error: re } = await supabase.rpc("import_leads_batch", {
          p_importacao_id: imp.id,
          p_rows: rows,
        });
        if (re) throw re;
        const s = result || {};
        adicionados += Number(s.adicionados || 0);
        duplicados += Number(s.duplicados || 0);
        bloqueados += Number(s.bloqueados || 0);
        semTelefone += Number(s.sem_telefone || 0);
        importados++;
        await audit("importacao_concluida", "importacoes", imp.id, s);
      }
      setMsg(
        importados +
          " arquivo(s) importado(s): " +
          adicionados +
          " adicionados • " +
          duplicados +
          " duplicados • " +
          bloqueados +
          " bloqueados • " +
          semTelefone +
          " sem telefone."
      );
      setShowImport(false);
      setPreviews([]);
      setFiles([]);
      await load();
    } catch (e: any) {
      setError(
        "Erro na importação: " + (e?.message || "não foi possível processar os arquivos.")
      );
    } finally {
      setLoading(false);
    }
  }

  async function callResult(result: string) {
    if (!supabase || !current) return;
    if (result === "Retorno") return;
    const t = current.telefones?.[0],
      now = new Date().toISOString();
    const { error: e } = await supabase.from("ligacoes").insert({
      lead_id: current.id,
      telefone_id: t?.id,
      operador_id: operator?.id,
      inicio: now,
      fim: now,
      resultado: result,
    });
    if (e) {
      setError(e.message);
      return;
    }
    const statusMap: Record<string, string> = {
      "Número inválido": "numero_invalido",
      "Sem perfil": "sem_perfil",
      "Não interessado": "nao_interessado",
      "Não atendeu": "nao_atendeu",
      Interessado: "interessado",
      Simulação: "simulação",
      Proposta: "proposta",
      Contrato: "contrato",
    };
    const status = statusMap[result] || "finalizado";
    const { error: ue } = await supabase
      .from("leads")
      .update({ status, updated_at: now })
      .eq("id", current.id);
    if (ue) {
      setError(ue.message);
      return;
    }
    await audit("ligacao_tabular", "leads", current.id, { resultado: result, status });
    await load();
  }

  async function scheduleReturn(dateTime: string, observacao: string) {
    if (!supabase || !current || !dateTime) return;
    const t = current.telefones?.[0],
      now = new Date().toISOString(),
      when = new Date(dateTime).toISOString();
    if (new Date(when).getTime() <= Date.now()) {
      setError("Escolha uma data e hora futura para o retorno.");
      return;
    }
    const { error: e } = await supabase.from("ligacoes").insert({
      lead_id: current.id,
      telefone_id: t?.id,
      operador_id: operator?.id,
      inicio: now,
      fim: now,
      resultado: "Retorno",
      observacao: observacao || null,
    });
    if (e) {
      setError(e.message);
      return;
    }
    const { error: r } = await supabase.from("retornos").insert({
      lead_id: current.id,
      operador_id: operator?.id,
      data_hora: when,
      observacao: observacao || null,
      concluido: false,
    });
    if (r) {
      setError(r.message);
      return;
    }
    const { error: ue } = await supabase
      .from("leads")
      .update({ status: "retorno", updated_at: now })
      .eq("id", current.id);
    if (ue) {
      setError(ue.message);
      return;
    }
    await audit("retorno_agendado", "leads", current.id, { data_hora: when, observacao });
    await load();
  }

  async function block() {
    if (!supabase || !current) return;
    const tel = current.telefones?.[0]?.numero_normalizado || "";
    const { error: e } = await supabase.from("lista_nao_perturbe").insert({
      cpf: cpf(current.cpf || "") || null,
      telefone: phone(tel) || null,
      nome: current.nome,
      origem: "manual",
      motivo: "Solicitação de não contato",
      operador_id: operator?.id,
    });
    if (e) {
      setError(e.message);
      return;
    }
    await supabase
      .from("leads")
      .update({ bloqueado: true, opt_out: true, status: "bloqueado", updated_at: new Date().toISOString() })
      .eq("id", current.id);
    await audit("bloqueio_npd", "leads", current.id);
    await load();
  }

  async function moveLead(id: string, status: string) {
    if (!supabase) return;
    const { error: e } = await supabase
      .from("leads")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (e) setError(e.message);
    else {
      await audit("crm_movimentacao", "leads", id, { status });
      await load();
    }
  }

  async function createCampaign(data: { nome: string; produto: string; inicio_at?: string; fim_at?: string }) {
    if (!supabase || !operator || !data.nome.trim()) return;
    const { error: e } = await supabase.from("campanhas").insert({
      nome: data.nome.trim(),
      produto: data.produto || "Consignado",
      status: "ativa",
      inicio_at: data.inicio_at || null,
      fim_at: data.fim_at || null,
    });
    if (e) setError(e.message);
    else {
      await audit("campanha_criada", "campanhas", undefined, data);
      await load();
    }
  }

  async function toggleCampaign(id: string, status: string) {
    if (!supabase) return;
    const next = status === "ativa" ? "pausada" : "ativa";
    const { error: e } = await supabase.from("campanhas").update({ status: next }).eq("id", id);
    if (e) setError(e.message);
    else {
      await audit("campanha_status", "campanhas", id, { status: next });
      await load();
    }
  }

  async function deleteCampaign(id: string) {
    if (!supabase) return;
    if (!window.confirm("Remover esta campanha? O histórico de ligações continuará registrado.")) return;
    const { error: e } = await supabase.from("campanhas").update({ status: "removida" }).eq("id", id);
    if (e) setError(e.message);
    else {
      await audit("campanha_removida", "campanhas", id);
      await load();
    }
  }

  async function updateReturn(id: string, data: { data_hora: string; observacao: string }) {
    if (!supabase) return;
    const { error: e } = await supabase
      .from("retornos")
      .update({ data_hora: new Date(data.data_hora).toISOString(), observacao: data.observacao || null })
      .eq("id", id);
    if (e) setError(e.message);
    else {
      await audit("retorno_reagendado", "retornos", id, data);
      await load();
    }
  }

  async function concludeReturn(row: ReturnRow) {
    if (!supabase) return;
    const { error: e } = await supabase.from("retornos").update({ concluido: true }).eq("id", row.id);
    if (e) {
      setError(e.message);
      return;
    }
    await supabase
      .from("leads")
      .update({ status: "disponivel", updated_at: new Date().toISOString() })
      .eq("id", row.lead_id);
    await audit("retorno_concluido", "retornos", row.id);
    await load();
  }

  async function removeNpd(row: any) {
    if (!supabase) return;
    const { error: e } = await supabase.from("lista_nao_perturbe").update({ ativo: false }).eq("id", row.id);
    if (e) {
      setError(e.message);
      return;
    }
    if (row.cpf) {
      await supabase
        .from("leads")
        .update({ bloqueado: false, opt_out: false, status: "disponivel", updated_at: new Date().toISOString() })
        .eq("cpf", row.cpf);
    } else if (row.telefone) {
      const { data: ts } = await supabase
        .from("telefones")
        .select("lead_id")
        .eq("numero_normalizado", row.telefone)
        .limit(20);
      const ids = (ts || []).map((x: any) => x.lead_id);
      if (ids.length)
        await supabase
          .from("leads")
          .update({ bloqueado: false, opt_out: false, status: "disponivel", updated_at: new Date().toISOString() })
          .in("id", ids);
    }
    await audit("npd_removido", "lista_nao_perturbe", row.id);
    await load();
  }

  async function saveUserConfig(
    id: string,
    permissoes: Record<string, boolean>,
    preferencias: Record<string, any>,
    ativo: boolean,
    perfil: string
  ) {
    if (!supabase || operator?.perfil !== "admin") return;
    const { error: e } = await supabase
      .from("operadores")
      .update({ permissoes, preferencias, ativo, perfil })
      .eq("id", id);
    if (e) setError(e.message);
    else {
      await audit("usuario_configurado", "operadores", id, { permissoes, preferencias, ativo, perfil });
      await loadOperator();
      setMsg("Configuração do usuário salva.");
    }
  }

  async function saveChannelsFor(targetId: string, data: any) {
    if (!supabase || !operator) return;
    if (targetId !== operator.id && operator.perfil !== "admin") return;
    const { error: e } = await supabase
      .from("configuracoes_canais")
      .upsert({ ...data, operador_id: targetId }, { onConflict: "operador_id" });
    if (e) setError(e.message);
    else {
      if (targetId === operator.id) setChannelConfig({ ...channelConfig, ...data });
      await audit("canais_configurados", "configuracoes_canais", targetId);
      setMsg("Configurações de canais salvas.");
    }
  }

  async function saveChannels(data: any) {
    if (operator) await saveChannelsFor(operator.id, data);
  }

  async function saveDialerFor(targetId: string, data: any) {
    if (!supabase || !operator) return;
    if (targetId !== operator.id && operator.perfil !== "admin") return;
    const payload = { ...data, operador_id: targetId, updated_at: new Date().toISOString() };
    const { error: e } = await supabase
      .from("configuracoes_discador")
      .upsert(payload, { onConflict: "operador_id" });
    if (e) setError(e.message);
    else {
      if (targetId === operator.id) setDialerConfig({ ...dialerConfig, ...data });
      await audit("telefonia_configurada", "configuracoes_discador", targetId);
      setMsg("Configuração de telefonia/Discador salva.");
    }
  }

  async function saveDialer(data: any) {
    if (operator) await saveDialerFor(operator.id, data);
  }

  if (!authReady) {
    return (
      <div className="boot">
        <div className="bootLogo">
          A<span>&</span>K
        </div>
        <div className="spinner" />
        <p>Inicializando central segura...</p>
      </div>
    );
  }

  if (bootTimeout && !session) {
    return (
      <div className="boot">
        <div className="bootLogo">
          A<span>&</span>K
        </div>
        <p style={{ color: "#ef4444", marginBottom: "1rem" }}>
          Não foi possível conectar ao Supabase em tempo útil.
        </p>
        <button className="btn primary" onClick={() => window.location.reload()}>
          Tentar Novamente
        </button>
      </div>
    );
  }

  if (!session || recovery) {
    return (
      <AuthScreen
        recovery={recovery}
        onAuth={auth}
        reset={resetPassword}
        updatePassword={updatePassword}
        msg={msg}
        error={error}
      />
    );
  }

  const allNav = [
    ["dashboard", "Visão geral", "⌂"],
    ["discador", "Discador", "☎"],
    ["crm", "CRM", "◆"],
    ["resultados", "Resultados", "↳"],
    ["leads", "Leads", "◉"],
    ["campanhas", "Campanhas", "▣"],
    ["retornos", "Retornos", "◷"],
    ["telefonia", "Telefonia", "◌"],
    ["mensagens", "Omnichannel", "✉"],
    ["relatorios", "Relatórios", "▥"],
    ["npd", "Não Perturbe", "⊘"],
    ["config", "Configurações", "⚙"],
  ] as const;

  const nav = allNav.filter(
    (x) => operator?.perfil === "admin" || operator?.permissoes?.[x[0]] !== false
  );

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <b>
            A<span>&</span>K
          </b>
          <small>CALL CENTER</small>
        </div>
        <div className="operator">
          <div className="avatar">{initials(operator?.nome || session.user.email)}</div>
          <div>
            <b>{operator?.nome || "Operador"}</b>
            <small>{operator?.perfil === "admin" ? "proprietário" : operator?.perfil || "operador"}</small>
          </div>
        </div>
        <nav>
          {nav.map(([id, label, icon]) => (
            <button key={id} className={mode === id ? "active" : ""} onClick={() => setMode(id)}>
              <i>{icon}</i>
              {label}
            </button>
          ))}
        </nav>
        <button className="btn primary full" onClick={() => setShowImport(true)}>
          ＋ Importar lista
        </button>
        <button className="btn dark full" onClick={() => supabase?.auth.signOut()}>
          Sair
        </button>
        <div className="sidefoot">
          A&K Soluções Financeiras
          <br />
          <span>Soluções que fazem sentido para você.</span>
        </div>
      </aside>

      <main className="content">
        <header className="header">
          <div>
            <div className="eyebrow">CENTRAL OPERACIONAL • ONLINE</div>
            <h1>{nav.find((x) => x[0] === mode)?.[1]}</h1>
            <p>Operação de consignado, CRM e telefonia em um único painel.</p>
          </div>
          <div className="headActions">
            <span className="online">
              <b /> Sistema online • v{APP_VERSION}
            </span>
            <button className="btn primary" onClick={() => setShowImport(true)}>
              ＋ Nova importação
            </button>
          </div>
        </header>

        {error && (
          <div className="alert error">
            <b>Erro:</b> {error}
            <button onClick={() => setError("")}>×</button>
          </div>
        )}
        {msg && (
          <div className="alert success">
            {msg}
            <button onClick={() => setMsg("")}>×</button>
          </div>
        )}

        {mode === "dashboard" && (
          <Dashboard
            leads={leads}
            available={available.length}
            npd={npd.length}
            campaigns={campaigns.length}
            returns={returns}
            calls={calls}
            loading={loading}
          />
        )}
        {mode === "discador" && (
          <Dialer
            lead={current}
            available={available.length}
            onCall={() =>
              current?.telefones?.[0] &&
              (window.location.href = "tel:+" + current.telefones?.[0]?.numero_normalizado)
            }
            onResult={callResult}
            onReturn={scheduleReturn}
            onBlock={block}
          />
        )}
        {mode === "crm" && (
          <DeskCRM leads={leads} stages={stages} onMove={moveLead} onOpen={setSelectedLead} operator={operator} />
        )}
        {mode === "resultados" && <OperationalResults leads={leads} onOpen={setSelectedLead} />}
        {mode === "leads" && (
          <Leads
            leads={paged}
            loading={loading}
            search={search}
            setSearch={setSearch}
            page={page}
            setPage={setPage}
            total={filtered.length}
            pageSize={pageSize}
            onOpen={setSelectedLead}
          />
        )}
        {mode === "campanhas" && (
          <Campaigns rows={campaigns} onCreate={createCampaign} onToggle={toggleCampaign} onDelete={deleteCampaign} />
        )}
        {mode === "retornos" && (
          <Returns rows={returns} onOpenLead={setSelectedLead} onSave={updateReturn} onConclude={concludeReturn} />
        )}
        {mode === "telefonia" && <Telephony config={dialerConfig} onSave={saveDialer} />}
        {mode === "mensagens" && <Omnichannel config={channelConfig} onSave={saveChannels} />}
        {mode === "relatorios" && <Reports leads={leads} npd={npd} calls={calls} returns={returns} />}
        {mode === "npd" && <Npd rows={npd} onRemove={removeNpd} />}
        {mode === "config" && (
          <Settings
            operator={operator}
            users={users}
            onSaveUser={saveUserConfig}
            channelConfig={channelConfig}
            onSaveChannels={saveChannelsFor}
            dialerConfig={dialerConfig}
            onSaveDialer={saveDialerFor}
          />
        )}

        {selectedLead && (
          <LeadDrawer
            lead={selectedLead}
            onClose={() => setSelectedLead(null)}
            onMove={moveLead}
            stages={stages}
          />
        )}

        {showImport && (
          <ImportModal
            files={files}
            previews={previews}
            onFiles={async (selected) => {
              setError("");
              setFiles(selected);
              try {
                setPreviews(await Promise.all(selected.map((f) => parseFile(f))));
              } catch {
                setPreviews([]);
                setError("Não foi possível ler uma das planilhas. Verifique se os arquivos estão íntegros.");
              }
            }}
            onClose={() => {
              setShowImport(false);
              setPreviews([]);
              setFiles([]);
              setMsg("");
            }}
            onImport={doImport}
            loading={loading}
          />
        )}
      </main>
    </div>
  );
}

function AuthScreen({
  recovery,
  onAuth,
  reset,
  updatePassword,
  msg,
  error,
}: {
  recovery: boolean;
  onAuth: (e: string, p: string, s: boolean, n: string) => void;
  reset: (e: string) => void;
  updatePassword: (p: string) => void;
  msg: string;
  error: string;
}) {
  const [e, setE] = useState(""),
    [p, setP] = useState(""),
    [n, setN] = useState(""),
    [s, setS] = useState(false),
    [forgot, setForgot] = useState(false),
    [terms, setTerms] = useState(false),
    [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    try {
      if (forgot) await reset(e);
      else if (recovery) await updatePassword(p);
      else await onAuth(e, p, s, n);
    } finally {
      setBusy(false);
    }
  };

  const brand = (
    <>
      <div className="heroLogo">
        A<span>&</span>K
      </div>
      <div className="authBrandName">SOLUÇÕES FINANCEIRAS</div>
    </>
  );

  if (recovery)
    return (
      <div className="auth">
        <div className="authHero">
          {brand}
          <h1>Recupere o controle da sua operação.</h1>
          <p>Defina uma nova senha e volte para a central.</p>
        </div>
        <div className="authPanel">
          <div className="authBox">
            <div className="mobileLogo">{brand}</div>
            <div className="eyebrow">A&K SOLUÇÕES FINANCEIRAS</div>
            <h2>Nova senha</h2>
            <p className="muted">Escolha uma senha com pelo menos 8 caracteres.</p>
            <div className="field">
              <label>Nova senha</label>
              <input
                autoFocus
                type="password"
                value={p}
                onChange={(x) => setP(x.target.value)}
                placeholder="••••••••"
              />
            </div>
            {(error || msg) && (
              <div className={error ? "notice danger" : "notice"}>{error || msg}</div>
            )}
            <button className="btn primary full big" disabled={busy} onClick={submit}>
              {busy ? "Salvando..." : "Alterar senha"}
            </button>
          </div>
        </div>
      </div>
    );

  return (
    <div className="auth">
      <div className="authHero">
        {brand}
        <h1>Central inteligente para operações de consignado.</h1>
        <p>Discador, CRM, mailing, retornos, bloqueios e indicadores em uma experiência única.</p>
        <div className="heroBadges">
          <span>CRM integrado</span>
          <span>Fila operacional</span>
          <span>LGPD & auditoria</span>
        </div>
      </div>
      <div className="authPanel">
        <div className="authBox">
          <div className="mobileLogo">{brand}</div>
          <div className="eyebrow">A&K SOLUÇÕES FINANCEIRAS</div>
          <h2>{forgot ? "Recuperar acesso" : s ? "Criar proprietário" : "Entrar na central"}</h2>
          <p className="muted">
            {forgot
              ? "Envie um link para seu e-mail."
              : s
              ? "O primeiro cadastro deste projeto recebe automaticamente o perfil proprietário/admin."
              : "Use seu e-mail e senha para acessar."}
          </p>
          {s && !forgot && (
            <div className="field">
              <label>Nome</label>
              <input value={n} onChange={(x) => setN(x.target.value)} placeholder="Seu nome" />
            </div>
          )}
          <div className="field">
            <label>E-mail</label>
            <input
              type="email"
              value={e}
              onChange={(x) => setE(x.target.value)}
              placeholder="voce@empresa.com"
            />
          </div>
          {!forgot && (
            <div className="field">
              <label>Senha</label>
              <input
                type="password"
                value={p}
                onChange={(x) => setP(x.target.value)}
                placeholder="Mínimo 8 caracteres"
              />
            </div>
          )}
          {s && !forgot && (
            <label className="check">
              <input
                type="checkbox"
                checked={terms}
                onChange={(x) => setTerms(x.target.checked)}
              />
              <span>
                Li e aceito os{" "}
                <a href="/termos" target="_blank">
                  Termos de Uso
                </a>{" "}
                e a{" "}
                <a href="/privacidade" target="_blank">
                  Política de Privacidade
                </a>
                .
              </span>
            </label>
          )}
          {(error || msg) && (
            <div className={error ? "notice danger" : "notice"}>{error || msg}</div>
          )}
          <button
            className="btn primary full big"
            disabled={busy || (s && !terms)}
            onClick={submit}
          >
            {busy
              ? "Processando..."
              : forgot
              ? "Enviar recuperação"
              : s
              ? "Criar minha conta"
              : "Entrar"}
          </button>
          <div className="authLinks">
            {!forgot && (
              <button onClick={() => setS(!s)}>{s ? "Já tenho acesso" : "Primeiro acesso"}</button>
            )}
            <button
              onClick={() => {
                setForgot(!forgot);
                setS(false);
              }}
            >
              {forgot ? "Voltar ao login" : "Esqueci minha senha"}
            </button>
          </div>
          <small className="authNote">
            Se o cadastro exigir confirmação, o e-mail precisa ser confirmado antes do primeiro login.
          </small>
        </div>
      </div>
    </div>
  );
}

function Dashboard({
  leads,
  available,
  npd,
  campaigns,
  returns,
  calls,
  loading,
}: {
  leads: Lead[];
  available: number;
  npd: number;
  campaigns: number;
  returns: ReturnRow[];
  calls: any[];
  loading: boolean;
}) {
  const opportunities = leads.filter((x) =>
    ["interessado", "simulação", "proposta", "contrato"].includes(
      String(x.status || "").toLowerCase()
    )
  ).length;
  const pendingReturns = returns.filter((r) => !r.concluido).length;

  return (
    <div className="stack">
      <section className="akOperations360" aria-label="Operação 360">
        <header className="akOperations360Head">
          <div>
            <span>OPERAÇÃO 360 • CENTRAL OPERACIONAL</span>
            <h2>Fila, CRM, Customer 360 e operação em um único painel</h2>
            <p>
              Os principais indicadores da operação ficam concentrados aqui, usando a mesma base,
              discadora e histórico do A&amp;K.
            </p>
          </div>
          <div className="akOperations360Status">● ONLINE</div>
        </header>
        <div className="akOperations360Metrics">
          <Metric title="Leads na base" value={leads.length} icon="◉" hint="mailing carregado" />
          <Metric title="Na fila" value={available} icon="☎" hint="prontos para contato" />
          <Metric
            title="Oportunidades"
            value={opportunities}
            icon="↗"
            hint="interesse ou proposta"
          />
          <Metric title="Retornos" value={pendingReturns} icon="◷" hint="próximas ações" />
          <Metric title="Não Perturbe" value={npd} icon="⊘" hint="bloqueios ativos" />
          <Metric title="Campanhas" value={campaigns} icon="▣" hint="cadastradas" />
          <Metric title="Ligações" value={calls.length} icon="▥" hint="histórico carregado" />
        </div>
        <div className="akOperations360Body">
          <div>
            <div className="eyebrow">CENTRAL DE TRABALHO</div>
            <h3>Uma visão única da operação</h3>
            <p>
              Use o menu lateral para entrar no Discador, CRM, Retornos, Relatórios e demais
              módulos. A Operação 360 fica exclusivamente nesta Visão geral.
            </p>
          </div>
          <div className="akOperations360Actions">
            <span>
              Fila ativa <b>{available}</b>
            </span>
            <span>
              Retornos pendentes <b>{pendingReturns}</b>
            </span>
            <span>
              Registros de ligação <b>{calls.length}</b>
            </span>
          </div>
        </div>
      </section>
      {loading && <div className="loadingbar" />}
    </div>
  );
}

function Metric({
  title,
  value,
  icon,
  hint,
}: {
  title: string;
  value: number;
  icon: string;
  hint: string;
}) {
  return (
    <div className="panel metric">
      <div className="metricIcon">{icon}</div>
      <div>
        <span>{title}</span>
        <strong>{value}</strong>
        <small>{hint}</small>
      </div>
    </div>
  );
}

function PanelTitle({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="panelTitle">
      <div>
        <h3>{title}</h3>
        <p>{subtitle}</p>
      </div>
    </div>
  );
}

function Empty({ title, text }: { title: string; text: string }) {
  return (
    <div style={{ textAlign: "center", padding: "2rem", color: "#666" }}>
      <h4>{title}</h4>
      <p>{text}</p>
    </div>
  );
}

function Dialer({
  lead,
  available,
  onCall,
  onResult,
  onReturn,
  onBlock,
}: {
  lead?: Lead;
  available: number;
  onCall: () => void;
  onResult: (r: string) => void;
  onReturn: (dateTime: string, observacao: string) => void;
  onBlock: () => void;
}) {
  const [mode, setMode] = useState("preview"),
    [showReturn, setShowReturn] = useState(false),
    [dateTime, setDateTime] = useState(() => {
      const d = new Date(Date.now() + 86400000);
      d.setHours(9, 0, 0, 0);
      return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    }),
    [obs, setObs] = useState("");

  return (
    <div className="stack">
      <div className="modeBar">
        <div>
          <b>Modo de discagem</b>
          <small>Controle operacional. A discagem real depende da telefonia conectada.</small>
        </div>
        <div className="modeBtns">
          {[
            ["preview", "Preview"],
            ["power", "Power"],
            ["preditivo", "Preditivo"],
            ["blended", "Blended"],
          ].map((x) => (
            <button
              className={mode === x[0] ? "sel" : ""}
              key={x[0]}
              onClick={() => setMode(x[0])}
            >
              {x[1]}
            </button>
          ))}
        </div>
      </div>
      <div className="dialGrid">
        <section className="panel callPanel">
          <div className="dialHeader">
            <span className="statusDot" />
            Fila ativa <b>{available}</b>
          </div>
          {lead ? (
            <>
              <div className="person">
                <div className="personAvatar">{initials(lead.nome)}</div>
                <div>
                  <div className="eyebrow">PRÓXIMO CONTATO</div>
                  <h2>{lead.nome}</h2>
                  <p>
                    {lead.cidade || "Cidade não informada"}{" "}
                    {lead.uf && "• " + lead.uf}
                  </p>
                </div>
              </div>
              <div className="dialNumber">
                {lead.telefones?.[0]?.numero_normalizado || "Sem telefone"}
              </div>
              <div className="callActions">
                <button className="btn callBtn" onClick={onCall}>
                  ☎ LIGAR AGORA
                </button>
                {whatsappHref(lead.telefones?.[0]?.numero_normalizado) && (
                  <a
                    className="btn"
                    href={whatsappHref(lead.telefones?.[0]?.numero_normalizado)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    ◉ WHATSAPP
                  </a>
                )}
                <button className="btn" onClick={() => setShowReturn(true)}>
                  ◷ Agendar retorno
                </button>
                <button className="btn dangerBtn" onClick={onBlock}>
                  ⊘ Não ligar mais
                </button>
              </div>
            </>
          ) : (
            <Empty title="Fila vazia" text="Importe uma lista para iniciar a operação." />
          )}
        </section>
        <section className="panel">
          <PanelTitle title="Tabulação" subtitle="Registre o resultado para avançar." />
          <div className="resultGrid">
            {results.map((r) => (
              <button
                key={r}
                onClick={() => (r === "Retorno" ? setShowReturn(true) : onResult(r))}
              >
                {r}
              </button>
            ))}
          </div>
          <div className="info">
            Número inválido → <b>CRM / Resultados operacionais / Número inválido</b>. Sem perfil →{" "}
            <b>CRM / Resultados operacionais / Sem perfil</b>. Não atendeu e Não interessado
            também ficam rastreáveis no CRM e nos relatórios.
          </div>
        </section>
      </div>

      {showReturn && (
        <div className="modal" onClick={() => setShowReturn(false)}>
          <div className="modalBox smallModal" onClick={(e) => e.stopPropagation()}>
            <div className="toolbar">
              <div>
                <div className="eyebrow">RETORNO</div>
                <h2>Agendar retorno</h2>
                <p>{lead?.nome}</p>
              </div>
              <button className="btn" onClick={() => setShowReturn(false)}>
                Fechar
              </button>
            </div>
            <div className="field">
              <label>Data e hora</label>
              <input
                type="datetime-local"
                value={dateTime}
                min={new Date(Date.now() - new Date().getTimezoneOffset() * 60000)
                  .toISOString()
                  .slice(0, 16)}
                onChange={(e) => setDateTime(e.target.value)}
              />
            </div>
            <div className="field">
              <label>Observação</label>
              <textarea
                className="textarea"
                value={obs}
                onChange={(e) => setObs(e.target.value)}
                placeholder="Ex.: retornar após 15h, enviar simulação..."
              />
            </div>
            <button
              className="btn primary full big"
              onClick={() => {
                onReturn(dateTime, obs);
                setShowReturn(false);
                setObs("");
              }}
            >
              Salvar e próximo lead
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function DeskCRM({
  leads,
  stages,
  onMove,
  onOpen,
  operator,
}: {
  leads: Lead[];
  stages: Stage[];
  onMove: (id: string, s: string) => void;
  onOpen: (l: Lead) => void;
  operator: any;
}) {
  const defaultStages = [
    { id: "disponivel", nome: "Disponível", cor: "#94a3b8" },
    { id: "interessado", nome: "Interessado", cor: "#3b82f6" },
    { id: "simulacao", nome: "Simulação", cor: "#8b5cf6" },
    { id: "proposta", nome: "Proposta", cor: "#eab308" },
    { id: "contrato", nome: "Contrato", cor: "#22c55e" },
  ];
  const activeStages = stages.length ? stages : defaultStages;

  return (
    <div className="crmBoard">
      {activeStages.map((st) => {
        const stageLeads = leads.filter(
          (l) => l.status?.toLowerCase() === st.nome.toLowerCase() || l.status === st.id
        );
        return (
          <div key={st.id} className="crmColumn">
            <div className="crmHeader">
              <span>{st.nome}</span>
              <b>{stageLeads.length}</b>
            </div>
            <div className="crmCards">
              {stageLeads.map((lead) => (
                <div key={lead.id} className="crmCard" onClick={() => onOpen(lead)}>
                  <b>{lead.nome}</b>
                  <p>{lead.cpf ? mask(lead.cpf) : "CPF não informado"}</p>
                  <div className="crmFooter">
                    <span>{lead.produto || "Consignado"}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function OperationalResults({ leads, onOpen }: { leads: Lead[]; onOpen: (l: Lead) => void }) {
  return (
    <div className="panel">
      <PanelTitle title="Resultados Operacionais" subtitle="Acompanhamento detalhado das interações." />
      <div className="tableWrap">
        <table>
          <thead>
            <tr>
              <th>Nome</th>
              <th>CPF</th>
              <th>Status</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {leads.slice(0, 50).map((l) => (
              <tr key={l.id}>
                <td>{l.nome}</td>
                <td>{l.cpf ? mask(l.cpf) : "-"}</td>
                <td>
                  <span className="tag">{l.status}</span>
                </td>
                <td>
                  <button className="btn" onClick={() => onOpen(l)}>
                    Ver Detalhes
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Leads({
  leads,
  loading,
  search,
  setSearch,
  page,
  setPage,
  total,
  pageSize,
  onOpen,
}: {
  leads: Lead[];
  loading: boolean;
  search: string;
  setSearch: (s: string) => void;
  page: number;
  setPage: (p: number) => void;
  total: number;
  pageSize: number;
  onOpen: (l: Lead) => void;
}) {
  const maxPage = Math.ceil(total / pageSize) || 1;
  return (
    <div className="panel">
      <div className="toolbar">
        <input
          type="text"
          placeholder="Buscar por nome, CPF ou cidade..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="fieldInput"
        />
        <span>
          Total: <b>{total}</b>
        </span>
      </div>
      <div className="tableWrap">
        <table>
          <thead>
            <tr>
              <th>Nome</th>
              <th>CPF</th>
              <th>Cidade/UF</th>
              <th>Status</th>
              <th>Ação</th>
            </tr>
          </thead>
          <tbody>
            {leads.map((l) => (
              <tr key={l.id}>
                <td>{l.nome}</td>
                <td>{l.cpf ? mask(l.cpf) : "-"}</td>
                <td>
                  {l.cidade || "-"} {l.uf ? `/ ${l.uf}` : ""}
                </td>
                <td>
                  <span className="tag">{l.status}</span>
                </td>
                <td>
                  <button className="btn" onClick={() => onOpen(l)}>
                    Abrir
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="pagination">
        <button className="btn" disabled={page <= 1} onClick={() => setPage(page - 1)}>
          Anterior
        </button>
        <span>
          Página {page} de {maxPage}
        </span>
        <button className="btn" disabled={page >= maxPage} onClick={() => setPage(page + 1)}>
          Próxima
        </button>
      </div>
    </div>
  );
}

function Campaigns({
  rows,
  onCreate,
  onToggle,
  onDelete,
}: {
  rows: Campaign[];
  onCreate: (d: any) => void;
  onToggle: (id: string, s: string) => void;
  onDelete: (id: string) => void;
}) {
  const [nome, setNome] = useState(""),
    [produto, setProduto] = useState("Consignado");
  return (
    <div className="stack">
      <div className="panel">
        <PanelTitle title="Criar Nova Campanha" subtitle="Configure e organize seu discador." />
        <div className="formRow">
          <input
            placeholder="Nome da Campanha"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
          />
          <button
            className="btn primary"
            onClick={() => {
              onCreate({ nome, produto });
              setNome("");
            }}
          >
            Salvar
          </button>
        </div>
      </div>
      <div className="panel">
        <PanelTitle title="Campanhas Ativas" subtitle="Gerencie as campanhas ativas no sistema." />
        <div className="tableWrap">
          <table>
            <thead>
              <tr>
                <th>Nome</th>
                <th>Produto</th>
                <th>Status</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.id}>
                  <td>{c.nome}</td>
                  <td>{c.produto || "Consignado"}</td>
                  <td>{c.status}</td>
                  <td>
                    <button className="btn" onClick={() => onToggle(c.id, c.status)}>
                      {c.status === "ativa" ? "Pausar" : "Ativar"}
                    </button>
                    <button className="btn dangerBtn" onClick={() => onDelete(c.id)}>
                      Excluir
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Returns({
  rows,
  onOpenLead,
  onSave,
  onConclude,
}: {
  rows: ReturnRow[];
  onOpenLead: (l: Lead) => void;
  onSave: (id: string, d: any) => void;
  onConclude: (r: ReturnRow) => void;
}) {
  return (
    <div className="panel">
      <PanelTitle title="Retornos Agendados" subtitle="Acompanhe os compromissos com os clientes." />
      <div className="tableWrap">
        <table>
          <thead>
            <tr>
              <th>Lead</th>
              <th>Data/Hora</th>
              <th>Observação</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{r.lead?.nome || "Lead"}</td>
                <td>{new Date(r.data_hora).toLocaleString()}</td>
                <td>{r.observacao || "-"}</td>
                <td>
                  <button className="btn primary" onClick={() => onConclude(r)}>
                    Concluir
                  </button>
                  {r.lead && (
                    <button className="btn" onClick={() => onOpenLead(r.lead)}>
                      Ver Lead
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Telephony({ config, onSave }: { config: any; onSave: (d: any) => void }) {
  return (
    <div className="panel">
      <PanelTitle title="Configuração de Telefonia" subtitle="Ajustes de integrações com troncos SIP e discador." />
      <p>Configurações gerais salvas para a conta do operador corrente.</p>
    </div>
  );
}

function Omnichannel({ config, onSave }: { config: any; onSave: (d: any) => void }) {
  return (
    <div className="panel">
      <PanelTitle title="Omnichannel" subtitle="Integração de WhatsApp, SMS e E-mail." />
      <p>Configure os canais integrados para automação de mensagens.</p>
    </div>
  );
}

function Reports({ leads, npd, calls, returns }: { leads: Lead[]; npd: any[]; calls: any[]; returns: any[] }) {
  return (
    <div className="panel">
      <PanelTitle title="Relatórios Gerais" subtitle="Consolidado estatístico da operação." />
      <div className="metricsGrid">
        <Metric title="Total de Leads" value={leads.length} icon="◉" hint="" />
        <Metric title="Total de Ligações" value={calls.length} icon="▥" hint="" />
        <Metric title="Bloqueios NPD" value={npd.length} icon="⊘" hint="" />
        <Metric title="Retornos Pendentes" value={returns.length} icon="◷" hint="" />
      </div>
    </div>
  );
}

function Npd({ rows, onRemove }: { rows: any[]; onRemove: (r: any) => void }) {
  return (
    <div className="panel">
      <PanelTitle title="Não Perturbe (NPD)" subtitle="Lista de bloqueios solicitados por clientes." />
      <div className="tableWrap">
        <table>
          <thead>
            <tr>
              <th>Nome</th>
              <th>CPF / Telefone</th>
              <th>Ação</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{r.nome || "-"}</td>
                <td>{r.cpf ? mask(r.cpf) : r.telefone || "-"}</td>
                <td>
                  <button className="btn dangerBtn" onClick={() => onRemove(r)}>
                    Remover Bloqueio
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Settings({
  operator,
  users,
  onSaveUser,
  channelConfig,
  onSaveChannels,
  dialerConfig,
  onSaveDialer,
}: {
  operator: any;
  users: UserRow[];
  onSaveUser: any;
  channelConfig: any;
  onSaveChannels: any;
  dialerConfig: any;
  onSaveDialer: any;
}) {
  return (
    <div className="panel">
      <PanelTitle title="Configurações do Sistema" subtitle="Gerenciamento de operadores e permissões." />
      <div className="tableWrap">
        <table>
          <thead>
            <tr>
              <th>Operador</th>
              <th>Perfil</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td>{u.nome}</td>
                <td>{u.perfil}</td>
                <td>{u.ativo ? "Ativo" : "Inativo"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function LeadDrawer({
  lead,
  onClose,
  onMove,
  stages,
}: {
  lead: Lead;
  onClose: () => void;
  onMove: (id: string, s: string) => void;
  stages: Stage[];
}) {
  return (
    <div className="modal" onClick={onClose}>
      <div className="modalBox" onClick={(e) => e.stopPropagation()}>
        <div className="toolbar">
          <div>
            <h2>{lead.nome}</h2>
            <p>{lead.cpf ? mask(lead.cpf) : "CPF não cadastrado"}</p>
          </div>
          <button className="btn" onClick={onClose}>
            Fechar
          </button>
        </div>
        <div className="field">
          <label>Status Atual</label>
          <select value={lead.status} onChange={(e) => onMove(lead.id, e.target.value)}>
            <option value="disponivel">Disponível</option>
            <option value="interessado">Interessado</option>
            <option value="simulacao">Simulação</option>
            <option value="proposta">Proposta</option>
            <option value="contrato">Contrato</option>
          </select>
        </div>
      </div>
    </div>
  );
}

function ImportModal({
  files,
  previews,
  onFiles,
  onClose,
  onImport,
  loading,
}: {
  files: File[];
  previews: any[];
  onFiles: (files: File[]) => void;
  onClose: () => void;
  onImport: () => void;
  loading: boolean;
}) {
  return (
    <div className="modal" onClick={onClose}>
      <div className="modalBox" onClick={(e) => e.stopPropagation()}>
        <div className="toolbar">
          <h2>Importar Lista de Leads</h2>
          <button className="btn" onClick={onClose}>
            Fechar
          </button>
        </div>
        <div className="field">
          <input
            type="file"
            multiple
            accept=".csv, .xlsx, .xls"
            onChange={(e) => e.target.files && onFiles(Array.from(e.target.files))}
          />
        </div>
        <button className="btn primary full big" disabled={loading || !files.length} onClick={onImport}>
          {loading ? "Importando..." : "Processar e Importar"}
        </button>
      </div>
    </div>
  );
}
