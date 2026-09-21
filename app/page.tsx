"use client";
import {useEffect,useMemo,useState} from "react";
import {supabase} from "@/lib/supabase";
import {parseFile,phone,cpf} from "@/lib/importer";

type Lead={id:string;nome:string;cpf?:string;cidade?:string;uf?:string;produto?:string;status:string;prioridade:number;bloqueado:boolean;opt_out:boolean;telefones?:{id:string;numero_normalizado:string}[]};
type Stage={id:string;nome:string;cor:string;ordem:number};
type Campaign={id:string;nome:string;produto?:string;status:string;created_at:string};
const results=["Interessado","Retorno","Simulação","Proposta","Contrato","Não atendeu","Não interessado","Número inválido","Sem perfil"];
const mask=(v="")=>v.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/,"$1.$2.$3-$4");
const initials=(v="")=>v.split(" ").filter(Boolean).slice(0,2).map(x=>x[0]).join("").toUpperCase();

export default function Home(){
 const[session,setSession]=useState<any>(null),[operator,setOperator]=useState<any>(null),[mode,setMode]=useState("dashboard");
 const[leads,setLeads]=useState<Lead[]>([]),[npd,setNpd]=useState<any[]>([]),[stages,setStages]=useState<Stage[]>([]),[campaigns,setCampaigns]=useState<Campaign[]>([]);
 const[loading,setLoading]=useState(false),[error,setError]=useState(""),[showImport,setShowImport]=useState(false),[preview,setPreview]=useState<any>(null),[file,setFile]=useState<File|null>(null),[msg,setMsg]=useState("");
 const[search,setSearch]=useState(""),[page,setPage]=useState(1),[selectedLead,setSelectedLead]=useState<Lead|null>(null),[authReady,setAuthReady]=useState(false),[recovery,setRecovery]=useState(false);
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
  const [a,b,c,d]=await Promise.all([
   supabase.from("leads").select("*,telefones(id,numero_normalizado)").order("prioridade",{ascending:false}).order("created_at",{ascending:false}).limit(1000),
   supabase.from("lista_nao_perturbe").select("*").eq("ativo",true).order("data_bloqueio",{ascending:false}).limit(1000),
   supabase.from("crm_etapas").select("*").eq("ativo",true).order("ordem"),
   supabase.from("campanhas").select("*").order("created_at",{ascending:false}).limit(100)
  ]);
  const first=a.error||b.error||c.error||d.error;
  if(first)setError(first.message);
  setLeads((a.data||[]) as Lead[]);setNpd(b.data||[]);setStages(c.data||[]);setCampaigns(d.data||[]);setLoading(false);
 }
 async function loadOperator(){
  if(!supabase||!session?.user?.id)return;
  const{data,error}=await supabase.from("operadores").select("*").eq("auth_user_id",session.user.id).maybeSingle();
  if(error)setError(error.message);setOperator(data);
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
  if(!supabase||!file||!preview)return;
  setLoading(true);setError("");setMsg("");
  const{data:imp,error:ie}=await supabase.from("importacoes").insert({nome_arquivo:file.name,extensao:preview.ext,total:preview.total,validos:0,duplicados:0,invalidos:preview.total-preview.validos,sem_telefone:0,mapeamento:preview.map}).select().single();
  if(ie){setError(ie.message);setLoading(false);return}
  const rows=preview.rows.map((r:any)=>({nome:String(r.nome||"").trim(),cpf:r.cpf||null,cidade:r.cidade||"",uf:r.uf||"",produto:r.produto||"",observacao:r.observacao||"",extras:r.extras||{},telefone_original:r.telefone||"",telefone_normalizado:phone(r.telefone||"")||null,telefone2_original:r.telefone2||"",telefone2_normalizado:phone(r.telefone2||"")||null}));
  const{data:result,error:re}=await supabase.rpc("import_leads_batch",{p_importacao_id:imp.id,p_rows:rows});
  if(re){setError("Erro na importação: "+re.message);setLoading(false);return}
  const s=result||{};setMsg("Importação concluída: "+(s.adicionados||0)+" adicionados • "+(s.duplicados||0)+" duplicados • "+(s.bloqueados||0)+" bloqueados • "+(s.sem_telefone||0)+" sem telefone.");
  setShowImport(false);setPreview(null);setFile(null);await audit("importacao_concluida","importacoes",imp.id,s);await load();setLoading(false);
 }
 async function callResult(result:string){
  if(!supabase||!current)return;
  const t=current.telefones?.[0],now=new Date().toISOString();
  const{error:e}=await supabase.from("ligacoes").insert({lead_id:current.id,telefone_id:t?.id,operador_id:operator?.id,inicio:now,fim:now,resultado:result});
  if(e){setError(e.message);return}
  const status=result==="Retorno"?"retorno":result==="Interessado"||result==="Simulação"||result==="Proposta"||result==="Contrato"?result.toLowerCase():"finalizado";
  const{error:ue}=await supabase.from("leads").update({status,updated_at:now}).eq("id",current.id);
  if(ue)setError(ue.message);
  if(result==="Retorno")await supabase.from("retornos").insert({lead_id:current.id,operador_id:operator?.id,data_hora:new Date(Date.now()+86400000).toISOString(),observacao:"Retorno criado pela ligação"});
  await audit("ligacao_tabular","leads",current.id,{resultado:result});await load();
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
 async function createCampaign(){
  if(!supabase||!operator)return;
  const nome=prompt("Nome da campanha");if(!nome)return;
  const{error:e}=await supabase.from("campanhas").insert({nome,produto:"Consignado",status:"ativa"});
  if(e)setError(e.message);else{await audit("campanha_criada","campanhas",undefined,{nome});await load()}
 }

 if(!authReady)return <div className="boot"><div className="bootLogo">A<span>&</span>K</div><div className="spinner"/><p>Inicializando central segura...</p></div>;
 if(!session||recovery)return <AuthScreen recovery={recovery} onAuth={auth} reset={resetPassword} updatePassword={updatePassword} msg={msg} error={error}/>;

 const nav=[
  ["dashboard","Visão geral","⌂"],["discador","Discador","☎"],["crm","CRM","◆"],["leads","Leads","◉"],["campanhas","Campanhas","▣"],["retornos","Retornos","◷"],["telefonia","Telefonia","◌"],["mensagens","Omnichannel","✉"],["relatorios","Relatórios","▥"],["npd","Não Perturbe","⊘"],["config","Configurações","⚙"]
 ];
 return <div className="app">
  <aside className="sidebar">
   <div className="brand"><b>A<span>&</span>K</b><small>CALL CENTER</small></div>
   <div className="operator"><div className="avatar">{initials(operator?.nome||session.user.email)}</div><div><b>{operator?.nome||"Operador"}</b><small>{operator?.perfil||"operador"}</small></div></div>
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
   {mode==="discador"&&<Dialer lead={current} available={available.length} onCall={()=>current?.telefones?.[0]&&(window.location.href="tel:+"+current.telefones[0].numero_normalizado)} onResult={callResult} onBlock={block}/>}
   {mode==="crm"&&<CRM leads={leads} stages={stages} onMove={moveLead} onOpen={setSelectedLead}/>}
   {mode==="leads"&&<Leads leads={paged} loading={loading} search={search} setSearch={setSearch} page={page} setPage={setPage} total={filtered.length} pageSize={pageSize} onOpen={setSelectedLead}/>}
   {mode==="campanhas"&&<Campaigns rows={campaigns} onCreate={createCampaign}/>}
   {mode==="retornos"&&<Returns leads={leads}/>}
   {mode==="telefonia"&&<Telephony/>}
   {mode==="mensagens"&&<Omnichannel/>}
   {mode==="relatorios"&&<Reports leads={leads} npd={npd}/>}
   {mode==="npd"&&<Npd rows={npd}/>}
   {mode==="config"&&<Settings operator={operator}/>}
   {selectedLead&&<LeadDrawer lead={selectedLead} onClose={()=>setSelectedLead(null)} onMove={moveLead} stages={stages}/>}
   {showImport&&<ImportModal file={file} setFile={async f=>{setFile(f);if(f)try{setPreview(await parseFile(f))}catch{setError("Não foi possível ler o arquivo. Verifique se a planilha está íntegra.")}}} preview={preview} onClose={()=>{setShowImport(false);setPreview(null);setMsg("")}} onImport={doImport} loading={loading}/>}
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

function Dialer({lead,available,onCall,onResult,onBlock}:{lead?:Lead;available:number;onCall:()=>void;onResult:(r:string)=>void;onBlock:()=>void}){
 const[mode,setMode]=useState("preview");
 return <div className="stack"><div className="modeBar"><div><b>Modo de discagem</b><small>Controle operacional. A discagem real ainda depende de uma operadora/telefonia compatível.</small></div><div className="modeBtns">{[["preview","Preview"],["power","Power"],["preditivo","Preditivo"],["blended","Blended"]].map(x=><button className={mode===x[0]?"sel":""} key={x[0]} onClick={()=>setMode(x[0])}>{x[1]}</button>)}</div></div><div className="dialGrid"><section className="panel callPanel"><div className="dialHeader"><span className="statusDot"/>Fila ativa <b>{available}</b></div>{lead?<><div className="person"><div className="personAvatar">{initials(lead.nome)}</div><div><div className="eyebrow">PRÓXIMO CONTATO</div><h2>{lead.nome}</h2><p>{lead.cidade||"Cidade não informada"} {lead.uf&&"• "+lead.uf}</p></div></div><div className="dialNumber">{lead.telefones?.[0]?.numero_normalizado||"Sem telefone"}</div><div className="callActions"><button className="btn callBtn" onClick={onCall}>☎ LIGAR AGORA</button><button className="btn dangerBtn" onClick={onBlock}>⊘ Não ligar mais</button></div></>:<Empty title="Fila vazia" text="Importe uma lista para iniciar a operação."/>}</section><section className="panel"><PanelTitle title="Tabulação" subtitle="Registre o resultado para avançar."/><div className="resultGrid">{results.map(r=><button key={r} onClick={()=>onResult(r)}>{r}</button>)}</div><div className="info">O botão de chamada usa o protocolo <b>tel:</b> e entrega a ligação ao ambiente configurado no Windows/Phone Link. Não há uma API oficial do Phone Link sendo usada.</div></section></div></div>
}
function CRM({leads,stages,onMove,onOpen}:{leads:Lead[];stages:Stage[];onMove:(id:string,s:string)=>void;onOpen:(l:Lead)=>void}){return <div className="panel"><PanelTitle title="CRM / Esteira de vendas" subtitle="Arraste visualmente pela etapa usando os botões de avanço."/><div className="kanban">{stages.map(s=><div className="kanbanCol" key={s.id}><div className="kanbanHead"><span style={{background:s.cor}}/>{s.nome}<b>{leads.filter(l=>l.status===s.nome.toLowerCase()).length}</b></div>{leads.filter(l=>l.status===s.nome.toLowerCase()).slice(0,30).map(l=><button className="leadCard" key={l.id} onClick={()=>onOpen(l)}><div className="miniAvatar">{initials(l.nome)}</div><div><b>{l.nome}</b><small>{l.produto||"Consignado"} • {l.cidade||"—"}</small></div><span>›</span></button>)}{!leads.some(l=>l.status===s.nome.toLowerCase())&&<div className="emptyCol">Sem registros</div>}</div>)}</div></div>}
function Leads({leads,loading,search,setSearch,page,setPage,total,pageSize,onOpen}:{leads:Lead[];loading:boolean;search:string;setSearch:(x:string)=>void;page:number;setPage:(x:number)=>void;total:number;pageSize:number;onOpen:(l:Lead)=>void}){const pages=Math.max(1,Math.ceil(total/pageSize));return <div className="panel"><div className="toolbar"><div><h3>Base de leads</h3><p>{total} registros no conjunto carregado.</p></div><input className="search" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar nome, CPF, cidade, produto..."/></div><div className="tableWrap"><table><thead><tr><th>Cliente</th><th>Telefone</th><th>Produto</th><th>Status</th><th/></tr></thead><tbody>{leads.map(l=><tr key={l.id}><td><b>{l.nome}</b><small>{l.cpf?mask(l.cpf):"CPF não informado"}</small></td><td>{l.telefones?.[0]?.numero_normalizado||"—"}</td><td>{l.produto||"—"}</td><td><span className="pill">{l.status}</span></td><td><button className="tableBtn" onClick={()=>onOpen(l)}>Abrir</button></td></tr>)}</tbody></table>{!leads.length&&!loading&&<Empty title="Nenhum lead encontrado" text="Importe uma lista ou altere a busca."/>}</div><div className="pagination"><span>Página {page} de {pages}</span><div><button disabled={page<=1} onClick={()=>setPage(page-1)}>←</button><button disabled={page>=pages} onClick={()=>setPage(page+1)}>→</button></div></div></div>}
function Campaigns({rows,onCreate}:{rows:Campaign[];onCreate:()=>void}){return <div className="panel"><div className="toolbar"><PanelTitle title="Campanhas" subtitle="Organize mailings e operações por objetivo."/><button className="btn primary" onClick={onCreate}>＋ Nova campanha</button></div><div className="campaignGrid">{rows.map(c=><div className="campaignCard" key={c.id}><div className="campaignIcon">▣</div><div><b>{c.nome}</b><small>{c.produto||"Sem produto"} • {c.status}</small></div><span className="pill">{c.status}</span></div>)}{!rows.length&&<Empty title="Nenhuma campanha" text="Crie a primeira campanha para organizar a operação."/>}</div></div>}
function Returns({leads}:{leads:Lead[]}){const rows=leads.filter(l=>l.status==="retorno");return <div className="panel"><PanelTitle title="Retornos" subtitle="Fila de contatos que precisam de nova ação."/><div className="tableWrap"><table><thead><tr><th>Cliente</th><th>Telefone</th><th>Status</th><th>Ação</th></tr></thead><tbody>{rows.map(l=><tr key={l.id}><td>{l.nome}</td><td>{l.telefones?.[0]?.numero_normalizado||"—"}</td><td><span className="pill warning">Retorno</span></td><td><span className="muted">Programado</span></td></tr>)}</tbody></table>{!rows.length&&<Empty title="Nenhum retorno pendente" text="Ao tabular uma ligação como Retorno, ela entra nesta visão."/>}</div></div>}
function Telephony(){return <div className="featureGrid"><Feature title="Telefonia / CTI" state="Pronto para integração" text="Painel preparado para SIP/WebRTC, PABX, ramais, gravação e rotas. A ligação atual usa tel:/Phone Link, sem inventar uma API proprietária."/><Feature title="PABX & URA" state="Arquitetura preparada" text="Cadastros e telas podem receber ramais, filas, horários, URA e estratégias quando uma operadora SIP for conectada."/><Feature title="Monitoria" state="Próxima camada" text="Estrutura de operação prevê escuta, sussurro, intervenção e dashboards de agentes, recursos que exigem telefonia VoIP real."/><Feature title="Gravações" state="Próxima camada" text="Armazenamento e reprodução dependem da origem das gravações e do provedor de telefonia."/></div>}
function Omnichannel(){return <div className="featureGrid"><Feature title="WhatsApp Oficial" state="Conector necessário" text="Interface preparada para unificar conversas. Para envio real, é necessária a API oficial da Meta ou um provedor autorizado."/><Feature title="Instagram / Messenger" state="Conector necessário" text="Estrutura preparada para atendimento multicanal; não simulamos mensagens reais sem credenciais."/><Feature title="Chat / E-mail / SMS" state="Conector necessário" text="Pode ser conectado por provedores/API e registrado na timeline do CRM."/><Feature title="IA de atendimento" state="Conector necessário" text="O módulo de IA pode classificar, resumir e sugerir respostas depois que o canal real estiver conectado."/></div>}
function Feature({title,state,text}:{title:string;state:string;text:string}){return <div className="panel feature"><div className="featureTop"><div className="featureIcon">◆</div><span>{state}</span></div><h3>{title}</h3><p>{text}</p><button className="btn" onClick={()=>alert("Módulo de infraestrutura preparado. A conexão real depende do provedor e das credenciais da sua operação.")}>Ver arquitetura</button></div>}
function Reports({leads,npd}:{leads:Lead[];npd:any[]}){const total=leads.length||1;const groups=[["Disponíveis",leads.filter(l=>l.status==="disponivel").length],["Interessados",leads.filter(l=>l.status==="interessado").length],["Simulação",leads.filter(l=>l.status==="simulação").length],["Proposta",leads.filter(l=>l.status==="proposta").length],["Contrato",leads.filter(l=>l.status==="contrato").length],["Finalizados",leads.filter(l=>l.status==="finalizado").length]];return <div className="stack"><div className="metricGrid"><Metric title="Conversão em oportunidade" value={Math.round(((groups[1][1]+groups[2][1]+groups[3][1]+groups[4][1])/total)*100)} icon="%" hint="sobre leads carregados"/><Metric title="Contratos" value={groups[4][1]} icon="✓" hint="status contrato"/><Metric title="Bloqueios" value={npd.length} icon="⊘" hint="NPD ativo"/><Metric title="Base ativa" value={leads.filter(l=>!l.bloqueado&&!l.opt_out).length} icon="◎" hint="sem bloqueio"/></div><div className="panel"><PanelTitle title="Distribuição do funil" subtitle="Visão operacional da base atual."/><div className="bars">{groups.map(([n,v])=><div className="barRow" key={String(n)}><span>{n}</span><div><i style={{width:Math.min(100,(Number(v)/Math.max(...groups.map(x=>Number(x[1])),1))*100)+"%"}}/></div><b>{v}</b></div>)}</div></div></div>}
function Npd({rows}:{rows:any[]}){return <div className="panel"><PanelTitle title="Não Perturbe" subtitle="Bloqueios ativos que devem permanecer fora da fila."/><div className="tableWrap"><table><thead><tr><th>Nome</th><th>CPF</th><th>Telefone</th><th>Origem</th><th>Motivo</th></tr></thead><tbody>{rows.map(r=><tr key={r.id}><td>{r.nome||"—"}</td><td>{r.cpf?mask(r.cpf):"—"}</td><td>{r.telefone||"—"}</td><td>{r.origem}</td><td>{r.motivo||"—"}</td></tr>)}</tbody></table>{!rows.length&&<Empty title="Nenhum bloqueio ativo" text="Use o botão Não ligar mais na fila."/>}</div></div>}
function Settings({operator}:{operator:any}){return <div className="featureGrid"><Feature title="Perfil" state={operator?.perfil||"operador"} text={"Usuário: "+(operator?.nome||"—")+" • "+(operator?.email||"—")}/><Feature title="Segurança" state="Ativa" text="RLS, auditoria, cabeçalhos de segurança, limite de importação e separação de privilégios no banco."/><Feature title="LGPD operacional" state="Ativa" text="Não Perturbe centralizado, registro de ações e estrutura para histórico do cliente."/><Feature title="Infraestrutura" state="Vercel + Supabase" text="Frontend Next.js e banco PostgreSQL gerenciado. Dados privados não devem ser colocados em cache público." /></div>}
function LeadDrawer({lead,onClose,onMove,stages}:{lead:Lead;onClose:()=>void;onMove:(id:string,s:string)=>void;stages:Stage[]}){return <div className="drawerBackdrop" onClick={onClose}><aside className="drawer" onClick={e=>e.stopPropagation()}><div className="drawerHead"><div className="personAvatar">{initials(lead.nome)}</div><button className="iconBtn" onClick={onClose}>×</button></div><div className="eyebrow">FICHA DO CLIENTE</div><h2>{lead.nome}</h2><p>{lead.cidade||"—"} {lead.uf&&"• "+lead.uf}</p><div className="drawerPhone">{lead.telefones?.[0]?.numero_normalizado||"Sem telefone"}</div><div className="drawerSection"><b>Etapa do CRM</b>{stages.map(s=><button key={s.id} className={lead.status===s.nome.toLowerCase()?"stageActive":""} onClick={()=>onMove(lead.id,s.nome.toLowerCase())}>{s.nome}</button>)}</div><div className="drawerSection"><b>Dados</b><p>CPF: {lead.cpf?mask(lead.cpf):"não informado"}</p><p>Produto: {lead.produto||"não informado"}</p><p>Prioridade: {lead.prioridade}</p></div></aside></div>}
function ImportModal({file,setFile,preview,onClose,onImport,loading}:{file:File|null;setFile:(f:File|null)=>void;preview:any;onClose:()=>void;onImport:()=>void;loading:boolean}){return <div className="modal" onClick={onClose}><div className="modalBox" onClick={e=>e.stopPropagation()}><div className="toolbar"><div><div className="eyebrow">IMPORTAÇÃO SEGURA</div><h2>Adicionar mailing</h2><p>XLS • XLSX • ODS • CSV • TXT</p></div><button className="btn" onClick={onClose}>Fechar</button></div><label className="drop"><input type="file" accept=".xls,.xlsx,.ods,.csv,.txt" hidden onChange={e=>setFile(e.target.files?.[0]||null)}/><span>↑</span><b>{file?file.name:"Selecione sua planilha"}</b><small>O sistema detecta colunas de nome, CPF, telefone, cidade, UF e produto.</small></label>{preview&&<><div className="notice"><b>{preview.total}</b> linhas lidas • <b>{preview.validos}</b> com nome e telefone.</div><div className="tableWrap preview"><table><thead><tr><th>Nome</th><th>CPF</th><th>Telefone</th><th>Cidade</th><th>Produto</th></tr></thead><tbody>{preview.rows.slice(0,8).map((r:any,i:number)=><tr key={i}><td>{r.nome}</td><td>{r.cpf?mask(r.cpf):""}</td><td>{r.telefone}</td><td>{r.cidade}</td><td>{r.produto}</td></tr>)}</tbody></table></div><button className="btn primary full big" disabled={loading} onClick={onImport}>{loading?"Processando...":"Confirmar importação"}</button></>}</div></div>}
function Empty({title,text}:{title:string;text:string}){return <div className="empty"><b>{title}</b><span>{text}</span></div>}
