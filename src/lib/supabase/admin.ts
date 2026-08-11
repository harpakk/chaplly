import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { resilientFetch } from "@/lib/supabase/resilient-fetch";

export function createSupabaseAdmin(){
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
 const key=process.env.SUPABASE_SECRET_KEY;
 if(!url||!key)throw new Error("Missing Supabase server credentials");
 return createClient<Database>(url,key,{
  auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},
  global:{fetch:resilientFetch},
 });
}
