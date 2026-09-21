"use client";
import {useEffect,useMemo,useState} from "react";
import {supabase} from "@/lib/supabase";
import {parseFile,phone,cpf} from "@/lib/importer";

type Lead={id:string;nome:string;cpf?:string;cidade?:string;uf?:string;produto?:string;status:string;prioridade:number;bloqueado:boolean;opt_out:boolean;telefones?:{id:string;numero_normalizado:string}[]};
type Stage={id:string;nome:string;cor:string;ordem:number};
type Campaign={id:string;nome:string;produto?:string;status:string;created_at:string;inicio_at?:string;fim_at?:string};
type ReturnRow={id:string;lead_id:string;operador_id?:string;data_hora:string;observacao?:string;concluido:boolean;lead?:any};
type UserRow={id:string;nome:string;email?:string;perfil:string;ativo:boolean;auth_user_id?:string;permissoes?:Record<string,boolean>;preferencias?:Record<string,any>};
const results=["Interessado","Retorno","Simulação","Proposta","Contrato","Não atendeu","Não interessado","Número inválido","Sem perfil"];
const mask=(v="")=>v.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/,"$1.$2.$3-$4");
const initials=(v="")=>v.split(" ").filter(Boolean).slice(0,2).map(x=>x[0]).join("").toUpperCase();

export default function Home(){
 const[session,setSession]=useState<any>(null),[operator,setOperator]=useState<any>(null),[mode,setMode]=useState("dashboard");
 const[leads,setLeads]=useState<Lead[]>([]),[npd,setNpd]=useState<any[]>([]),[stages,setStages]=useState<Stage[]>([]),[campaigns,setCampaigns]=useState<Campaign[]>([]),[returns,setReturns]=useState<ReturnRow[]>([]),[calls,setCalls]=useState<any[]>([]),[users,setUsers]=useState<UserRow[]>([]);
 const[loading,setLoading]=useState(false),[error,setError]=useState(""),[showImport,setShowImport]=useState(false),[previews,setPreviews]=useState<any[]>([]),[files,setFiles]=useState<File[]>([]),[msg,setMsg]=useState("");
 const[search,setSearch]=useState(""),[page,setPage]=useState(1),[selectedLead,setSelectedLead]=useState<Lead|null>(null),[authReady,setAuthReady]=useState(false),[recovery,setRecovery]=useState(false),[channelConfig,setChannelConfig]=useState<any>(null),[dialerConfig,setDialerConfig]=useState<any>(null);
 const pageSize=50;
 const[debouncedSearch,setDebouncedSearch]=useState("");
 useEffect(()=>{const t=setTimeout(()=>setDebouncedSearch(search),250);return()=>clearTimeout(t)},[search]);
 const filtered=useMemo(()=>leads.filter(l=>[l.nome,l.cpf,l.cidade,l.uf,l.produto,l.status].join(" ").toLowerCase().includes(debouncedSearch.toLowerCase())),[leads,debouncedSearch]);
 const paged=filtered.slice((page-1)*pageSize,page*pageSize);
 const available=useMemo(()=>leads.filter(l=>l.status==="disponivel"&&!l.bloqueado&&!l.opt_out&&l.telefones?.length),[leads]);
 const current=available[0];

 useEffect(()=>{
  if(!supabase){setError("Conexão com o banco não foi carregada. Verifique as variáveis NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY na Vercel.");setAuthReady(true);return}
  let alive=true;
  supabase.auth.getSession().then(({data,error})=>{if(!alive)return;if(error)setError(error.message);setSession(data.session);setAuthReady(true)});
  const{data}=supabase.auth.onAuthStateChange((event,s)=>{
   if(event==="PASSWORD_RECOVERY")setRecovery(true);
   if(event==="SIGNED_OUT")setSession(null);
   else if(s)setSession(s);
  });
  return()=>{alive=false;data.subscription.unsubscribe()};
 },[]);
 useEffect(()=>{if(session){load();loadOperator()}},[session]);
 useEffect(()=>setPage(1),[search]);

 async function load(){
  if(!supabase)return;
  setLoading(true);setError("");
  const [a,b,c,d,e,f]=await Promise.all([
   supabase.from("leads").select("*,telefones(id,numero_normalizado)").order("prioridade",{ascending:false}).order("created_at",{ascending:false}).limit(1000),
   supabase.from("lista_nao_perturbe").select("*").eq("ativo",true).order("data_bloqueio",{ascending:false}).limit(1000),
   supabase.from("crm_etapas").select("*").eq("ativo",true).order("ordem"),
   supabase.from("campanhas").select("*").neq("status","removida").order("created_at",{ascending:false}).limit(100),
   supabase.from("retornos").select("*,leads(id,nome,cpf,cidade,uf,produto,telefones(id,numero_normalizado))").eq("concluido",false).order("data_hora",{ascending:true}).limit(2000),
   supabase.from("ligacoes").select("*,leads(id,nome,cpf)").order("created_at",{ascending:false}).limit(5000)
  ]);
  const first=a.error||b.error||c.error||d.error||e.error||f.error;
  if(first)setError(first.message);
  setLeads((a.data||[]) as Lead[]);setNpd(b.data||[]);setStages(c.data||[]);setCampaigns((d.data||[]) as Campaign[]);setReturns((e.data||[]) as ReturnRow[]);setCalls(f.data||[]);setLoading(false);
}
  async function loadOperator(){
  if(!supabase||!session?.user?.id)return;
  const{data,error}=await supabase.from("operadores").select("*").eq("auth_user_id",session.user.id).maybeSingle();
  if(error){setError(error.message);return}
  setOperator(data);
  if(!data)return;
  const [cc,dc]=await Promise.all([
    supabase.from("configuracoes_canais").select("*").eq("operador_id",data.id).maybeSingle(),
    supabase.from("configuracoes_discador").select("*").eq("operador_id",data.id).maybeSingle()
  ]);
  if(cc.error)setError(cc.error.message);else setChannelConfig(cc.data);
  if(dc.error)setError(dc.error.message);else setDialerConfig(dc.data);
  if(data.perfil==="admin"){
    const{data:all,error:ue}=await supabase.from("operadores").select("*").order("created_at",{ascending:true});
    if(ue)setError(ue.message);else setUsers((all||[]) as UserRow[]);
  }else setUsers([data as UserRow]);
}
async function audit(acao:string,entidade?:string,entidade_id?:string,detalhes?:any){
  if(!supabase||!operator?.id)return;
  await supabase.from("auditoria").insert({operador_id:operator.id,acao,entidade:entidade||null,entidade_id:entidade_id||null,detalhes:detalhes||{}});
}
  async function auth(email:string,password:string,signup:boolean,nome:string){
  if(!supabase){setError("Banco não configurado.");return}
  setError("");setMsg("");
  if(!email||!password){setError("Informe e-mail e senha.");return}
  if(password.length<8){setError("Use uma senha com pelo menos 8 caracteres.");return}
  const r=signup?await supabase.auth.signUp({email,password,options:{data:{nome},emailRedirectTo:window.location.origin}}):await supabase.auth.signInWithPassword({email,password});
  if(r.error){setError(r.error.message);return}
  if(signup&&!r.data.session){setMsg("Cadastro criado. Confirme seu e-mail para liberar o primeiro acesso. Se o e-mail não chegar, confira Spam/Lixo eletrônico.");return}
  setMsg("Acesso autorizado.");setSession(r.data.session);
 }
 async function resetPassword(email:string){
  if(!supabase||!email){setError("Informe seu e-mail.");return}
  setError("");const r=await supabase.auth.resetPasswordForEmail(email,{redirectTo:window.location.origin});
  if(r.error)setError(r.error.message);else setMsg("Link de recuperação enviado. Abra o e-mail e defina uma nova senha.");
 }
 async function updatePassword(password:string){
  if(!supabase){return}
  if(password.length<8){setError("A nova senha precisa ter pelo menos 8 caracteres.");return}
  const{error}=await supabase.auth.updateUser({password});
  if(error)setError(error.message);else{setRecovery(false);setMsg("Senha alterada com sucesso. Você já pode usar a central.");}
 }
 async function doImport(){
  if(!supabase||!files.length||!previews.length)return;
  setLoading(true);setError("");setMsg("");
  let adicionados=0,duplicados=0,bloqueados=0,semTelefone=0,importados=0;
  try{
    for(let i=0;i<files.length;i++){
      const file=files[i],preview=previews[i];
      const{data:imp,error:ie}=await supabase.from("importacoes").insert({nome_arquivo:file.name,extensao:preview.ext,total:preview.total,validos:0,duplicados:0,invalidos:preview.total-preview.validos,sem_telefone:0,mapeamento:preview.map}).select().single();
      if(ie)throw ie;
      const rows=preview.rows.map((r:any)=>({nome:String(r.nome||"").trim(),cpf:r.cpf||null,cidade:r.cidade||"",uf:r.uf||"",produto:r.produto||"",observacao:r.observacao||"",extras:r.extras||{},telefone_original:r.telefone||"",telefone_normalizado:phone(r.telefone||"")||null,telefone2_original:r.telefone2||"",telefone2_normalizado:phone(r.telefone2||"")||null}));
      const{data:result,error:re}=await supabase.rpc("import_leads_batch",{p_importacao_id:imp.id,p_rows:rows});
      if(re)throw re;
      const s=result||{};adicionados+=Number(s.adicionados||0);duplicados+=Number(s.duplicados||0);bloqueados+=Number(s.bloqueados||0);semTelefone+=Number(s.sem_telefone||0);importados++;
      await audit("importacao_concluida","importacoes",imp.id,s);
    }
    setMsg(importados+" arquivo(s) importado(s): "+adicionados+" adicionados • "+duplicados+" duplicados • "+bloqueados+" bloqueados • "+semTelefone+" sem telefone.");
    setShowImport(false);setPreviews([]);setFiles([]);await load();
  }catch(e:any){setError("Erro na importação: "+(e?.message||"não foi possível processar os arquivos."));}
  finally{setLoading(false);}
}
async function callResult(result:string){
  if(!supabase||!current)return;
  if(result==="Retorno")return;
  const t=current.telefones?.[0],now=new Date().toISOString();
  const{error:e}=await supabase.from("ligacoes").insert({lead_id:current.id,telefone_id:t?.id,operador_id:operator?.id,inicio:now,fim:now,resultado:result});
  if(e){setError(e.message);return}
  const statusMap:Record<string,string>={"Número inválido":"numero_invalido","Sem perfil":"sem_perfil","Não interessado":"nao_interessado","Não atendeu":"nao_atendeu","Interessado":"interessado","Simulação":"simulação","Proposta":"proposta","Contrato":"contrato"};
  const status=statusMap[result]||"finalizado";
  const{error:ue}=await supabase.from("leads").update({status,updated_at:now}).eq("id",current.id);
  if(ue){setError(ue.message);return}
  await audit("ligacao_tabular","leads",current.id,{resultado:result,status});
  await load();
}
async function scheduleReturn(dateTime:string,observacao:string){
  if(!supabase||!current||!dateTime)return;
  const t=current.telefones?.[0],now=new Date().toISOString(),when=new Date(dateTime).toISOString();
  if(new Date(when).getTime()<=Date.now()){setError("Escolha uma data e hora futura para o retorno.");return}
  const{error:e}=await supabase.from("ligacoes").insert({lead_id:current.id,telefone_id:t?.id,operador_id:operator?.id,inicio:now,fim:now,resultado:"Retorno",observacao:observacao||null});
  if(e){setError(e.message);return}
  const{error:r}=await supabase.from("retornos").insert({lead_id:current.id,operador_id:operator?.id,data_hora:when,observacao:observacao||null,concluido:false});
  if(r){setError(r.message);return}
  const{error:ue}=await supabase.from("leads").update({status:"retorno",updated_at:now}).eq("id",current.id);
  if(ue){setError(ue.message);return}
  await audit("retorno_agendado","leads",current.id,{data_hora:when,observacao});
  await load();
}
  async function block(){
  if(!supabase||!current)return;
  const tel=current.telefones?.[0]?.numero_normalizado||"";
  const{error:e}=await supabase.from("lista_nao_perturbe").insert({cpf:cpf(current.cpf||"")||null,telefone:phone(tel)||null,nome:current.nome,origem:"manual",motivo:"Solicitação de não contato",operador_id:operator?.id});
  if(e){setError(e.message);return}
  await supabase.from("leads").update({bloqueado:true,opt_out:true,status:"bloqueado",updated_at:new Date().toISOString()}).eq("id",current.id);
  await audit("bloqueio_npd","leads",current.id);await load();
 }
 async function moveLead(id:string,status:string){
  if(!supabase)return;
  const{error:e}=await supabase.from("leads").update({status,updated_at:new Date().toISOString()}).eq("id",id);
  if(e)setError(e.message);else{await audit("crm_movimentacao","leads",id,{status});await load()}
 }

async function createCampaign(data:{nome:string;produto:string;inicio_at?:string;fim_at?:string}){
  if(!supabase||!operator||!data.nome.trim())return;
  const{error:e}=await supabase.from("campanhas").insert({nome:data.nome.trim(),produto:data.produto||"Consignado",status:"ativa",inicio_at:data.inicio_at||null,fim_at:data.fim_at||null});
  if(e)setError(e.message);else{await audit("campanha_criada","campanhas",undefined,data);await load()}
}
async function toggleCampaign(id:string,status:string){
  if(!supabase)return;
  const next=status==="ativa"?"pausada":"ativa";
  const{error:e}=await supabase.from("campanhas").update({status:next}).eq("id",id);
  if(e)setError(e.message);else{await audit("campanha_status","campanhas",id,{status:next});await load()}
}
async function deleteCampaign(id:string){
  if(!supabase)return;
  if(!window.confirm("Remover esta campanha? O histórico de ligações continuará registrado."))return;
  const{error:e}=await supabase.from("campanhas").update({status:"removida"}).eq("id",id);
  if(e)setError(e.message);else{await audit("campanha_removida","campanhas",id);await load()}
}
async function updateReturn(id:string,data:{data_hora:string;observacao:string}){
  if(!supabase)return;
  const{error:e}=await supabase.from("retornos").update({data_hora:new Date(data.data_hora).toISOString(),observacao:data.observacao||null}).eq("id",id);
  if(e)setError(e.message);else{await audit("retorno_reagendado","retornos",id,data);await load()}
}
async function concludeReturn(row:ReturnRow){
  if(!supabase)return;
  const{error:e}=await supabase.from("retornos").update({concluido:true}).eq("id",row.id);
  if(e){setError(e.message);return}
  await supabase.from("leads").update({status:"disponivel",updated_at:new Date().toISOString()}).eq("id",row.lead_id);
  await audit("retorno_concluido","retornos",row.id);await load();
}
async function removeNpd(row:any){
  if(!supabase)return;
  const{error:e}=await supabase.from("lista_nao_perturbe").update({ativo:false}).eq("id",row.id);
  if(e){setError(e.message);return}
  if(row.cpf){
    await supabase.from("leads").update({bloqueado:false,opt_out:false,status:"disponivel",updated_at:new Date().toISOString()}).eq("cpf",row.cpf);
  }else if(row.telefone){
    const{data:ts}=await supabase.from("telefones").select("lead_id").eq("numero_normalizado",row.telefone).limit(20);
    const ids=(ts||[]).map((x:any)=>x.lead_id);
    if(ids.length)await supabase.from("leads").update({bloqueado:false,opt_out:false,status:"disponivel",updated_at:new Date().toISOString()}).in("id",ids);
  }
  await audit("npd_removido","lista_nao_perturbe",row.id);await load();
}
async function saveUserConfig(id:string,permissoes:Record<string,boolean>,preferencias:Record<string,any>,ativo:boolean,perfil:string){
  if(!supabase||operator?.perfil!=="admin")return;
  const{error:e}=await supabase.from("operadores").update({permissoes,preferencias,ativo,perfil}).eq("id",id);
  if(e)setError(e.message);else{await audit("usuario_configurado","operadores",id,{permissoes,preferencias,ativo,perfil});await loadOperator();setMsg("Configuração do usuário salva.")}
}
async function saveChannelsFor(targetId:string,data:any){
  if(!supabase||!operator)return;
  if(targetId!==operator.id&&operator.perfil!=="admin")return;
  const{error:e}=await supabase.from("configuracoes_canais").upsert({...data,operador_id:targetId},{onConflict:"operador_id"});
  if(e)setError(e.message);else{if(targetId===operator.id)setChannelConfig({...channelConfig,...data});await audit("canais_configurados","configuracoes_canais",targetId);setMsg("Configurações de canais salvas.")}
}
async function saveChannels(data:any){if(operator)await saveChannelsFor(operator.id,data)}
async function saveDialerFor(targetId:string,data:any){
  if(!supabase||!operator)return;
  if(targetId!==operator.id&&operator.perfil!=="admin")return;
  const payload={...data,operador_id:targetId,updated_at:new Date().toISOString()};
  const{error:e}=await supabase.from("configuracoes_discador").upsert(payload,{onConflict:"operador_id"});
  if(e)setError(e.message);else{if(targetId===operator.id)setDialerConfig({...dialerConfig,...data});await audit("telefonia_configurada","configuracoes_discador",targetId);setMsg("Configuração de telefonia/Discador salva.")}
}
async function saveDialer(data:any){if(operator)await saveDialerFor(operator.id,data)}

 if(!authReady)return <div className="boot"><div className="bootLogo">A<span>&</span>K</div><div className="spinner"/><p>Inicializando central segura...</p></div>;
 if(!session||recovery)return <AuthScreen recovery={recovery} onAuth={auth} reset={resetPassword} updatePassword={updatePassword} msg={msg} error={error}/>;

 const allNav=[
  ["dashboard","Visão geral","⌂"],["discador","Discador","☎"],["crm","CRM","◆"],["resultados","Resultados","↳"],["leads","Leads","◉"],["campanhas","Campanhas","▣"],["retornos","Retornos","◷"],["telefonia","Telefonia","◌"],["mensagens","Omnichannel","✉"],["relatorios","Relatórios","▥"],["npd","Não Perturbe","⊘"],["config","Configurações","⚙"]
 ] as const;
 const nav=allNav.filter(x=>operator?.perfil==="admin"||operator?.permissoes?.[x[0]]!==false);
 return <div className="app">
  <aside className="sidebar">
   <div className="brand"><b>A<span>&</span>K</b><small>CALL CENTER</small></div>
   <div className="operator"><div className="avatar">{initials(operator?.nome||session.user.email)}</div><div><b>{operator?.nome||"Operador"}</b><small>{operator?.perfil==="admin"?"proprietário":operator?.perfil||"operador"}</small></div></div>
   <nav>{nav.map(([id,label,icon])=><button key={id} className={mode===id?"active":""} onClick={()=>setMode(id)}><i>{icon}</i>{label}</button>)}</nav>
   <button className="btn primary full" onClick={()=>setShowImport(true)}>＋ Importar lista</button>
   <button className="btn dark full" onClick={()=>supabase?.auth.signOut()}>Sair</button>
   <div className="sidefoot">A&K Soluções Financeiras<br/><span>Soluções que fazem sentido para você.</span></div>
  </aside>
  <main className="content">
   <header className="header"><div><div className="eyebrow">CENTRAL OPERACIONAL • ONLINE</div><h1>{nav.find(x=>x[0]===mode)?.[1]}</h1><p>Operação de consignado, CRM e telefonia em um único painel.</p></div><div className="headActions"><span className="online"><b/> Sistema online</span><button className="btn primary" onClick={()=>setShowImport(true)}>＋ Nova importação</button></div></header>
   {error&&<div className="alert error"><b>Erro:</b> {error}<button onClick={()=>setError("")}>×</button></div>}
   {msg&&<div className="alert success">{msg}<button onClick={()=>setMsg("")}>×</button></div>}
   {mode==="dashboard"&&<Dashboard leads={leads} available={available.length} npd={npd.length} campaigns={campaigns.length} loading={loading}/>}
   {mode==="discador"&&<Dialer lead={current} available={available.length} onCall={()=>current?.telefones?.[0]&&(window.location.href="tel:+"+current.telefones[0].numero_normalizado)} onResult={callResult} onReturn={scheduleReturn} onBlock={block}/>}
   {mode==="crm"&&<CRM leads={leads} stages={stages} onMove={moveLead} onOpen={setSelectedLead}/>}\n   {mode==="resultados"&&<OperationalResults leads={leads} onOpen={setSelectedLead}/>}
   {mode==="leads"&&<Leads leads={paged} loading={loading} search={search} setSearch={setSearch} page={page} setPage={setPage} total={filtered.length} pageSize={pageSize} onOpen={setSelectedLead}/>}
   {mode==="campanhas"&&<Campaigns rows={campaigns} onCreate={createCampaign} onToggle={toggleCampaign} onDelete={deleteCampaign}/>}
   {mode==="retornos"&&<Returns rows={returns} onOpenLead={setSelectedLead} onSave={updateReturn} onConclude={concludeReturn}/>}
   {mode==="telefonia"&&<Telephony config={dialerConfig} onSave={saveDialer}/>}
   {mode==="mensagens"&&<Omnichannel config={channelConfig} onSave={saveChannels}/>}
   {mode==="relatorios"&&<Reports leads={leads} npd={npd} calls={calls} returns={returns}/>}
   {mode==="npd"&&<Npd rows={npd} onRemove={removeNpd}/>}
   {mode==="config"&&<Settings operator={operator} users={users} onSaveUser={saveUserConfig} channelConfig={channelConfig} onSaveChannels={saveChannelsFor} dialerConfig={dialerConfig} onSaveDialer={saveDialerFor}/>}
   {selectedLead&&<LeadDrawer lead={selectedLead} onClose={()=>setSelectedLead(null)} onMove={moveLead} stages={stages}/>}
   {showImport&&<ImportModal files={files} previews={previews} onFiles={async selected=>{setError("");setFiles(selected);try{setPreviews(await Promise.all(selected.map(f=>parseFile(f))))}catch{setPreviews([]);setError("Não foi possível ler uma das planilhas. Verifique se os arquivos estão íntegros.")}}} onClose={()=>{setShowImport(false);setPreviews([]);setFiles([]);setMsg("")}} onImport={doImport} loading={loading}/>}
  </main>
 </div>;
}

function AuthScreen({recovery,onAuth,reset,updatePassword,msg,error}:{recovery:boolean;onAuth:(e:string,p:string,s:boolean,n:string)=>void;reset:(e:string)=>void;updatePassword:(p:string)=>void;msg:string;error:string}){
 const[e,setE]=useState(""),[p,setP]=useState(""),[n,setN]=useState(""),[s,setS]=useState(false),[forgot,setForgot]=useState(false),[terms,setTerms]=useState(false),[busy,setBusy]=useState(false);
 const submit=async()=>{setBusy(true);try{if(forgot)await reset(e);else if(recovery)await updatePassword(p);else await onAuth(e,p,s,n)}finally{setBusy(false)}};
 if(recovery)return <div className="auth"><div className="authHero"><div className="heroLogo">A<span>&</span>K</div><h1>Recupere o controle da sua operação.</h1><p>Defina uma nova senha e volte para a central.</p></div><div className="authPanel"><div className="authBox"><div className="mobileLogo">A<span>&</span>K</div><div className="eyebrow">RECUPERAÇÃO SEGURA</div><h2>Nova senha</h2><p className="muted">Escolha uma senha com pelo menos 8 caracteres.</p><div className="field"><label>Nova senha</label><input autoFocus type="password" value={p} onChange={x=>setP(x.target.value)} placeholder="••••••••"/></div>{(error||msg)&&<div className={error?"notice danger":"notice"}>{error||msg}</div>}<button className="btn primary full big" disabled={busy} onClick={submit}>{busy?"Salvando...":"Alterar senha"}</button></div></div></div>;
 return <div className="auth"><div className="authHero"><div className="heroLogo">A<span>&</span>K</div><h1>Central inteligente para operações de consignado.</h1><p>Discador, CRM, mailing, retornos, bloqueios e indicadores em uma experiência única.</p><div className="heroBadges"><span>CRM integrado</span><span>Fila operacional</span><span>LGPD & auditoria</span></div></div><div className="authPanel"><div className="authBox"><div className="mobileLogo">A<span>&</span>K</div><div className="eyebrow">A&K SOLUÇÕES FINANCEIRAS</div><h2>{forgot?"Recuperar acesso":s?"Criar proprietário":"Entrar na central"}</h2><p className="muted">{forgot?"Envie um link para seu e-mail.":s?"O primeiro cadastro deste projeto recebe automaticamente o perfil proprietário/admin.":"Use seu e-mail e senha para acessar."}</p>{s&&!forgot&&<div className="field"><label>Nome</label><input value={n} onChange={x=>setN(x.target.value)} placeholder="Seu nome"/></div>}<div className="field"><label>E-mail</label><input type="email" value={e} onChange={x=>setE(x.target.value)} placeholder="voce@empresa.com"/></div>{!forgot&&<div className="field"><label>Senha</label><input type="password" value={p} onChange={x=>setP(x.target.value)} placeholder="Mínimo 8 caracteres"/></div>}{s&&!forgot&&<label className="check"><input type="checkbox" checked={terms} onChange={x=>setTerms(x.target.checked)}/><span>Li e aceito os <a href="/termos" target="_blank">Termos de Uso</a> e a <a href="/privacidade" target="_blank">Política de Privacidade</a>.</span></label>}{(error||msg)&&<div className={error?"notice danger":"notice"}>{error||msg}</div>}<button className="btn primary full big" disabled={busy||(s&&!terms)} onClick={submit}>{busy?"Processando...":forgot?"Enviar recuperação":s?"Criar minha conta":"Entrar"}</button><div className="authLinks">{!forgot&&<button onClick={()=>setS(!s)}>{s?"Já tenho acesso":"Primeiro acesso"}</button>}<button onClick={()=>{setForgot(!forgot);setS(false)}}>{forgot?"Voltar ao login":"Esqueci minha senha"}</button></div><small className="authNote">Se o cadastro exigir confirmação, o e-mail precisa ser confirmado antes do primeiro login.</small></div></div></div>;
}

function Dashboard({leads,available,npd,campaigns,loading}:{leads:Lead[];available:number;npd:number;campaigns:number;loading:boolean}){
 const interested=leads.filter(x=>["interessado","simulação","proposta","contrato"].includes(x.status)).length;
 return <div className="stack"><div className="metricGrid"><Metric title="Leads na base" value={leads.length} icon="◉" hint="mailing carregado"/><Metric title="Na fila" value={available} icon="☎" hint="prontos para contato"/><Metric title="Oportunidades" value={interested} icon="↗" hint="interesse ou proposta"/><Metric title="Não Perturbe" value={npd} icon="⊘" hint="bloqueios ativos"/><Metric title="Campanhas" value={campaigns} icon="▣" hint="cadastradas"/></div><div className="dashboardGrid"><div className="panel heroPanel"><div><div className="eyebrow light">OPERAÇÃO DE HOJE</div><h2>Central pronta para trabalhar.</h2><p>Importe seu mailing, organize o funil no CRM e use a fila para registrar cada resultado.</p><button className="btn lightBtn" onClick={()=>document.querySelector<HTMLButtonElement>(".sidebar .primary")?.click()}>Importar mailing</button></div><div className="bigNumber">{available}<small>contatos disponíveis</small></div></div><div className="panel"><PanelTitle title="Fluxo operacional" subtitle="Do mailing ao fechamento."/><div className="flow"><div><b>01</b><span>Importar</span><small>XLS, XLSX, ODS, CSV</small></div><div><b>02</b><span>Filtrar</span><small>Duplicados + NPD</small></div><div><b>03</b><span>Contatar</span><small>Fila + click-to-call</small></div><div><b>04</b><span>Converter</span><small>CRM + retornos</small></div></div></div></div>{loading&&<div className="loadingbar"/>}</div>;
}
function Metric({title,value,icon,hint}:{title:string;value:number;icon:string;hint:string}){return <div className="panel metric"><div className="metricIcon">{icon}</div><div><span>{title}</span><strong>{value}</strong><small>{hint}</small></div></div>}
function PanelTitle({title,subtitle}:{title:string;subtitle:string}){return <div className="panelTitle"><div><h3>{title}</h3><p>{subtitle}</p></div></div>}

function Dialer({lead,available,onCall,onResult,onReturn,onBlock}:{lead?:Lead;available:number;onCall:()=>void;onResult:(r:string)=>void;onReturn:(dateTime:string,observacao:string)=>void;onBlock:()=>void}){
 const[mode,setMode]=useState("preview"),[showReturn,setShowReturn]=useState(false),[dateTime,setDateTime]=useState(()=>{const d=new Date(Date.now()+86400000);d.setHours(9,0,0,0);return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,16)}),[obs,setObs]=useState("");
 return <div className="stack"><div className="modeBar"><div><b>Modo de discagem</b><small>Controle operacional. A discagem real depende da telefonia conectada.</small></div><div className="modeBtns">{[["preview","Preview"],["power","Power"],["preditivo","Preditivo"],["blended","Blended"]].map(x=><button className={mode===x[0]?"sel":""} key={x[0]} onClick={()=>setMode(x[0])}>{x[1]}</button>)}</div></div><div className="dialGrid"><section className="panel callPanel"><div className="dialHeader"><span className="statusDot"/>Fila ativa <b>{available}</b></div>{lead?<><div className="person"><div className="personAvatar">{initials(lead.nome)}</div><div><div className="eyebrow">PRÓXIMO CONTATO</div><h2>{lead.nome}</h2><p>{lead.cidade||"Cidade não informada"} {lead.uf&&"• "+lead.uf}</p></div></div><div className="dialNumber">{lead.telefones?.[0]?.numero_normalizado||"Sem telefone"}</div><div className="callActions"><button className="btn callBtn" onClick={onCall}>☎ LIGAR AGORA</button><button className="btn" onClick={()=>setShowReturn(true)}>◷ Agendar retorno</button><button className="btn dangerBtn" onClick={onBlock}>⊘ Não ligar mais</button></div></>:<Empty title="Fila vazia" text="Importe uma lista para iniciar a operação."/>}</section><section className="panel"><PanelTitle title="Tabulação" subtitle="Registre o resultado para avançar."/><div className="resultGrid">{results.map(r=><button key={r} onClick={()=>r==="Retorno"?setShowReturn(true):onResult(r)}>{r}</button>)}</div><div className="info">Número inválido → <b>CRM / Resultados operacionais / Número inválido</b>. Sem perfil → <b>CRM / Resultados operacionais / Sem perfil</b>. Não atendeu e Não interessado também ficam rastreáveis no CRM e nos relatórios.</div></section></div>{showReturn&&<div className="modal" onClick={()=>setShowReturn(false)}><div className="modalBox smallModal" onClick={e=>e.stopPropagation()}><div className="toolbar"><div><div className="eyebrow">RETORNO</div><h2>Agendar retorno</h2><p>{lead?.nome}</p></div><button className="btn" onClick={()=>setShowReturn(false)}>Fechar</button></div><div className="field"><label>Data e hora</label><input type="datetime-local" value={dateTime} min={new Date(Date.now()-new Date().getTimezoneOffset()*60000).toISOString().slice(0,16)} onChange={e=>setDateTime(e.target.value)}/></div><div className="field"><label>Observação</label><textarea className="textarea" value={obs} onChange={e=>setObs(e.target.value)} placeholder="Ex.: retornar após 15h, enviar simulação..."/></div><button className="btn primary full big" onClick={()=>{onReturn(dateTime,obs);setShowReturn(false);setObs("")}}>Salvar e próximo lead</button></div></div>}</div>
}
function CRM({leads,stages,onMove,onOpen}:{leads:Lead[];stages:Stage[];onMove:(id:string,s:string)=>void;onOpen:(l:Lead)=>void}){
 return <div className="stack"><div className="panel"><PanelTitle title="CRM / Esteira de vendas" subtitle="Leads por etapa. Clique em um cliente para abrir a ficha."/><div className="kanban">{stages.map(s=><div className="kanbanCol" key={s.id}><div className="kanbanHead"><span style={{background:s.cor}}/>{s.nome}<b>{leads.filter(l=>l.status===s.nome.toLowerCase()).length}</b></div>{leads.filter(l=>l.status===s.nome.toLowerCase()).slice(0,30).map(l=><button className="leadCard" key={l.id} onClick={()=>onOpen(l)}><div className="miniAvatar">{initials(l.nome)}</div><div><b>{l.nome}</b><small>{l.produto||"Consignado"} • {l.cidade||"—"}</small></div><span>›</span></button>)}{!leads.some(l=>l.status===s.nome.toLowerCase())&&<div className="emptyCol">Sem registros</div>}</div>)}</div></div></div>
}
function OperationalResults({leads,onOpen}:{leads:Lead[];onOpen:(l:Lead)=>void}){
 const groups=[["numero_invalido","Número inválido"],["sem_perfil","Sem perfil"],["nao_atendeu","Não atendeu"],["nao_interessado","Não interessado"],["finalizado","Finalizado"]];
 const[filter,setFilter]=useState("numero_invalido");
 const rows=leads.filter(l=>l.status===filter);
 return <div className="stack"><div className="panel"><PanelTitle title="Resultados operacionais" subtitle="Destinos claros para cada resultado da tabulação do discador."/><div className="resultTabs">{groups.map(([id,label])=><button key={id} className={filter===id?"sel":""} onClick={()=>setFilter(id)}>{label}<span>{leads.filter(l=>l.status===id).length}</span></button>)}</div></div><div className="panel"><div className="toolbar"><PanelTitle title={groups.find(x=>x[0]===filter)?.[1]||"Resultado"} subtitle={rows.length+" lead(s) nesta categoria."}/><span className="pill">CRM / Resultados</span></div><div className="tableWrap"><table><thead><tr><th>Cliente</th><th>CPF</th><th>Telefone</th><th>Produto</th><th>Ação</th></tr></thead><tbody>{rows.map(l=><tr key={l.id}><td><b>{l.nome}</b></td><td>{l.cpf?mask(l.cpf):"—"}</td><td>{l.telefones?.[0]?.numero_normalizado||"—"}</td><td>{l.produto||"—"}</td><td><button className="tableBtn" onClick={()=>onOpen(l)}>Abrir ficha</button>{l.telefones?.[0]?.numero_normalizado&&<a className="tableBtn callLink" href={"tel:+"+l.telefones[0].numero_normalizado}>☎ Ligar</a>}</td></tr>)}</tbody></table>{!rows.length&&<Empty title="Nenhum lead nesta categoria" text="Os próximos resultados tabulados pelo discador aparecerão aqui."/>}</div></div></div>
}
function Leads({leads,loading,search,setSearch,page,setPage,total,pageSize,onOpen}:{leads:Lead[];loading:boolean;search:string;setSearch:(x:string)=>void;page:number;setPage:(x:number)=>void;total:number;pageSize:number;onOpen:(l:Lead)=>void}){const pages=Math.max(1,Math.ceil(total/pageSize));return <div className="panel"><div className="toolbar"><div><h3>Base de leads</h3><p>{total} registros no conjunto carregado.</p></div><input className="search" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar nome, CPF, cidade, produto..."/></div><div className="tableWrap"><table><thead><tr><th>Cliente</th><th>Telefone</th><th>Produto</th><th>Status</th><th/></tr></thead><tbody>{leads.map(l=><tr key={l.id}><td><b>{l.nome}</b><small>{l.cpf?mask(l.cpf):"CPF não informado"}</small></td><td>{l.telefones?.[0]?.numero_normalizado||"—"}</td><td>{l.produto||"—"}</td><td><span className="pill">{l.status}</span></td><td><button className="tableBtn" onClick={()=>onOpen(l)}>Abrir</button></td></tr>)}</tbody></table>{!leads.length&&!loading&&<Empty title="Nenhum lead encontrado" text="Importe uma lista ou altere a busca."/>}</div><div className="pagination"><span>Página {page} de {pages}</span><div><button disabled={page<=1} onClick={()=>setPage(page-1)}>←</button><button disabled={page>=pages} onClick={()=>setPage(page+1)}>→</button></div></div></div>}
function Campaigns({rows,onCreate,onToggle,onDelete}:{rows:Campaign[];onCreate:(d:{nome:string;produto:string;inicio_at?:string;fim_at?:string})=>void;onToggle:(id:string,status:string)=>void;onDelete:(id:string)=>void}){
 const[open,setOpen]=useState(false),[nome,setNome]=useState(""),[produto,setProduto]=useState("Consignado"),[inicio,setInicio]=useState(""),[fim,setFim]=useState("");
 const effective=(c:Campaign)=>{const now=Date.now();if(c.status==="pausada")return "pausada";if(c.fim_at&&new Date(c.fim_at).getTime()<now)return "encerrada";if(c.inicio_at&&new Date(c.inicio_at).getTime()>now)return "agendada";return c.status};
 const submit=()=>{if(!nome.trim())return;if(inicio&&fim&&new Date(fim)<=new Date(inicio)){alert("O fim precisa ser depois do início.");return}onCreate({nome,produto,inicio_at:inicio?new Date(inicio).toISOString():undefined,fim_at:fim?new Date(fim).toISOString():undefined});setNome("");setProduto("Consignado");setInicio("");setFim("");setOpen(false)};
 return <div className="panel"><div className="toolbar"><PanelTitle title="Campanhas" subtitle="Crie, programe, ative, pause e remova campanhas."/><button className="btn primary" onClick={()=>setOpen(true)}>＋ Nova campanha</button></div><div className="campaignGrid">{rows.map(c=>{const st=effective(c);return <div className="campaignCard" key={c.id}><div className="campaignIcon">▣</div><div className="campaignMain"><b>{c.nome}</b><small>{c.produto||"Sem produto"} • {st}</small><small>{c.inicio_at?"Início: "+new Date(c.inicio_at).toLocaleString("pt-BR"):"Sem início"}{c.fim_at?" → "+new Date(c.fim_at).toLocaleString("pt-BR"):""}</small></div><div className="campaignActions"><span className={"pill "+(st==="ativa"?"":"warning")}>{st}</span><button className="tableBtn" disabled={st==="encerrada"} onClick={()=>onToggle(c.id,c.status)}>{st==="ativa"?"Desativar":"Ativar"}</button><button className="tableBtn dangerText" onClick={()=>onDelete(c.id)}>Remover</button></div></div>})}{!rows.length&&<Empty title="Nenhuma campanha" text="Crie a primeira campanha para organizar a operação."/>}</div>{open&&<div className="modal" onClick={()=>setOpen(false)}><div className="modalBox smallModal" onClick={e=>e.stopPropagation()}><div className="toolbar"><div><div className="eyebrow">NOVA CAMPANHA</div><h2>Programar campanha</h2><p>Defina quando ela deve ficar ativa.</p></div><button className="btn" onClick={()=>setOpen(false)}>Fechar</button></div><div className="field"><label>Nome</label><input value={nome} onChange={e=>setNome(e.target.value)} placeholder="Ex.: INSS Setembro"/></div><div className="field"><label>Produto</label><input value={produto} onChange={e=>setProduto(e.target.value)} placeholder="Consignado"/></div><div className="twoFields"><div className="field"><label>Início</label><input type="datetime-local" value={inicio} onChange={e=>setInicio(e.target.value)}/></div><div className="field"><label>Fim</label><input type="datetime-local" value={fim} onChange={e=>setFim(e.target.value)}/></div></div><div className="info">Se o início estiver no futuro, a campanha ficará <b>Agendada</b>. Após o fim, ficará <b>Encerrada</b> automaticamente na interface.</div><button className="btn primary full big" onClick={submit}>Salvar campanha</button></div></div>}</div>
}
function Returns({rows,onOpenLead,onSave,onConclude}:{rows:ReturnRow[];onOpenLead:(l:Lead)=>void;onSave:(id:string,d:{data_hora:string;observacao:string})=>void;onConclude:(r:ReturnRow)=>void}){
 const[month,setMonth]=useState(new Date().toISOString().slice(0,7)),[day,setDay]=useState<number|null>(null),[edit,setEdit]=useState<ReturnRow|null>(null),[dateTime,setDateTime]=useState(""),[obs,setObs]=useState("");
 const monthRows=rows.filter(r=>r.data_hora.slice(0,7)===month), selected=day?monthRows.filter(r=>new Date(r.data_hora).getDate()===day):monthRows;
 const first=new Date(month+"-01T00:00:00"), start=(first.getDay()+6)%7, days=new Date(first.getFullYear(),first.getMonth()+1,0).getDate();
 const openEdit=(r:ReturnRow)=>{setEdit(r);const d=new Date(r.data_hora);setDateTime(new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,16));setObs(r.observacao||"")};
 return <div className="stack"><div className="panel"><div className="toolbar"><PanelTitle title="Retornos" subtitle="Calendário dos próximos contatos e fila de retorno."/><input className="monthInput" type="month" value={month} onChange={e=>{setMonth(e.target.value);setDay(null)}}/></div><div className="calendar"><div className="calendarHead">{["Seg","Ter","Qua","Qui","Sex","Sáb","Dom"].map(x=><b key={x}>{x}</b>)}</div><div className="calendarGrid">{Array.from({length:start}).map((_,i)=><span className="calendarBlank" key={"b"+i}/>) }{Array.from({length:days}).map((_,i)=>{const d=i+1,count=monthRows.filter(r=>new Date(r.data_hora).getDate()===d).length;return <button key={d} className={day===d?"calendarDay selectedDay":"calendarDay"} onClick={()=>setDay(day===d?null:d)}><b>{d}</b>{count>0&&<span>{count}</span>}</button>})}</div></div></div><div className="panel"><PanelTitle title={day?"Retornos do dia "+day:"Todos os retornos do mês"} subtitle={selected.length+" retorno(s) pendente(s)."}/><div className="tableWrap"><table><thead><tr><th>Data/hora</th><th>Cliente</th><th>Telefone</th><th>Observação</th><th>Ações</th></tr></thead><tbody>{selected.map(r=>{const l=r.lead||{};return <tr key={r.id}><td><b>{new Date(r.data_hora).toLocaleString("pt-BR",{dateStyle:"short",timeStyle:"short"})}</b></td><td><button className="linkBtn" onClick={()=>l.id&&onOpenLead(l as Lead)}>{l.nome||r.lead_id}</button></td><td>{l.telefones?.[0]?.numero_normalizado?<a className="tableBtn" href={"tel:+"+l.telefones[0].numero_normalizado}>☎ Retornar</a>:"—"}</td><td>{r.observacao||"—"}</td><td><div className="rowActions"><button className="tableBtn" onClick={()=>openEdit(r)}>Reagendar</button><button className="tableBtn" onClick={()=>onConclude(r)}>Concluir</button></div></td></tr>})}</tbody></table>{!selected.length&&<Empty title="Nenhum retorno" text="Use Agendar retorno no Discador para criar o próximo contato."/>}</div></div>{edit&&<div className="modal" onClick={()=>setEdit(null)}><div className="modalBox smallModal" onClick={e=>e.stopPropagation()}><div className="toolbar"><div><div className="eyebrow">RETORNO</div><h2>Reagendar</h2><p>{edit.lead?.nome||"Cliente"}</p></div><button className="btn" onClick={()=>setEdit(null)}>Fechar</button></div><div className="field"><label>Data e hora</label><input type="datetime-local" value={dateTime} onChange={e=>setDateTime(e.target.value)}/></div><div className="field"><label>Observação</label><textarea className="textarea" value={obs} onChange={e=>setObs(e.target.value)}/></div><button className="btn primary full big" onClick={()=>{onSave(edit.id,{data_hora:dateTime,observacao:obs});setEdit(null)}}>Salvar retorno</button></div></div>}</div>
}
function Telephony({config,onSave}:{config:any;onSave:(d:any)=>void}){
 const[form,setForm]=useState<any>(()=>({modo:config?.modo||"preview",chamadas_simultaneas:config?.chamadas_simultaneas||1,retentativas:config?.retentativas||2,intervalo_segundos:config?.intervalo_segundos||30,ativo:config?.ativo??true,regras:config?.regras||{sip_host:"",ramal:"",fila:"",ura:"",horario:"",gravacao:true,monitoria:true}}));
 useEffect(()=>setForm({modo:config?.modo||"preview",chamadas_simultaneas:config?.chamadas_simultaneas||1,retentativas:config?.retentativas||2,intervalo_segundos:config?.intervalo_segundos||30,ativo:config?.ativo??true,regras:config?.regras||{sip_host:"",ramal:"",fila:"",ura:"",horario:"",gravacao:true,monitoria:true}}),[config]);
 const set=(k:string,v:any)=>setForm((x:any)=>({...x,[k]:v}));const setR=(k:string,v:any)=>setForm((x:any)=>({...x,regras:{...x.regras,[k]:v}}));
 return <div className="stack"><div className="featureGrid"><div className="panel feature"><div className="featureTop"><div className="featureIcon">☎</div><span>Configurável</span></div><h3>Discador / CTI</h3><p>Escolha o modo e os limites da operação. A execução da chamada depende da telefonia conectada.</p><div className="twoFields"><div className="field"><label>Modo</label><select value={form.modo} onChange={e=>set("modo",e.target.value)}><option value="preview">Preview</option><option value="power">Power</option><option value="preditivo">Preditivo</option><option value="blended">Blended</option></select></div><div className="field"><label>Chamadas simultâneas</label><input type="number" min="1" max="20" value={form.chamadas_simultaneas} onChange={e=>set("chamadas_simultaneas",Number(e.target.value))}/></div></div><div className="twoFields"><div className="field"><label>Retentativas</label><input type="number" min="0" max="20" value={form.retentativas} onChange={e=>set("retentativas",Number(e.target.value))}/></div><div className="field"><label>Intervalo (segundos)</label><input type="number" min="0" max="3600" value={form.intervalo_segundos} onChange={e=>set("intervalo_segundos",Number(e.target.value))}/></div></div><label className="switchRow"><input type="checkbox" checked={form.ativo} onChange={e=>set("ativo",e.target.checked)}/><span>Discador ativo</span></label></div><div className="panel feature"><div className="featureTop"><div className="featureIcon">⚙</div><span>Avançado</span></div><h3>PABX, URA, filas e gravações</h3><p>Deixe os parâmetros prontos para quando você conectar um provedor SIP/WebRTC.</p>{["sip_host","ramal","fila","ura","horario"].map(k=><div className="field" key={k}><label>{k==="sip_host"?"Servidor SIP":k==="ramal"?"Ramal":k==="fila"?"Fila":k==="ura"?"URA":"Horário de operação"}</label><input value={form.regras?.[k]||""} onChange={e=>setR(k,e.target.value)} placeholder={k==="sip_host"?"sip.exemplo.com.br":""}/></div>)}<label className="switchRow"><input type="checkbox" checked={form.regras?.gravacao!==false} onChange={e=>setR("gravacao",e.target.checked)}/><span>Gravação habilitada quando o provedor suportar</span></label><label className="switchRow"><input type="checkbox" checked={form.regras?.monitoria!==false} onChange={e=>setR("monitoria",e.target.checked)}/><span>Monitoria habilitada quando o provedor suportar</span></label><button className="btn primary full" onClick={()=>onSave(form)}>Salvar configurações de telefonia</button></div></div></div>
}
function Omnichannel({config,onSave}:{config:any;onSave:(d:any)=>void}){
 const[tab,setTab]=useState("whatsapp"),[form,setForm]=useState<any>(()=>config||{whatsapp_numero:"",whatsapp_business_account_id:"",whatsapp_phone_number_id:"",instagram_usuario:"",messenger_page_id:"",email_endereco:"",sms_provedor:"",ia_ativa:false,configuracoes:{mensagem_inicial:"",horario:"",ia_instrucoes:""}});
 useEffect(()=>{if(config)setForm(config)},[config]);
 const set=(k:string,v:any)=>setForm((x:any)=>({...x,[k]:v}));const setC=(k:string,v:any)=>setForm((x:any)=>({...x,configuracoes:{...x.configuracoes,[k]:v}}));
 return <div className="stack"><div className="panel"><div className="channelTabs">{[["whatsapp","WhatsApp"],["instagram","Instagram"],["messenger","Messenger"],["email","E-mail"],["sms","SMS"],["ia","IA"]].map(x=><button key={x[0]} className={tab===x[0]?"sel":""} onClick={()=>setTab(x[0])}>{x[1]}</button>)}</div>{tab==="whatsapp"&&<div className="channelBody"><div><div className="eyebrow">WHATSAPP BUSINESS</div><h2>Conectar o WhatsApp da empresa</h2><p className="muted">Cadastre os identificadores da conta. A API oficial precisa ser configurada no backend para envio e recebimento reais.</p></div><div className="twoFields"><div className="field"><label>Número da empresa</label><input value={form.whatsapp_numero||""} onChange={e=>set("whatsapp_numero",e.target.value)} placeholder="5579999999999"/></div><div className="field"><label>Phone Number ID</label><input value={form.whatsapp_phone_number_id||""} onChange={e=>set("whatsapp_phone_number_id",e.target.value)} placeholder="ID fornecido pela Meta"/></div></div><div className="field"><label>WhatsApp Business Account ID (WABA)</label><input value={form.whatsapp_business_account_id||""} onChange={e=>set("whatsapp_business_account_id",e.target.value)} /></div><div className="twoFields"><div className="field"><label>Mensagem inicial</label><textarea className="textarea" value={form.configuracoes?.mensagem_inicial||""} onChange={e=>setC("mensagem_inicial",e.target.value)} placeholder="Olá! Como posso ajudar?"/></div><div className="field"><label>Horário de atendimento</label><input value={form.configuracoes?.horario||""} onChange={e=>setC("horario",e.target.value)} placeholder="08h às 18h"/></div></div><div className="actionRow"><button className="btn primary" onClick={()=>onSave(form)}>Salvar WhatsApp</button>{form.whatsapp_numero&&<a className="btn" target="_blank" rel="noreferrer" href={"https://wa.me/"+String(form.whatsapp_numero).replace(/\D/g,"")}>Abrir WhatsApp</a>}</div></div>}{tab==="instagram"&&<div className="channelBody"><h2>Instagram</h2><p className="muted">Cadastre o usuário da empresa para a operação.</p><div className="field"><label>Usuário Instagram</label><input value={form.instagram_usuario||""} onChange={e=>set("instagram_usuario",e.target.value)} placeholder="@suaempresa"/></div><button className="btn primary" onClick={()=>onSave(form)}>Salvar Instagram</button></div>}{tab==="messenger"&&<div className="channelBody"><h2>Messenger</h2><div className="field"><label>Page ID</label><input value={form.messenger_page_id||""} onChange={e=>set("messenger_page_id",e.target.value)} /></div><button className="btn primary" onClick={()=>onSave(form)}>Salvar Messenger</button></div>}{tab==="email"&&<div className="channelBody"><h2>E-mail</h2><div className="field"><label>Endereço operacional</label><input type="email" value={form.email_endereco||""} onChange={e=>set("email_endereco",e.target.value)} placeholder="atendimento@empresa.com"/></div><button className="btn primary" onClick={()=>onSave(form)}>Salvar E-mail</button></div>}{tab==="sms"&&<div className="channelBody"><h2>SMS</h2><div className="field"><label>Provedor</label><input value={form.sms_provedor||""} onChange={e=>set("sms_provedor",e.target.value)} placeholder="Nome/API do provedor"/></div><button className="btn primary" onClick={()=>onSave(form)}>Salvar SMS</button></div>}{tab==="ia"&&<div className="channelBody"><h2>IA de atendimento</h2><label className="switchRow"><input type="checkbox" checked={form.ia_ativa||false} onChange={e=>set("ia_ativa",e.target.checked)}/><span>Ativar classificação, resumo e sugestões de resposta</span></label><div className="field"><label>Instruções da IA</label><textarea className="textarea" value={form.configuracoes?.ia_instrucoes||""} onChange={e=>setC("ia_instrucoes",e.target.value)} placeholder="Ex.: seja cordial, objetivo e confirme dados antes da simulação."/></div><button className="btn primary" onClick={()=>onSave(form)}>Salvar IA</button></div>}</div><div className="panel"><PanelTitle title="Status da integração" subtitle="Configuração operacional do canal."/><div className="info">Os identificadores podem ser cadastrados agora. Para mensagens oficiais, a Meta exige conta WhatsApp Business, número empresarial e autenticação da API; o token deve permanecer no backend.</div></div></div>
}
function Feature({title,state,text}:{title:string;state:string;text:string}){return <div className="panel feature"><div className="featureTop"><div className="featureIcon">◆</div><span>{state}</span></div><h3>{title}</h3><p>{text}</p><button className="btn" onClick={()=>alert("Módulo de infraestrutura preparado. A conexão real depende do provedor e das credenciais da sua operação.")}>Ver arquitetura</button></div>}
function Reports({leads,npd,calls,returns}:{leads:Lead[];npd:any[];calls:any[];returns:ReturnRow[]}){
 const[month,setMonth]=useState(new Date().toISOString().slice(0,7)),[day,setDay]=useState<number|null>(null);
 const monthCalls=calls.filter(c=>String(c.created_at||"").slice(0,7)===month),monthReturns=returns.filter(r=>r.data_hora.slice(0,7)===month);
 const total=monthCalls.length,contracts=monthCalls.filter(c=>c.resultado==="Contrato").length,opportunities=monthCalls.filter(c=>["Interessado","Simulação","Proposta","Contrato"].includes(c.resultado)).length;
 const first=new Date(month+"-01T00:00:00"),start=(first.getDay()+6)%7,days=new Date(first.getFullYear(),first.getMonth()+1,0).getDate();
 const dayCalls=day?monthCalls.filter(c=>new Date(c.created_at).getDate()===day):monthCalls,dayReturns=day?monthReturns.filter(r=>new Date(r.data_hora).getDate()===day):monthReturns;
 const download=()=>{const header=["Data","Hora","Cliente","Tipo","Resultado","Observação"];const lines=[...monthCalls.map(c=>[new Date(c.created_at).toLocaleDateString("pt-BR"),new Date(c.created_at).toLocaleTimeString("pt-BR"),c.leads?.nome||"", "Ligação",c.resultado||"",c.observacao||""]),...monthReturns.map(r=>[new Date(r.data_hora).toLocaleDateString("pt-BR"),new Date(r.data_hora).toLocaleTimeString("pt-BR"),r.lead?.nome||"","Retorno","Agendado",r.observacao||""])];const csv=[header,...lines].map(row=>row.map((v:any)=>'"'+String(v).replace(/"/g,'""')+'"').join(";")).join("\n");const blob=new Blob(["\\ufeff"+csv],{type:"text/csv;charset=utf-8"}),url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download="AK_relatorio_"+month+".csv";a.click();URL.revokeObjectURL(url)};
 const totalByDay=(d:number)=>monthCalls.filter(c=>new Date(c.created_at).getDate()===d).length+monthReturns.filter(r=>new Date(r.data_hora).getDate()===d).length;
 return <div className="stack"><div className="panel reportHeader"><div className="toolbar"><PanelTitle title="Relatório mensal" subtitle="Escolha o mês, navegue pelo calendário e filtre o relatório."/><div className="actionRow"><input className="monthInput" type="month" value={month} onChange={e=>{setMonth(e.target.value);setDay(null)}}/><button className="btn primary" onClick={download}>↓ Baixar relatório CSV</button></div></div><div className="metricGrid"><Metric title="Ligações" value={total} icon="☎" hint="no mês selecionado"/><Metric title="Oportunidades" value={opportunities} icon="↗" hint="interesse, simulação, proposta ou contrato"/><Metric title="Contratos" value={contracts} icon="✓" hint="tabulados no mês"/><Metric title="Retornos" value={monthReturns.length} icon="◷" hint="agendados no mês"/><Metric title="NPD" value={npd.length} icon="⊘" hint="ativos agora"/></div></div><div className="panel"><PanelTitle title="Calendário operacional" subtitle={day?"Dia "+day+" selecionado. Clique novamente para mostrar o mês inteiro.":"Clique em um dia para abrir somente os registros daquele dia."}/><div className="calendar"><div className="calendarHead">{["Seg","Ter","Qua","Qui","Sex","Sáb","Dom"].map(x=><b key={x}>{x}</b>)}</div><div className="calendarGrid">{Array.from({length:start}).map((_,i)=><span className="calendarBlank" key={"x"+i}/>)}{Array.from({length:days}).map((_,i)=>{const d=i+1,n=totalByDay(d);return <button className={"calendarDay reportDay "+(day===d?"selectedDay":"")} key={d} onClick={()=>setDay(day===d?null:d)}><b>{d}</b>{n>0&&<span>{n}</span>}</button>})}</div></div></div><div className="panel"><div className="toolbar"><PanelTitle title={day?"Registros do dia "+day:"Registros do mês"} subtitle={(dayCalls.length+dayReturns.length)+" eventos encontrados."}/><span className="pill">{month}</span></div><div className="tableWrap"><table><thead><tr><th>Data/hora</th><th>Cliente</th><th>Tipo</th><th>Resultado</th><th>Observação</th></tr></thead><tbody>{dayCalls.map(c=><tr key={"c"+c.id}><td>{new Date(c.created_at).toLocaleString("pt-BR",{dateStyle:"short",timeStyle:"short"})}</td><td>{c.leads?.nome||"—"}</td><td>Ligação</td><td><span className="pill">{c.resultado||"—"}</span></td><td>{c.observacao||"—"}</td></tr>)}{dayReturns.map(r=><tr key={"r"+r.id}><td>{new Date(r.data_hora).toLocaleString("pt-BR",{dateStyle:"short",timeStyle:"short"})}</td><td>{r.lead?.nome||"—"}</td><td>Retorno</td><td><span className="pill warning">Agendado</span></td><td>{r.observacao||"—"}</td></tr>)}</tbody></table>{!dayCalls.length&&!dayReturns.length&&<Empty title="Sem registros" text="Não existem eventos para o período selecionado."/>}</div></div></div>
}
function Npd({rows,onRemove}:{rows:any[];onRemove:(r:any)=>void}){
 const[selected,setSelected]=useState<string[]>([]);
 const all=rows.length>0&&selected.length===rows.length;
 const toggle=(id:string)=>setSelected(x=>x.includes(id)?x.filter(v=>v!==id):[...x,id]);
 const removeSelected=()=>{rows.filter(r=>selected.includes(r.id)).forEach(onRemove);setSelected([])};
 return <div className="stack"><div className="panel"><div className="toolbar"><PanelTitle title="Não Perturbe" subtitle="Selecione um ou vários leads para remover o bloqueio e devolver à fila."/><div className="actionRow"><span className="pill">{selected.length} selecionado(s)</span><button className="btn dangerText" disabled={!selected.length} onClick={removeSelected}>Remover selecionados</button></div></div><div className="tableWrap"><table><thead><tr><th><input type="checkbox" checked={all} onChange={e=>setSelected(e.target.checked?rows.map(r=>r.id):[])}/></th><th>Nome</th><th>CPF</th><th>Telefone</th><th>Origem</th><th>Motivo</th><th>Ação</th></tr></thead><tbody>{rows.map(r=><tr key={r.id}><td><input type="checkbox" checked={selected.includes(r.id)} onChange={()=>toggle(r.id)}/></td><td><button className="linkBtn" onClick={()=>toggle(r.id)}><b>{r.nome||"—"}</b></button></td><td>{r.cpf?mask(r.cpf):"—"}</td><td>{r.telefone||"—"}</td><td>{r.origem}</td><td>{r.motivo||"—"}</td><td><button className="tableBtn dangerText" onClick={()=>onRemove(r)}>Remover</button></td></tr>)}</tbody></table>{!rows.length&&<Empty title="Nenhum bloqueio ativo" text="Use o botão Não ligar mais na fila."/>}</div></div></div>
}
function Settings({operator,users,onSaveUser,channelConfig,onSaveChannels,dialerConfig,onSaveDialer}:{operator:any;users:UserRow[];onSaveUser:(id:string,p:Record<string,boolean>,pref:Record<string,any>,ativo:boolean,perfil:string)=>void;channelConfig:any;onSaveChannels:(id:string,d:any)=>void;dialerConfig:any;onSaveDialer:(id:string,d:any)=>void}){
 const isAdmin=operator?.perfil==="admin";const moduleList=[["dashboard","Visão geral"],["discador","Discador"],["crm","CRM"],["resultados","Resultados"],["leads","Leads"],["campanhas","Campanhas"],["retornos","Retornos"],["telefonia","Telefonia"],["mensagens","Omnichannel"],["relatorios","Relatórios"],["npd","Não Perturbe"],["config","Configurações"]];
 const[sel,setSel]=useState<UserRow>(operator||users[0]),[selChannels,setSelChannels]=useState<any>(channelConfig),[selDialer,setSelDialer]=useState<any>(dialerConfig);
 const[perm,setPerm]=useState<Record<string,boolean>>(sel?.permissoes||{}),[ativo,setAtivo]=useState(sel?.ativo??true),[perfil,setPerfil]=useState(sel?.perfil||"operador");
 useEffect(()=>{if(!sel&&operator)setSel(operator);else if(!sel&&users[0])setSel(users[0])},[operator,users,sel]);
 useEffect(()=>{if(sel){setPerm(sel.permissoes||{});setAtivo(sel.ativo);setPerfil(sel.perfil)}},[sel?.id]);
 useEffect(()=>{let live=true;(async()=>{if(!supabase||!sel?.id)return;const [c,d]=await Promise.all([supabase.from("configuracoes_canais").select("*").eq("operador_id",sel.id).maybeSingle(),supabase.from("configuracoes_discador").select("*").eq("operador_id",sel.id).maybeSingle()]);if(live){setSelChannels(c.data||null);setSelDialer(d.data||null)}})();return()=>{live=false}},[sel?.id]);
 if(!isAdmin)return <div className="stack"><div className="panel"><PanelTitle title="Meu usuário" subtitle="Perfil, processos e identidade da conta."/><div className="userIdentity"><div className="avatar largeAvatar">{initials(operator?.nome||"U")}</div><div><h2>{operator?.nome}</h2><p>{operator?.email}</p><span className="pill">{operator?.perfil==="admin"?"Proprietário":operator?.perfil}</span></div></div><div className="permissionGrid">{moduleList.map(([id,label])=><div className="permission" key={id}><span><b>{label}</b><small>{operator?.permissoes?.[id]===false?"Bloqueado":"Liberado"}</small></span></div>)}</div><div className="info">As permissões de um operador são administradas pelo proprietário. Você pode consultar os processos liberados nesta conta.</div><div className="panelSubtle"><b>Processos desta conta</b><p>Os acessos acima podem ser liberados ou bloqueados individualmente no usuário proprietário.</p></div></div><div className="panel"><PanelTitle title="Canais" subtitle="Configurações do seu posto de atendimento."/><Omnichannel config={selChannels} onSave={d=>onSaveChannels(operator.id,d)}/></div><div className="panel"><PanelTitle title="Telefonia" subtitle="Configurações do seu posto."/><Telephony config={selDialer} onSave={d=>onSaveDialer(operator.id,d)}/></div></div>;
 return <div className="stack"><div className="panel"><div className="toolbar"><PanelTitle title="Meu usuário / Usuários" subtitle="Selecione um usuário para configurar acesso, processos, canais e telefonia."/><span className="pill">{users.length} usuário(s)</span></div><div className="userGrid">{users.map(u=><button key={u.id} className={"userCard "+(sel?.id===u.id?"selected":"")} onClick={()=>setSel(u)}><div className="miniAvatar">{initials(u.nome)}</div><div><b>{u.nome}</b><small>{u.email}</small></div><span className={"pill "+(u.ativo?"":"warning")}>{u.ativo?"Ativo":"Inativo"}</span></button>)}</div></div><div className="panel"><div className="toolbar"><PanelTitle title={"Configurar: "+(sel?.nome||"Usuário")} subtitle={sel?.email||""}/><div className="actionRow"><select value={perfil} onChange={e=>setPerfil(e.target.value)}><option value="admin">Proprietário</option><option value="gestor">Gestor</option><option value="operador">Operador</option></select><label className="switchRow compact"><input type="checkbox" checked={ativo} onChange={e=>setAtivo(e.target.checked)}/><span>Ativo</span></label></div></div><div className="permissionGrid">{moduleList.map(([id,label])=><label className="permission" key={id}><input type="checkbox" checked={perm[id]!==false} onChange={e=>setPerm(x=>({...x,[id]:e.target.checked}))}/><span><b>{label}</b><small>{perm[id]===false?"Bloqueado":"Liberado"}</small></span></label>)}</div><button className="btn primary" onClick={()=>sel&&onSaveUser(sel.id,perm,sel.preferencias||{},ativo,perfil)}>Salvar processos e permissões</button></div><div className="panel"><PanelTitle title={"Canais de "+(sel?.nome||"usuário")} subtitle="WhatsApp, Instagram, Messenger, e-mail, SMS e IA."/><Omnichannel config={selChannels} onSave={d=>sel&&onSaveChannels(sel.id,d)}/></div><div className="panel"><PanelTitle title={"Telefonia de "+(sel?.nome||"usuário")} subtitle="Discador, PABX, URA, filas, monitoria e gravações."/><Telephony config={selDialer} onSave={d=>sel&&onSaveDialer(sel.id,d)}/></div><div className="panel"><PanelTitle title="Infraestrutura e segurança" subtitle="Resumo da arquitetura atual."/><div className="featureGrid"><Feature title="Segurança" state="Ativa" text="RLS, auditoria, cabeçalhos de segurança, limite de importação e separação de privilégios no banco."/><Feature title="LGPD operacional" state="Ativa" text="Não Perturbe centralizado, registro de ações e histórico de retornos."/><Feature title="Vercel + Supabase" state="Online" text="Frontend Next.js e PostgreSQL gerenciado, com dados privados protegidos por RLS."/><Feature title="Proprietário" state="Admin" text="Seu usuário tem controle dos processos, canais e telefonia dos demais usuários."/></div></div></div>
}
function LeadDrawer({lead,onClose,onMove,stages}:{lead:Lead;onClose:()=>void;onMove:(id:string,s:string)=>void;stages:Stage[]}){return <div className="drawerBackdrop" onClick={onClose}><aside className="drawer" onClick={e=>e.stopPropagation()}><div className="drawerHead"><div className="personAvatar">{initials(lead.nome)}</div><button className="iconBtn" onClick={onClose}>×</button></div><div className="eyebrow">FICHA DO CLIENTE</div><h2>{lead.nome}</h2><p>{lead.cidade||"—"} {lead.uf&&"• "+lead.uf}</p><div className="drawerPhone">{lead.telefones?.[0]?.numero_normalizado||"Sem telefone"}</div><div className="drawerSection"><b>Etapa do CRM</b>{stages.map(s=><button key={s.id} className={lead.status===s.nome.toLowerCase()?"stageActive":""} onClick={()=>onMove(lead.id,s.nome.toLowerCase())}>{s.nome}</button>)}</div><div className="drawerSection"><b>Dados</b><p>CPF: {lead.cpf?mask(lead.cpf):"não informado"}</p><p>Produto: {lead.produto||"não informado"}</p><p>Prioridade: {lead.prioridade}</p></div></aside></div>}
function ImportModal({files,previews,onFiles,onClose,onImport,loading}:{files:File[];previews:any[];onFiles:(f:File[])=>void;onClose:()=>void;onImport:()=>void;loading:boolean}){return <div className="modal" onClick={onClose}><div className="modalBox" onClick={e=>e.stopPropagation()}><div className="toolbar"><div><div className="eyebrow">IMPORTAÇÃO SEGURA</div><h2>Adicionar mailing</h2><p>XLS • XLSX • ODS • CSV • TXT • vários arquivos de uma vez</p></div><button className="btn" onClick={onClose}>Fechar</button></div><label className="drop"><input type="file" accept=".xls,.xlsx,.ods,.csv,.txt" multiple hidden onChange={e=>onFiles(Array.from(e.target.files||[]))}/><span>↑</span><b>{files.length?files.length+" arquivo(s) selecionado(s)":"Selecione uma ou várias planilhas"}</b><small>Você pode selecionar vários arquivos de uma vez. O sistema detecta nome, CPF, telefone, cidade, UF e produto.</small></label>{files.length>0&&<div className="fileList">{files.map((f,i)=><div key={f.name+"-"+i}><b>{f.name}</b><span>{previews[i]?previews[i].total+" linhas • "+previews[i].validos+" válidas":"lendo..."}</span></div>)}</div>}{previews.length>0&&<><div className="notice"><b>{previews.reduce((n,p)=>n+Number(p.total||0),0)}</b> linhas lidas em <b>{previews.length}</b> arquivo(s).</div><div className="tableWrap preview"><table><thead><tr><th>Nome</th><th>CPF</th><th>Telefone</th><th>Cidade</th><th>Produto</th></tr></thead><tbody>{previews.flatMap(p=>p.rows.slice(0,4)).slice(0,12).map((r:any,i:number)=><tr key={i}><td>{r.nome}</td><td>{r.cpf?mask(r.cpf):""}</td><td>{r.telefone}</td><td>{r.cidade}</td><td>{r.produto}</td></tr>)}</tbody></table></div><button className="btn primary full big" disabled={loading} onClick={onImport}>{loading?"Processando todos os arquivos...":"Importar todos os arquivos"}</button></>}</div></div>}function Empty({title,text}:{title:string;text:string}){return <div className="empty"><b>{title}</b><span>{text}</span></div>}
