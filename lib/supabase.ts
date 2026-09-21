import {createClient} from "@supabase/supabase-js";

const url=process.env.NEXT_PUBLIC_SUPABASE_URL || "https://vtwyojpsrjyigsnnfawa.supabase.co";
const key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "sb_publishable_wBm4Vdroz5rdxo8T5glEqA_npwFbbpP";

export const supabase=createClient(url,key);
