import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/types/database";
import { resilientFetch } from "@/lib/supabase/resilient-fetch";

export async function middleware(request:NextRequest){
  const requestId=request.headers.get("x-request-id")||crypto.randomUUID();
  const forwardedHeaders=new Headers(request.headers);
  forwardedHeaders.set("x-request-id",requestId);
  forwardedHeaders.set("x-chapli-release",process.env.RELEASE_VERSION||"development");
  const hostname=(request.headers.get("host")||"").split(":")[0].toLowerCase();
  const isChapliSubdomain=hostname.endsWith(".chaplly.ir")&&!["www.chaplly.ir","app.chaplly.ir"].includes(hostname);
  const isLocalSubdomain=hostname.endsWith(".localhost")&&hostname!=="www.localhost";
  if(isChapliSubdomain||isLocalSubdomain){
    const slug=hostname.split(".")[0];
    const target=request.nextUrl.clone();
    target.pathname=`/stores/${slug}`;
    const rewritten=NextResponse.rewrite(target,{request:{headers:forwardedHeaders}});
    rewritten.headers.set("x-request-id",requestId);
    return rewritten;
  }
  let response=NextResponse.next({request:{headers:forwardedHeaders}});
  response.headers.set("x-request-id",requestId);
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if(!url||!key) return response;
  const hasSupabaseSession=request.cookies.getAll().some(({name})=>name.startsWith("sb-")&&name.includes("auth-token"));
  if(!hasSupabaseSession) return response;
  const supabase=createServerClient<Database>(url,key,{
    global:{fetch:resilientFetch},
    cookies:{
      getAll:()=>request.cookies.getAll(),
      setAll(values){
        values.forEach(({name,value})=>request.cookies.set(name,value));
        response=NextResponse.next({request:{headers:forwardedHeaders}});
        response.headers.set("x-request-id",requestId);
        values.forEach(({name,value,options})=>response.cookies.set(name,value,options));
      },
    },
  });
  // Validate locally against the project's signing keys when possible. Unlike
  // getUser(), this does not add an Auth-server round trip to every request.
  await supabase.auth.getClaims();
  return response;
}

export const config={
  matcher:["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
