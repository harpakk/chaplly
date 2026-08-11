import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getUserById } from "@/lib/database";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const getCurrentUser=cache(async()=>{
  const cookieStore=await cookies();
  const hasSession=cookieStore.getAll().some(({name})=>name.startsWith("sb-")&&name.includes("auth-token"));
  if(!hasSession)return null;
  const supabase=await createSupabaseServerClient();
  const {data,error}=await supabase.auth.getClaims();
  const userId=typeof data?.claims?.sub==="string"?data.claims.sub:null;
  if(error||!userId) return null;
  const profile=await getUserById(userId,true);
  return profile?.status==="ACTIVE"?profile:null;
});

export async function requireSeller(){
  const user=await getCurrentUser();
  const membership=user?.memberships.find(item=>item.organization.type==="SELLER"&&item.status==="ACTIVE");
  if(!user||!membership) redirect("/seller/login");
  return{user,membership};
}

export async function requireSupplier(){
  const user=await getCurrentUser();
  const membership=user?.memberships.find(item=>item.organization.type==="SUPPLIER"&&item.status==="ACTIVE");
  if(!user||!membership) redirect("/supplier/login");
  return{user,membership};
}

export async function requireBuyer(){
  const user=await getCurrentUser();
  if(!user) redirect("/account/login");
  return user;
}

export async function destroySession(){
  const supabase=await createSupabaseServerClient();
  await supabase.auth.signOut();
}
