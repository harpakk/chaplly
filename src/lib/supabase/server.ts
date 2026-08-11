import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/types/database";
import { resilientFetch } from "@/lib/supabase/resilient-fetch";

export async function createSupabaseServerClient(){
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if(!url||!key) throw new Error("Missing Supabase public credentials");
  const cookieStore=await cookies();
  return createServerClient<Database>(url,key,{
    global:{fetch:resilientFetch},
    cookies:{
      getAll:()=>cookieStore.getAll(),
      setAll(values){
        try{
          values.forEach(({name,value,options})=>cookieStore.set(name,value,options));
        }catch{
          // Server Components cannot write cookies. Server Actions and Route
          // Handlers can, and middleware refreshes expiring sessions.
        }
      },
    },
  });
}
