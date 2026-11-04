import {redirect} from "next/navigation";
import {createServerSupabaseClient} from "@/lib/supabase/server";
import CreateOperatorForm from "@/components/admin/CreateOperatorForm";

export default async function AdminUsersPage(){
  const supabase=await createServerSupabaseClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user)redirect("/");
  const {data:me}=await supabase.from("operadores").select("id,nome,email,perfil,ativo").eq("auth_user_id",user.id).maybeSingle();
  if(me?.perfil!=="admin" || me.ativo===false)redirect("/");
  const {data:users,error}=await supabase.from("operadores").select("id,nome,email,perfil,ativo,created_at").order("created_at",{ascending:true});
  return <main style={{minHeight:"100vh",padding:32,fontFamily:"Arial,sans-serif",color:"#0f172a"}}>
    <h1 style={{fontSize:28,fontWeight:800,marginBottom:8}}>A&K — Usuários</h1>
    <p style={{marginBottom:24,color:"#64748b"}}>Gerencie os acessos da equipe. Novos usuários entram imediatamente, sem confirmação por e-mail.</p>
    <CreateOperatorForm />
    <h2 style={{fontSize:20,fontWeight:700,marginBottom:12}}>Usuários cadastrados</h2>
    {error && <p role="alert" style={{color:"#be123c"}}>Não foi possível carregar a lista de usuários.</p>}
    <div style={{display:"grid",gap:12,maxWidth:900}}>
      {(users||[]).map(u=><section key={u.id} style={{border:"1px solid #dbe2ea",borderRadius:12,padding:16,background:"white"}}>
        <b>{u.nome}</b><div>{u.email||"sem e-mail"}</div><div>Perfil: {u.perfil} • {u.ativo?"Ativo":"Inativo"}</div>
      </section>)}
      {!error && (!users || users.length===0) && <p>Nenhum usuário cadastrado.</p>}
    </div>
    <p style={{marginTop:24,color:"#64748b",fontSize:13}}>A gestão de usuários é restrita ao administrador. Senhas não são exibidas nesta tela.</p>
  </main>;
}
