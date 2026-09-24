"use client";
import {useEffect,useMemo,useState} from "react";
import {supabase} from "@/lib/supabase";
import {parseFile,phone,cpf} from "@/lib/importer";

type Lead={id:string;nome:string;cpf?:string;cidade?:string;uf?:string;banco?:string;produto?:string;status:string;prioridade:number;bloqueado:boolean;opt_out:boolean;extras?:Record<string,any>;telefones?:{id:string;numero_normalizado:string}[]};
type Stage={id:string;nome:string;cor:string;ordem:number};
type Campaign={id:string;nome:string;produto?:string;status:string;created_at:string;inicio_at?:string;fim_at?:string};
type ReturnRow={id:string;lead_id:string;operador_id?:string;data_hora:string;observacao?:string;concluido:boolean;lead?:any};
type UserRow={id:string;nome:string;email?:string;perfil:string;ativo:boolean;auth_user_id?:string;permissoes?:Record<string,boolean>;preferencias?:Record<string,any>};
const APP_VERSION="2.1.0";
const results=["Interessado","Retorno","Simulação","Proposta","Contrato","Não atendeu","Não interessado","Número inválido","Sem perfil"];
const mask=(v="")=>v.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/,"$1.$2.$3-$4");
const initials=(v="")=>v.split(" ").filter(Boolean).slice(0,2).map(x=>x[0]).join("").toUpperCase();
const whatsappHref=(value:any)=>{const d=String(value??"").replace(/\D/g,"");const n=d.startsWith("55")&&(d.length===12||d.length===13)?d:((d.length===10||d.length===11)?"55"+d:d);return n.length>=12&&n.length<=13?"https://wa.me/"+n:""};

export default function Home(){
 const[session,setSession]=useState<any>(null),[operator,setOperator]=useState<any>(null),[mode,setMode]=useState("dashboard");
 const[leads,setLeads]=useState<Lead[]>([]),[npd,setNpd]=useState<any[]>([]),[stages,setStages]=useState<Stage[]>([]),[campaigns,setCampaigns]=useState<Campaign[]>([]),[returns,setReturns]=useState<ReturnRow[]>([]),[calls,setCalls]=useState<any[]>([]),[users,setUsers]=useState<UserRow[]>([]);
 const[loading,setLoading]=useState(false),[error,setError]=useState(""),[showImport,setShowImport]=useState(false),[previews,setPreviews]=useState<any[]>([]),[files,setFiles]=useState<File[]>([]),[msg,setMsg]=useState("");
 const[search,setSearch]=useState(""),[page,setPage]=useState(1),[selectedLead,setSelectedLead]=useState<Lead|null>(null),[authReady,setAuthReady]=useState(false),[recovery,setRecovery]=useState(false),[channelConfig,setChannelConfig]=useState<any>(null),[dialerConfig,setDialerConfig]=useState<any>(null);
 const pageSize=50;
 const[debouncedSearch,setDebouncedSearch]=useState("");
 useEffect(()=>{const t=setTimeout(()=>setDebouncedSearch(search),250);return()=>clearTimeout(t)},[search]);
 const filtered=useMemo(()=>leads.filter(l=>[l.nome,l.cpf,l.cidade,l.uf,l.banco,l.produto,l.status].join(" ").toLowerCase().includes(debouncedSearch.toLowerCase())),[leads,debouncedSearch]);
 const paged=filtered.slice((page-1)*pageSize,page*pageSize);
 const available=useMemo(()=>leads.filter(l=>l.status==="disponivel"&&!l.bloqueado&&!l.opt_out&&l.telefones?.length),[leads]);
 const current=available[0];

 useEffect(()=>{
  if(!supabase){setError("Conexão com o banco não foi carregada. Verifique as variáveis NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY na Vercel.");setAuthReady(true);return}
  let alive=true;
  supabase.auth.getSession().then(({data,error})=>{if(!alive)return;if(error)setError(error.message);setSession(data.session);setAuthReady(true)});
  const{data}=supabase.auth.onAuthStateChange((event,s)=>{if(event==="PASSWORD_RECOVERY")setRecovery(true);if(event==="SIGNED_OUT")setSession(null);else if(s)setSession(s);});
  return()=>{alive=false;data.subscription.unsubscribe()};
 },[]);
 useEffect(()=>{if(session)loadOperator()},[session]);
 useEffect(()=>setPage(1),[search]);
 useEffect(()=>{if(session)load(mode)},[mode]);

 async function load(targetMode=mode){
  if(!supabase)return; setLoading(true);setError("");
  try{
    const leadSelect="id,nome,cpf,cidade,uf,produto,status,prioridade,bloqueado,opt_out,created_at,updated_at,extras,telefones(id,numero_normalizado)";
    const jobs:any[]=[];
    if(["dashboard","discador","crm","leads","retornos","resultados","relatorios"].includes(targetMode)) jobs.push(supabase.from("leads").select(leadSelect).order("prioridade",{ascending:false}).order("created_at",{ascending:false}).limit(1000).then(x=>["leads",x]));
    if(["dashboard","npd"].includes(targetMode)) jobs.push(supabase.from("lista_nao_perturbe").select("id,cpf,telefone,nome,origem,motivo,ativo,data_bloqueio").eq("ativo",true).order("data_bloqueio",{ascending:false}).limit(500).then(x=>["npd",x]));
    if(["dashboard","crm","resultados","leads"].includes(targetMode)) jobs.push(supabase.from("crm_etapas").select("id,nome,cor,ordem").eq("ativo",true).order("ordem").then(x=>["stages",x]));
    if(["dashboard","campanhas"].includes(targetMode)) jobs.push(supabase.from("campanhas").select("id,nome,produto,status,created_at,inicio_at,fim_at").neq("status","removida").order("created_at",{ascending:false}).limit(100).then(x=>["campaigns",x]));
    if(["dashboard","retornos","crm"].includes(targetMode)) jobs.push(supabase.from("retornos").select("id,lead_id,operador_id,data_hora,observacao,concluido,leads(id,nome,cpf,cidade,uf,produto,telefones(id,numero_normalizado))").eq("concluido",false).order("data_hora",{ascending:true}).limit(500).then(x=>["returns",x]));
    if(["resultados","relatorios"].includes(targetMode)) jobs.push(supabase.from("ligacoes").select("id,lead_id,operador_id,telefone_id,inicio,fim,resultado,observacao,created_at,leads(id,nome,cpf)").order("created_at",{ascending:false}).limit(1000).then(x=>["calls",x]));
    const results=await Promise.all(jobs); let loadedLeads:Lead[]=[];
    for(const [key,res] of results){
      if(res.error){setError(res.error.message);continue}
      if(key==="leads"){loadedLeads=(res.data||[]) as Lead[];setLeads(loadedLeads);}
      if(key==="npd")setNpd(res.data||[]); if(key==="stages")setStages(res.data||[]); if(key==="campaigns")setCampaigns((res.data||[]) as Campaign[]);
      if(key==="returns")setReturns((res.data||[]).map((r:any)=>({...r,lead:r.lead||loadedLeads.find((l:Lead)=>l.id===r.lead_id)||null})) as ReturnRow[]); if(key==="calls")setCalls(res.data||[]);
    }
  }catch(e:any){setError("Não foi possível atualizar os dados.");} finally{setLoading(false)}
 }
 async function loadOperator(){if(!supabase||!session?.user?.id)return;const{data,error}=await supabase.from("operadores").select("*").eq("auth_user_id",session.user.id).maybeSingle();if(error){setError(error.message);return}setOperator(data);if(!data)return;const[cc,dc]=await Promise.all([supabase.from("configuracoes_canais").select("*").eq("operador_id",data.id).maybeSingle(),supabase.from("configuracoes_discador").select("*").eq("operador_id",data.id).maybeSingle()]);if(cc.error)setError(cc.error.message);else setChannelConfig(cc.data);if(dc.error)setError(dc.error.message);else setDialerConfig(dc.data);if(data.perfil==="admin"){const{data:all,error:ue}=await supabase.from("operadores").select("*").order("created_at",{ascending:true});if(ue)setError(ue.message);else setUsers((all||[]) as UserRow[])}else setUsers([data as UserRow]);}
 async function audit(acao:string,entidade?:string,entidade_id?:string,detalhes?:any){if(!supabase||!operator?.id)return;await supabase.from("auditoria").insert({operador_id:operator.id,acao,entidade:entidade||null,entidade_id:entidade_id||null,detalhes:detalhes||{}})}
 async function doImport(){
  if(!supabase||!files.length||!previews.length)return; setLoading(true);setError("");setMsg(""); let adicionados=0,duplicados=0,bloqueados=0,semTelefone=0,importados=0;
  try{for(let i=0;i<files.length;i++){const file=files[i],preview=previews[i];const{data:imp,error:ie}=await supabase.from("importacoes").insert({nome_arquivo:file.name,extensao:preview.ext,total:preview.total,validos:0,duplicados:0,invalidos:preview.total-preview.validos,sem_telefone:0,mapeamento:preview.map}).select().single();if(ie)throw ie;
    const rows=preview.rows.map((r:any)=>({nome:String(r.nome||"").trim(),cpf:r.cpf||null,cidade:r.cidade||"",uf:r.uf||"",produto:r.produto||"",observacao:r.observacao||"",extras:{...(r.extras||{}),banco:r.banco||""},telefone_original:r.telefone||"",telefone_normalizado:phone(r.telefone||"")||null,telefone2_original:r.telefone2||"",telefone2_normalizado:phone(r.telefone2||"")||null}));
    const{data:result,error:re}=await supabase.rpc("import_leads_batch",{p_importacao_id:imp.id,p_rows:rows});if(re)throw re;const s=result||{};adicionados+=Number(s.adicionados||0);duplicados+=Number(s.duplicados||0);bloqueados+=Number(s.bloqueados||0);semTelefone+=Number(s.sem_telefone||0);importados++;await audit("importacao_concluida","importacoes",imp.id,s)}
    setMsg(importados+" arquivo(s) importado(s): "+adicionados+" adicionados • "+duplicados+" duplicados • "+bloqueados+" bloqueados • "+semTelefone+" sem telefone.");setShowImport(false);setPreviews([]);setFiles([]);await load();
  }catch(e:any){setError("Erro na importação: "+(e?.message||"não foi possível processar os arquivos."));}finally{setLoading(false)}
 }
 async function callResult(result:string){if(!supabase||!current)return;if(result==="Retorno")return;const t=current.telefones?.[0],now=new Date().toISOString();const{error:e}=await supabase.from("ligacoes").insert({lead_id:current.id,telefone_id:t?.id,operador_id:operator?.id,inicio:now,fim:now,resultado:result});if(e){setError(e.message);return}const statusMap:Record<string,string>={"Número inválido":"numero_invalido","Sem perfil":"sem_perfil","Não interessado":"nao_interessado","Não atendeu":"nao_atendeu","Interessado":"interessado","Simulação":"simulação","Proposta":"proposta","Contrato":"contrato"};const status=statusMap[result]||"finalizado";const{error:ue}=await supabase.from("leads").update({status,updated_at:now}).eq("id",current.id);if(ue){setError(ue.message);return}await audit("ligacao_tabular","leads",current.id,{resultado:result,status});await load()}
 // O restante da interface existente permanece abaixo neste arquivo.
}
