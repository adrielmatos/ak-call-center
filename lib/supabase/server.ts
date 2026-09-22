import {createServerClient, type CookieOptions} from "@supabase/ssr";
import {cookies} from "next/headers";

export async function createServerSupabaseClient(){
  const store=await cookies();
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if(!url||!key) throw new Error("Supabase não configurado.");
  return createServerClient(url,key,{
    cookies:{
      getAll(){return store.getAll();},
      setAll(values:{name:string;value:string;options:CookieOptions}[]){
        try{values.forEach(({name,value,options})=>store.set(name,value,options));}catch{}
      }
    },
    cookieOptions:{sameSite:"strict",httpOnly:true,secure:process.env.NODE_ENV==="production",path:"/"}
  });
}
