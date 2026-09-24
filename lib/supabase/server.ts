import "server-only";
import { createServerClient } from "@supabase/ssr";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

export async function createClient() {
  const store=await cookies();
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if(!url||!key) throw new Error("Supabase não configurado.");
  return createServerClient(url,key,{
    cookies:{
      getAll:()=>store.getAll(),
      setAll(values){try{values.forEach(({name,value,options})=>store.set(name,value,options));}catch{}}
    }
  });
}

export function createServiceClient() {
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!url||!key) throw new Error("Supabase service client não configurado.");
  return createSupabaseClient(url,key,{auth:{autoRefreshToken:false,persistSession:false}});
}
