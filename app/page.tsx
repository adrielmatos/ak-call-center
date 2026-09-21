"use client";
import {useEffect,useMemo,useState} from "react";
import {supabase} from "@/lib/supabase";
import {parseFile,phone,cpf} from "@/lib/importer";
type Lead={id:string;nome:string;cpf?:string;cidade?:string;uf?:string;produto?:string;status:string;prioridade:number;bloqueado:boolean;opt_out:boolean;telefones?:{id:string;numero_normalizado:string}[]};
const results=["Interessado","Retorno","Simulação","Proposta","Contrato","Não atendeu","Não interessado","Número inválido","Sem perfil"];
export default function Home(){
 const[session,setSession]=useState<any>(null),[mode,setMode]=useState("dashboard"),[leads,setLeads]=useState<Lead[]>([]),[npd,setNpd]=useState<any[]>([]),[loading,setLoading]=useState(false),[showImport,setShowImport]=useState(false),[preview,setPreview]=useState<any>(null),[file,setFile]=useState<File|null>(null),[msg,setMsg]=useState("");
 const available=useMemo(()=>leads.filter(l=>l.status==="disponivel"&&!l.bloqueado&&!l.opt_out&&l.telefones?.length),[leads]),current=available[0];
 useEffect(()=>{if(!supabase)return;supabase.auth.getSession().then(({data})=>setSession(data.session));const{data}=supabase.auth.onAuthStateChange((_e,s)=>setSession(s));return()=>data.subscription.unsubscribe()},[]);
 useEffect(()=>{if(session)load()},[session]);
 async function load(){if(!supabase)return;setLoading(true);const[{data:l},{data:n}]=await Promise.all([supabase.from("leads").select("*,telefones(id,numero_normalizado)").order("prioridade",{ascending:false}).limit(500),supabase.from("lista_nao_perturbe").select("*").eq("ativo",true).order("data_bloqueio",{ascending:false}).limit(500)]);setLeads((l||[])as any);setNpd(n||[]);setLoading(false)}
 async function auth(email:string,password:string,signup=false){if(!supabase)return;const r=signup?await supabase.auth.signUp({email,password}):await supabase.auth.signInWithPassword({email,password});setMsg(r.error?.message||"");}
 async function doImport(){
  if(!supabase||!file||!preview)return;
  setLoading(true);
  setMsg("");
  const {data:imp,error}=await supabase.from("importacoes").insert({
    nome_arquivo:file.name,
    extensao:preview.ext,
    total:preview.total,
    validos:0,
    duplicados:0,
    invalidos:preview.total-preview.validos,
    sem_telefone:0,
    mapeamento:preview.map
  }).select().single();
  if(error){
    setMsg(error.message);
    setLoading(false);
    return;
  }
  const rows=preview.rows.map((r:any)=>({
    nome:String(r.nome||"").trim(),
    cpf:r.cpf||null,
    cidade:r.cidade||"",
    uf:r.uf||"",
    produto:r.produto||"",
    observacao:r.observacao||"",
    extras:r.extras||{},
    telefone_original:r.telefone||"",
    telefone_normalizado:phone(r.telefone||"")||null,
    telefone2_original:r.telefone2||"",
    telefone2_normalizado:phone(r.telefone2||"")||null
  }));
  const {data:result,error:rpcError}=await supabase.rpc("import_leads_batch",{
    p_importacao_id:imp.id,
    p_rows:rows
  });
  if(rpcError){
    setMsg("Erro na importação: "+rpcError.message);
    setLoading(false);
    return;
  }
  const s=result||{};
  setMsg("Importação concluída: "+(s.adicionados||0)+" adicionados; "+(s.duplicados||0)+" duplicados; "+(s.bloqueados||0)+" bloqueados pela Não Perturbe; "+(s.sem_telefone||0)+" sem telefone.");
  setShowImport(false);
  setPreview(null);
  setFile(null);
  await load();
  setLoading(false);
}
 async function callResult(result:string){if(!supabase||!current)return;const t=current.telefones?.[0];await supabase.from("ligacoes").insert({lead_id:current.id,telefone_id:t?.id,resultado:result,inicio:new Date().toISOString(),fim:new Date().toISOString()});await supabase.from("leads").update({status:result==="Retorno"?"retorno":result==="Interessado"?"interessado":"finalizado",updated_at:new Date().toISOString()}).eq("id",current.id);await load()}
 async function block(){if(!supabase||!current)return;await supabase.from("lista_nao_perturbe").insert({cpf:cpf(current.cpf||"")||null,telefone:phone(current.telefones?.[0]?.numero_normalizado||"")||null,nome:current.nome,origem:"manual",motivo:"Solicitação de não contato"});await supabase.from("leads").update({bloqueado:true,opt_out:true,status:"bloqueado"}).eq("id",current.id);await load()}
 if(!session)return <Login onAuth={auth} msg={msg}/>;
 return <div className="shell"><aside className="side"><div className="brand">A<span>&</span>K CALL CENTER</div><div className="nav">{[["dashboard","Dashboard"],["fila","Fila"],["leads","Leads"],["npd","Não Perturbe"]].map(([id,label])=><button className={mode===id?"active":""} key={id} onClick={()=>setMode(id)}>{label}</button>)}</div><button className="btn" style={{marginTop:20,width:"100%"}} onClick={()=>setShowImport(true)}>+ Importar lista</button><button className="btn" style={{marginTop:8,width:"100%"}} onClick={()=>supabase?.auth.signOut()}>Sair</button></aside><main className="main"><div className="top"><div className="title"><h1>{mode==="dashboard"?"Dashboard":mode==="fila"?"Fila de chamadas":mode==="leads"?"Leads":"Não Perturbe"}</h1><div className="muted">A&K Soluções Financeiras • central operacional</div></div><button className="btn primary" onClick={()=>setShowImport(true)}>+ Importar lista</button></div>{mode==="dashboard"&&<Dashboard leads={leads} available={available.length} npd={npd.length}/>} {mode==="fila"&&<Queue lead={current} onCall={()=>current?.telefones?.[0]&&(window.location.href="tel:+"+current.telefones[0].numero_normalizado)} onResult={callResult} onBlock={block}/>} {mode==="leads"&&<Leads leads={leads} loading={loading}/>} {mode==="npd"&&<Npd rows={npd}/>} {showImport&&<ImportModal file={file} setFile={async f=>{setFile(f);if(f)try{setPreview(await parseFile(f))}catch{setMsg("Não foi possível ler o arquivo.")}}} preview={preview} onClose={()=>{setShowImport(false);setPreview(null)}} onImport={doImport} loading={loading} msg={msg}/>}</main></div>
}
function Login({onAuth,msg}:{onAuth:(e:string,p:string,s?:boolean)=>void;msg:string}){const[e,setE]=useState(""),[p,setP]=useState(""),[s,setS]=useState(false);return <div className="login"><div className="loginbox"><div className="logo">A<span>&</span>K</div><h2>Call Center</h2><p className="muted">Entre para acessar sua central.</p><div className="field"><label>E-mail</label><input value={e} onChange={x=>setE(x.target.value)}/></div><div className="field"><label>Senha</label><input type="password" value={p} onChange={x=>setP(x.target.value)}/></div>{msg&&<div className="notice">{msg}</div>}<button className="btn primary" style={{width:"100%"}} onClick={()=>onAuth(e,p,s)}>{s?"Criar conta":"Entrar"}</button><button className="btn" style={{width:"100%",marginTop:8}} onClick={()=>setS(!s)}>{s?"Já tenho conta":"Primeiro acesso"}</button></div></div>}
function Dashboard({leads,available,npd}:{leads:Lead[];available:number;npd:number}){return <div className="grid"><div className="grid cards"><Metric t="Total de leads" n={leads.length}/><Metric t="Na fila" n={available}/><Metric t="Interessados" n={leads.filter(x=>x.status==="interessado").length}/><Metric t="Não Perturbe" n={npd}/></div><div className="card"><h3>Central operacional</h3><p className="muted">Importe suas listas, respeite a Não Perturbe e registre o resultado de cada chamada.</p></div></div>}
function Metric({t,n}:{t:string;n:number}){return <div className="card"><div className="muted">{t}</div><div className="metric">{n}</div></div>}
function Queue({lead,onCall,onResult,onBlock}:{lead?:Lead;onCall:()=>void;onResult:(x:string)=>void;onBlock:()=>void}){if(!lead)return <div className="card empty">Fila vazia. Importe uma lista para começar.</div>;return <div className="queue"><div className="leadhero"><div className="muted" style={{color:"#cfe0ff"}}>PRÓXIMO CONTATO</div><h2>{lead.nome}</h2><div>{lead.cidade||"—"} {lead.uf&&"• "+lead.uf}</div><div className="phone">{lead.telefones?.[0]?.numero_normalizado}</div><div className="actions"><button className="btn primary" onClick={onCall}>📞 LIGAR</button><button className="btn" onClick={onBlock}>Não ligar mais</button></div></div><div className="card"><h3>Resultado</h3><div className="resultgrid">{results.map(r=><button key={r} onClick={()=>onResult(r)}>{r}</button>)}</div><p className="muted" style={{marginTop:16}}>O botão LIGAR usa tel: para entregar a chamada ao ambiente Windows/Phone Link.</p></div></div>}
function Leads({leads,loading}:{leads:Lead[];loading:boolean}){return <div className="tablewrap"><table className="table"><thead><tr><th>Nome</th><th>Telefone</th><th>Produto</th><th>Status</th></tr></thead><tbody>{leads.map(l=><tr key={l.id}><td>{l.nome}</td><td>{l.telefones?.[0]?.numero_normalizado||"—"}</td><td>{l.produto||"—"}</td><td><span className="pill">{l.status}</span></td></tr>)}</tbody></table>{loading&&<div className="empty">Carregando...</div>}</div>}
function Npd({rows}:{rows:any[]}){return <div className="tablewrap"><table className="table"><thead><tr><th>Nome</th><th>CPF</th><th>Telefone</th><th>Origem</th><th>Motivo</th></tr></thead><tbody>{rows.map(r=><tr key={r.id}><td>{r.nome||"—"}</td><td>{r.cpf||"—"}</td><td>{r.telefone||"—"}</td><td>{r.origem}</td><td>{r.motivo||"—"}</td></tr>)}</tbody></table>{!rows.length&&<div className="empty">Nenhum registro ativo.</div>}</div>}
function ImportModal({file,setFile,preview,onClose,onImport,loading,msg}:{file:File|null;setFile:(f:File|null)=>void;preview:any;onClose:()=>void;onImport:()=>void;loading:boolean;msg:string}){return <div className="modal"><div className="modalbox"><div className="top"><div><h2 style={{margin:0}}>Importar lista</h2><div className="muted">XLS • XLSX • ODS • CSV • TXT</div></div><button className="btn" onClick={onClose}>Fechar</button></div><label className="drop"><input type="file" accept=".xls,.xlsx,.ods,.csv,.txt" hidden onChange={e=>setFile(e.target.files?.[0]||null)}/>{file?<b>{file.name}</b>:"Clique para selecionar o arquivo"}</label>{preview&&<><div className="notice" style={{marginTop:14}}>Encontrados {preview.total} registros; {preview.validos} com nome e telefone.</div><div className="tablewrap"><table className="table"><thead><tr><th>Nome</th><th>CPF</th><th>Telefone</th><th>Cidade</th><th>Produto</th></tr></thead><tbody>{preview.rows.slice(0,8).map((r:any,i:number)=><tr key={i}><td>{r.nome}</td><td>{r.cpf}</td><td>{r.telefone}</td><td>{r.cidade}</td><td>{r.produto}</td></tr>)}</tbody></table></div><button disabled={loading} className="btn primary" style={{marginTop:15}} onClick={onImport}>{loading?"Importando...":"Confirmar importação"}</button></>}{msg&&<div className="notice" style={{marginTop:12}}>{msg}</div>}</div></div>}
