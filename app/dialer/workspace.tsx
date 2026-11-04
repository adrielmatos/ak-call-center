"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { parseFile } from "@/lib/importer";

type Operator = { id:string; nome:string; email:string|null; perfil:string; ativo:boolean };
type Lead = {
  id:string; nome:string; cpf:string|null; telefone:string|null; produto:string|null;
  status:string; observacoes:string|null; dados_extras:any; cidade:string|null; uf:string|null;
  banco:string|null; operador_id:string|null; created_at:string;
};
type Script = { id:string; chave:string; nome:string; conteudo:string; ativo:boolean; ordem:number };
type Blocked = { id:string; cpf:string|null; telefone:string|null; motivo:string|null; ativo:boolean; created_at:string };

const STATUS = ["DISPONIVEL","EM_ATENDIMENTO","LIGAR_DEPOIS","FINALIZADO","NPO","SEM_INTERESSE"];
const statusLabel:Record<string,string> = {
  DISPONIVEL:"Disponível", EM_ATENDIMENTO:"Em atendimento", LIGAR_DEPOIS:"Ligar depois",
  FINALIZADO:"Finalizado", NPO:"Não Perturbe", SEM_INTERESSE:"Sem interesse"
};
const normalize = (v:string) => String(v||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().trim();
const digits = (v:string) => String(v||"").replace(/\D/g,"");
const productKey = (v:string|null) => {
  const p=normalize(String(v||"").replace(/\s*[•|]\s*banco\s*:.+$/i,""));
  const keys=["INSS","SIAPE","FGTS","CLT","BPC/LOAS","Consignado Público","Consignado Privado","Militar","Crédito Pessoal","Cartão Consignado","Cartão Benefício","Seguros","Energia Solar","Abertura de conta Santander","Crédito com Imóvel em Garantia","Crédito com Veículo em Garantia","Atendimento"];
  return keys.find(k=>p.includes(normalize(k))) || "Atendimento";
};

export default function DialerWorkspace({operator,initialLeads,initialScripts,initialBlocked}:{operator:Operator;initialLeads:Lead[];initialScripts:Script[];initialBlocked:Blocked[]}) {
  const supabase=createClient();
  const [tab,setTab]=useState<"discadora"|"leads"|"scripts"|"npd">("discadora");
  const [leads,setLeads]=useState(initialLeads);
  const [scripts,setScripts]=useState(initialScripts);
  const [blocked,setBlocked]=useState(initialBlocked);
  const [selectedId,setSelectedId]=useState(initialLeads[0]?.id||"");
  const [search,setSearch]=useState("");
  const [scriptText,setScriptText]=useState("");
  const [editingScriptId,setEditingScriptId]=useState(initialScripts[0]?.id||"");
  const [busy,setBusy]=useState(false);
  const [notice,setNotice]=useState("");
  const [callId,setCallId]=useState("");
  const [result,setResult]=useState("Atendido");
  const [npdCpf,setNpdCpf]=useState("");
  const [npdPhone,setNpdPhone]=useState("");
  const [npdReason,setNpdReason]=useState("");
  const [fileName,setFileName]=useState("");

  const canManage=operator.perfil==="admin"||operator.perfil==="gestor";
  const selected=leads.find(l=>l.id===selectedId)||null;
  const activeScript=scripts.find(s=>normalize(s.chave)===normalize(productKey(selected?.produto||null)))||scripts.find(s=>s.chave==="Atendimento")||null;
  const editingScript=scripts.find(s=>s.id===editingScriptId)||activeScript;
  const filtered=useMemo(()=>leads.filter(l=>{
    const q=normalize(search);
    return !q||normalize([l.nome,l.cpf||"",l.telefone||"",l.produto||"",l.banco||""].join(" ")).includes(q);
  }),[leads,search]);

  async function refreshLeads(){
    const {data,error}=await supabase.from("leads")
      .select("id,nome,cpf,telefone,produto,status,observacoes,dados_extras,cidade,uf,banco,operador_id,created_at")
      .order("created_at",{ascending:false}).limit(150);
    if(error) throw error;
    setLeads(data||[]);
    if(!selectedId&&data?.[0])setSelectedId(data[0].id);
  }
  async function startCall(){
    if(!selected?.telefone){setNotice("Este lead não possui telefone cadastrado.");return;}
    setBusy(true);setNotice("");
    try{
      const response=await fetch("/api/calls",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({action:"start",lead_id:selected.id})});
      const payload=await response.json();
      if(!response.ok)throw new Error(payload?.error?.message||"Não foi possível iniciar a ligação.");
      setCallId(payload.data.id);
      await supabase.from("leads").update({status:"EM_ATENDIMENTO",ultima_ligacao_at:new Date().toISOString(),tentativas_contato:undefined}).eq("id",selected.id);
      const number=digits(selected.telefone);
      window.location.href="tel:+"+(number.startsWith("55")?number:"55"+number);
      setNotice("Chamada registrada. Conclua a ligação e informe a tabulação.");
      await refreshLeads();
    }catch(e:any){setNotice(e.message||"Falha ao iniciar chamada.");}
    finally{setBusy(false);}
  }
  async function finishCall(){
    if(!selected)return;
    setBusy(true);setNotice("");
    try{
      const response=await fetch("/api/calls",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({action:"finish",lead_id:selected.id,call_id:callId||undefined,resultado:result})});
      const payload=await response.json();
      if(!response.ok)throw new Error(payload?.error?.message||"Não foi possível finalizar a ligação.");
      const nextStatus=result==="Não Perturbe"?"NPO":result==="Sem interesse"?"SEM_INTERESSE":result==="Retornar"?"LIGAR_DEPOIS":"FINALIZADO";
      await supabase.from("leads").update({status:nextStatus}).eq("id",selected.id);
      setCallId("");setNotice("Ligação finalizada e histórico salvo.");await refreshLeads();
    }catch(e:any){setNotice(e.message||"Falha ao finalizar chamada.");}
    finally{setBusy(false);}
  }
  async function importSpreadsheet(file?:File){
    if(!file)return;
    if(!canManage){setNotice("Somente administrador ou gestor pode importar listas.");return;}
    setBusy(true);setNotice("");setFileName(file.name);
    let imported=0,skipped=0;
    try{
      const parsed=await parseFile(file);
      for(const row of parsed.rows){
        if(!row.nome||(!row.telefone&&!row.telefone2)){skipped++;continue;}
        const {data:lead,error}=await supabase.from("leads").insert({
          nome:row.nome,cpf:row.cpf||null,telefone:row.telefone||row.telefone2||null,
          produto:row.produto||null,banco:row.banco||null,cidade:row.cidade||null,uf:row.uf||null,
          observacoes:row.observacao||null,dados_extras:row.extras||{},status:"DISPONIVEL"
        }).select("id").single();
        if(error||!lead){skipped++;continue;}
        const numbers=[row.telefone,row.telefone2].filter(Boolean);
        if(numbers.length){
          const {error:phoneError}=await supabase.from("telefones").insert(numbers.map((n:string,i:number)=>({
            lead_id:lead.id,numero:n,numero_normalizado:n,tipo:"celular",principal:i===0,ativo:true
          })));
          if(phoneError) console.warn("Falha ao salvar telefone secundário",phoneError.message);
        }
        imported++;
      }
      await supabase.from("importacoes_leads").insert({operador_id:operator.id,nome_arquivo:file.name,total_linhas:parsed.total,importados:imported,ignorados:skipped,status:"concluida"});
      await refreshLeads();
      setNotice(`Importação concluída: ${imported} leads adicionados; ${skipped} ignorados (duplicados ou incompletos).`);
    }catch(e:any){setNotice(e.message||"Não foi possível ler a planilha.");}
    finally{setBusy(false);}
  }
  async function saveScript(){
    if(!editingScript)return;
    setBusy(true);setNotice("");
    const {error}=await supabase.from("scripts_ligacao").update({conteudo:scriptText,updated_at:new Date().toISOString()}).eq("id",editingScript.id);
    if(error)setNotice(error.message);
    else{setScripts(prev=>prev.map(s=>s.id===editingScript.id?{...s,conteudo:scriptText}:s));setNotice("Script atualizado para todos os leads deste produto.");}
    setBusy(false);
  }
  async function addNpd(){
    const cpf=digits(npdCpf),telefone=digits(npdPhone);
    if(!cpf&&!telefone){setNotice("Informe CPF ou telefone para bloquear.");return;}
    setBusy(true);
    const {data,error}=await supabase.from("lista_nao_perturbe").insert({cpf:cpf||null,telefone:telefone||null,motivo:npdReason||"Solicitação de não contato",created_by:operator.id,ativo:true}).select("*").single();
    if(error)setNotice(error.message);
    else{setBlocked(prev=>[data,...prev]);setNpdCpf("");setNpdPhone("");setNpdReason("");setNotice("Contato adicionado à lista Não Perturbe.");}
    setBusy(false);
  }
  async function changeStatus(lead:Lead,status:string){
    const {error}=await supabase.from("leads").update({status}).eq("id",lead.id);
    if(error)setNotice(error.message);else{setLeads(prev=>prev.map(l=>l.id===lead.id?{...l,status}:l));setNotice("Status do lead atualizado.");}
  }

  return <main className="min-h-screen bg-[#070b14] text-slate-100">
    <header className="border-b border-slate-800 bg-[#0c1322] px-4 py-4 md:px-8">
      <div className="mx-auto flex max-w-[1500px] flex-wrap items-center justify-between gap-3">
        <div><div className="text-xs font-bold uppercase tracking-[.2em] text-blue-400">A&K Soluções Financeiras</div><h1 className="text-2xl font-black tracking-tight">AK Call Center</h1><p className="text-sm text-slate-400">Operação • {operator.nome} • {operator.perfil}</p></div>
        <form action="/auth/signout" method="post"><button className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800">Sair</button></form>
      </div>
    </header>
    <div className="mx-auto grid max-w-[1500px] gap-5 p-4 md:grid-cols-[230px_1fr] md:p-8">
      <aside className="flex gap-2 overflow-x-auto md:flex-col">
        {([["discadora","Discadora"],["leads","Leads e listas"],["scripts","Scripts de ligação"],["npd","Não Perturbe"]] as const).map(([key,label])=><button key={key} onClick={()=>setTab(key)} className={`whitespace-nowrap rounded-xl px-4 py-3 text-left text-sm font-bold transition ${tab===key?"bg-blue-600 text-white":"border border-slate-800 bg-slate-900 text-slate-300 hover:bg-slate-800"}`}>{label}</button>)}
        <div className="mt-4 hidden rounded-xl border border-slate-800 bg-slate-900 p-4 text-xs text-slate-400 md:block"><b className="text-slate-200">Proteção ativa</b><p className="mt-2">Chamadas registradas no histórico e bloqueios Não Perturbe verificados pelo servidor.</p></div>
      </aside>
      <section className="min-w-0 space-y-5">
        {notice&&<div className="rounded-xl border border-blue-500/30 bg-blue-500/10 px-4 py-3 text-sm text-blue-100">{notice}</div>}
        {tab==="discadora"&&<div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(320px,.8fr)]">
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-bold">Fila de atendimento</h2><p className="text-sm text-slate-400">{filtered.length} leads carregados</p></div><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar nome, CPF ou telefone" className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none focus:border-blue-500 sm:max-w-xs"/></div>
            <div className="max-h-[620px] space-y-2 overflow-auto pr-1">
              {filtered.map(lead=><button key={lead.id} onClick={()=>{setSelectedId(lead.id);setCallId("");}} className={`w-full rounded-xl border p-4 text-left transition ${selectedId===lead.id?"border-blue-500 bg-blue-500/10":"border-slate-800 bg-slate-950/60 hover:border-slate-600"}`}>
                <div className="flex flex-wrap items-center justify-between gap-2"><b>{lead.nome}</b><span className="rounded-full bg-slate-800 px-2 py-1 text-[11px] text-slate-300">{statusLabel[lead.status]||lead.status}</span></div>
                <div className="mt-1 text-sm text-slate-400">{lead.telefone||"Sem telefone"} • {lead.produto||"Atendimento"}</div>
              </button>)}
              {!filtered.length&&<p className="py-12 text-center text-sm text-slate-500">Nenhum lead encontrado. Importe uma planilha na aba Leads e listas.</p>}
            </div>
          </div>
          <div className="space-y-5">
            <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
              <div className="text-xs font-bold uppercase tracking-widest text-blue-400">Lead selecionado</div>
              {selected?<><h2 className="mt-2 text-2xl font-black">{selected.nome}</h2><p className="mt-1 text-slate-400">{selected.cpf||"CPF não informado"} • {selected.cidade||"Cidade não informada"}{selected.uf?"/"+selected.uf:""}</p><div className="mt-4 rounded-xl bg-slate-950 p-4"><div className="text-xs text-slate-500">Telefone</div><div className="text-2xl font-bold tracking-wide">{selected.telefone||"—"}</div><div className="mt-2 text-sm text-slate-400">{selected.produto||"Atendimento"}{selected.banco?" • Banco: "+selected.banco:""}</div></div>
                <div className="mt-4 flex flex-wrap gap-2"><button disabled={busy||!selected.telefone} onClick={startCall} className="rounded-xl bg-emerald-600 px-5 py-3 font-bold text-white hover:bg-emerald-500 disabled:opacity-50">Ligar pelo celular</button><button disabled={busy||!callId} onClick={finishCall} className="rounded-xl border border-slate-700 px-4 py-3 font-bold text-slate-200 disabled:opacity-40">Finalizar chamada</button></div>
                <div className="mt-4 grid grid-cols-2 gap-2"><label className="col-span-2 text-xs text-slate-400">Tabulação da chamada</label><select value={result} onChange={e=>setResult(e.target.value)} className="col-span-2 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm">{["Atendido","Não atendeu","Caixa postal","Retornar","Sem interesse","Não Perturbe","Finalizado"].map(v=><option key={v}>{v}</option>)}</select></div>
                <div className="mt-4"><label className="text-xs text-slate-400">Status do lead</label><select value={selected.status} onChange={e=>changeStatus(selected,e.target.value)} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm">{STATUS.map(v=><option key={v} value={v}>{statusLabel[v]}</option>)}</select></div>
                {selected.observacoes&&<p className="mt-4 whitespace-pre-wrap text-sm text-slate-400">{selected.observacoes}</p>}
              </>:<p className="py-12 text-center text-slate-500">Selecione um lead da fila.</p>}
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
              <div className="flex items-center justify-between gap-2"><div><div className="text-xs font-bold uppercase tracking-widest text-blue-400">Roteiro de ligação</div><h3 className="mt-1 text-lg font-bold">{activeScript?.nome||productKey(selected?.produto||null)}</h3></div><button onClick={()=>{setTab("scripts");setScriptText(activeScript?.conteudo||"");}} className="text-xs font-bold text-blue-400">Editar scripts</button></div>
              <pre className="mt-3 max-h-80 overflow-auto whitespace-pre-wrap rounded-xl bg-slate-950 p-4 text-sm leading-6 text-slate-200">{(activeScript?.conteudo||"Script padrão indisponível.").replaceAll("[NOME]",selected?.nome||"[NOME]")}</pre>
            </div>
          </div>
        </div>}
        {tab==="leads"&&<div className="rounded-2xl border border-slate-800 bg-slate-900 p-5"><h2 className="text-xl font-bold">Leads e importação</h2><p className="mt-1 text-sm text-slate-400">Importe arquivos XLS, XLSX, CSV ou TXT. Os dados originais da planilha são preservados em dados_extras.</p>{canManage?<label className="mt-5 flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-blue-500/50 bg-blue-500/5 p-8 text-center hover:bg-blue-500/10"><span className="text-lg font-bold">Selecionar planilha</span><span className="mt-1 text-sm text-slate-400">{fileName||"Clique para escolher um arquivo"}</span><input type="file" accept=".xls,.xlsx,.csv,.txt" className="hidden" disabled={busy} onChange={e=>void importSpreadsheet(e.target.files?.[0])}/></label>:<p className="mt-4 rounded-lg bg-slate-950 p-4 text-sm text-slate-400">A importação está disponível para administrador e gestor.</p>}<div className="mt-5 grid gap-3 sm:grid-cols-3"><div className="rounded-xl bg-slate-950 p-4"><div className="text-sm text-slate-500">Leads visíveis</div><div className="text-2xl font-black">{leads.length}</div></div><div className="rounded-xl bg-slate-950 p-4"><div className="text-sm text-slate-500">Disponíveis</div><div className="text-2xl font-black">{leads.filter(l=>l.status==="DISPONIVEL").length}</div></div><div className="rounded-xl bg-slate-950 p-4"><div className="text-sm text-slate-500">Retornos</div><div className="text-2xl font-black">{leads.filter(l=>l.status==="LIGAR_DEPOIS").length}</div></div></div></div>}
        {tab==="scripts"&&<div className="grid gap-5 lg:grid-cols-[260px_1fr]"><div className="rounded-2xl border border-slate-800 bg-slate-900 p-4"><h2 className="mb-3 font-bold">Produtos</h2>{scripts.map(s=><button key={s.id} onClick={()=>{setEditingScriptId(s.id);setScriptText(s.conteudo);}} className={`mb-1 w-full rounded-lg px-3 py-2 text-left text-sm ${scriptText===s.conteudo?"bg-blue-600 text-white":"text-slate-300 hover:bg-slate-800"}`}>{s.nome}</button>)}</div><div className="rounded-2xl border border-slate-800 bg-slate-900 p-5"><h2 className="text-xl font-bold">Scripts de ligação</h2><p className="mt-1 text-sm text-slate-400">A alteração é compartilhada com todos os leads do mesmo produto.</p><textarea value={scriptText||editingScript?.conteudo||""} onChange={e=>setScriptText(e.target.value)} rows={20} className="mt-4 w-full rounded-xl border border-slate-700 bg-slate-950 p-4 text-sm leading-6 outline-none focus:border-blue-500"/><button disabled={!canManage||!editingScript||busy} onClick={saveScript} className="mt-3 rounded-xl bg-blue-600 px-5 py-3 font-bold disabled:opacity-40">Salvar script selecionado</button><p className="mt-2 text-xs text-slate-500">Selecione um produto na lista para editar. Somente administrador pode salvar.</p></div></div>}
        {tab==="npd"&&<div className="grid gap-5 lg:grid-cols-[minmax(280px,.8fr)_1.2fr]"><div className="rounded-2xl border border-slate-800 bg-slate-900 p-5"><h2 className="text-xl font-bold">Não Perturbe</h2><p className="mt-1 text-sm text-slate-400">Cadastre CPF ou telefone para impedir novas chamadas.</p><input value={npdCpf} onChange={e=>setNpdCpf(e.target.value)} placeholder="CPF" className="mt-4 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-3"/><input value={npdPhone} onChange={e=>setNpdPhone(e.target.value)} placeholder="Telefone" className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-3"/><input value={npdReason} onChange={e=>setNpdReason(e.target.value)} placeholder="Motivo (opcional)" className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-3"/><button disabled={!canManage||busy} onClick={addNpd} className="mt-3 w-full rounded-xl bg-rose-600 px-4 py-3 font-bold disabled:opacity-40">Bloquear contato</button>{!canManage&&<p className="mt-2 text-xs text-slate-500">Somente administrador ou gestor pode alterar a lista.</p>}</div><div className="rounded-2xl border border-slate-800 bg-slate-900 p-5"><h3 className="font-bold">Bloqueios ativos ({blocked.length})</h3><div className="mt-3 max-h-[520px] space-y-2 overflow-auto">{blocked.map(b=><div key={b.id} className="rounded-lg bg-slate-950 p-3 text-sm"><b>{b.cpf||b.telefone}</b><p className="text-xs text-slate-500">{b.motivo||"Sem motivo informado"}</p></div>)}{!blocked.length&&<p className="py-10 text-center text-sm text-slate-500">Nenhum bloqueio cadastrado.</p>}</div></div></div>}
      </section>
    </div>
  </main>;
}
