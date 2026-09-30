import {NextResponse} from "next/server";
import {z} from "zod";
import {createServerSupabaseClient} from "@/lib/supabase/server";

const schema=z.object({
  action:z.enum(["start","finish"]).default("finish"),
  call_id:z.string().uuid().optional(),
  lead_id:z.string().uuid(),
  telefone_id:z.string().uuid().optional(),
  campanha_id:z.string().uuid().optional(),
  inicio:z.string().datetime().optional(),
  fim:z.string().datetime().optional(),
  resultado:z.string().trim().min(1).max(80).optional(),
  observacao:z.string().trim().max(2000).optional(),
  gravacao_url:z.string().url().max(2000).optional(),
  tabulacao:z.record(z.string(),z.any()).optional(),
  consentimento:z.boolean().optional(),
  consentimento_tipo:z.string().trim().max(80).optional()
}).strict();

function brasilHour(iso:string){
  const parts=new Intl.DateTimeFormat("en-US",{timeZone:"America/Sao_Paulo",hour:"2-digit",hourCycle:"h23"}).formatToParts(new Date(iso));
  return Number(parts.find(p=>p.type==="hour")?.value??-1);
}

export async function POST(request:Request){
  const requestId=request.headers.get("x-request-id")||crypto.randomUUID();
  const supabase=await createServerSupabaseClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user)return NextResponse.json({error:{code:"unauthenticated",message:"Authentication required"}},{status:401,headers:{"x-request-id":requestId}});

  let body:unknown;
  try{body=await request.json();}catch{
    return NextResponse.json({error:{code:"invalid_json",message:"JSON inválido"}},{status:400,headers:{"x-request-id":requestId}});
  }
  const parsed=schema.safeParse(body);
  if(!parsed.success){
    return NextResponse.json({error:{code:"validation_error",message:"Dados inválidos",details:parsed.error.flatten()}},{status:422,headers:{"x-request-id":requestId}});
  }
  const input=parsed.data;
  const inicio=input.inicio||new Date().toISOString();
  const fim=input.fim||inicio;
  if(!Number.isFinite(new Date(inicio).getTime())||!Number.isFinite(new Date(fim).getTime())){
    return NextResponse.json({error:{code:"invalid_datetime",message:"Data/hora inválida"}},{status:422,headers:{"x-request-id":requestId}});
  }
  const {data:operator,error:oe}=await supabase.from("operadores").select("id,ativo").eq("auth_user_id",user.id).maybeSingle();
  if(oe||!operator?.ativo)return NextResponse.json({error:{code:"operator_not_allowed",message:"Operador ativo não encontrado."}},{status:403,headers:{"x-request-id":requestId}});

  const {data:lead,error:le}=await supabase.from("leads").select("id,cpf,telefone,bloqueado,opt_out").eq("id",input.lead_id).maybeSingle();
  if(le)return NextResponse.json({error:{code:"lead_lookup_failed",message:le.message}},{status:400,headers:{"x-request-id":requestId}});
  if(!lead)return NextResponse.json({error:{code:"lead_not_found",message:"Lead não encontrado."}},{status:404,headers:{"x-request-id":requestId}});
  if(lead.bloqueado||lead.opt_out)return NextResponse.json({error:{code:"lead_blocked",message:"Lead bloqueado para contato."}},{status:409,headers:{"x-request-id":requestId}});
  const cpfKey=String(lead.cpf||"").replace(/\D/g,"");
  let phoneKey=String(lead.telefone||"").replace(/\D/g,"");
  if(input.telefone_id){
    const {data:telephone}=await supabase.from("telefones").select("numero_normalizado").eq("id",input.telefone_id).maybeSingle();
    phoneKey=String(telephone?.numero_normalizado||phoneKey).replace(/\D/g,"");
  }
  const npdMatches:any[]=[];
  if(cpfKey){
    const {data:rows}=await supabase.from("lista_nao_perturbe").select("id,cpf,telefone").eq("ativo",true).eq("cpf",cpfKey).limit(5);
    npdMatches.push(...(rows||[]));
  }
  if(phoneKey){
    const {data:rows}=await supabase.from("lista_nao_perturbe").select("id,cpf,telefone").eq("ativo",true).eq("telefone",phoneKey).limit(5);
    npdMatches.push(...(rows||[]));
  }
  if(npdMatches.length){
    return NextResponse.json({error:{code:"lead_npd_blocked",message:"Número/CPF consta na lista Não Perturbe."}},{status:409,headers:{"x-request-id":requestId}});
  }

  let call:any=null;
  if(input.action==="start"){
    const hour=brasilHour(inicio);
    if(hour<8||hour>21)return NextResponse.json({error:{code:"calling_window_closed",message:"Chamadas permitidas somente das 08:00 às 21:00 (horário de Brasília)."}},{status:422,headers:{"x-request-id":requestId}});
    const {data:created,error:ce}=await supabase.from("ligacoes").insert({
      lead_id:input.lead_id,telefone_id:input.telefone_id||null,campanha_id:input.campanha_id||null,
      operador_id:operator.id,inicio,fim:null,resultado:"Em andamento",observacao:"Chamada iniciada pelo discador"
    }).select("*").single();
    if(ce)return NextResponse.json({error:{code:"call_create_failed",message:ce.message}},{status:400,headers:{"x-request-id":requestId}});
    call=created;
  }else{
    if(input.call_id){
      const {data:existing}=await supabase.from("ligacoes").select("*").eq("id",input.call_id).eq("operador_id",operator.id).maybeSingle();
      call=existing||null;
    }
    if(!call){
      const {data:existing}=await supabase.from("ligacoes").select("*").eq("lead_id",input.lead_id).eq("operador_id",operator.id).eq("resultado","Em andamento").order("created_at",{ascending:false}).limit(1).maybeSingle();
      call=existing||null;
    }
    const finalInicio=call?.inicio||inicio;
    const finalFim=input.fim||new Date().toISOString();
    const duration=Math.max(0,Math.round((new Date(finalFim).getTime()-new Date(finalInicio).getTime())/1000));
    if(call){
      const {data:updated,error:ue}=await supabase.from("ligacoes").update({
        telefone_id:input.telefone_id||call.telefone_id,
        fim:finalFim,
        resultado:input.resultado||"Finalizado",
        observacao:input.observacao||call.observacao||null,
        duracao_segundos:duration,
        gravacao_url:input.gravacao_url||null,
        tabulacao:input.tabulacao||{}
      }).eq("id",call.id).eq("operador_id",operator.id).select("*").single();
      if(ue)return NextResponse.json({error:{code:"call_update_failed",message:ue.message}},{status:400,headers:{"x-request-id":requestId}});
      call=updated;
    }else{
      const {data:created,error:ce}=await supabase.from("ligacoes").insert({
        lead_id:input.lead_id,telefone_id:input.telefone_id||null,campanha_id:input.campanha_id||null,
        operador_id:operator.id,inicio:finalInicio,fim:finalFim,resultado:input.resultado||"Finalizado",observacao:input.observacao||null,
        duracao_segundos:duration,gravacao_url:input.gravacao_url||null,tabulacao:input.tabulacao||{}
      }).select("*").single();
      if(ce)return NextResponse.json({error:{code:"call_create_failed",message:ce.message}},{status:400,headers:{"x-request-id":requestId}});
      call=created;
    }
  }

  if(input.consentimento!==undefined){
    await supabase.from("consent_logs").insert({user_id:user.id,operator_id:operator.id,lead_id:input.lead_id,consent_type:input.consentimento_tipo||"contato",granted:input.consentimento,source:"call_api",request_id:requestId});
  }
  await supabase.from("audit_logs").insert({
    actor_user_id:user.id,operator_id:operator.id,action:input.action==="start"?"call.started":"call.finished",
    resource:"ligacoes",resource_id:call.id,request_id:requestId,
    metadata:{resultado:call.resultado,lead_id:input.lead_id,duracao_segundos:call.duracao_segundos||0,gravacao_url:input.gravacao_url||null,tabulacao:input.tabulacao||{}}
  });

  return NextResponse.json({data:call},{status:201,headers:{"x-request-id":requestId,"cache-control":"no-store"}});
}
