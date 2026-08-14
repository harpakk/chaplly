"use server";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { persistUserAttribution } from "@/lib/attribution";

export type BuyerAuthState={message?:string};
const safeNext=(value:string)=>value==="/checkout"||value.startsWith("/account/")?value:"/account";

export async function buyerLoginAction(_:BuyerAuthState,formData:FormData):Promise<BuyerAuthState>{
  const email=String(formData.get("email")||"").trim().toLowerCase();
  const password=String(formData.get("password")||"");
  const supabase=await createSupabaseServerClient();
  const {data,error}=await supabase.auth.signInWithPassword({email,password});
  if(error||!data.user)return{message:"ایمیل یا رمز عبور درست نیست."};
  const {data:profile}=await supabase.from("profiles").select("primary_role,state").eq("id",data.user.id).maybeSingle();
  if(!profile||profile.state!=="ACTIVE"){await supabase.auth.signOut();return{message:"این حساب فعال نیست."};}
  const next=String(formData.get("next")||"");
  redirect(safeNext(next));
}

export async function buyerSignupAction(_:BuyerAuthState,formData:FormData):Promise<BuyerAuthState>{
  const email=String(formData.get("email")||"").trim().toLowerCase();
  const password=String(formData.get("password")||"");
  const phone=String(formData.get("phone")||"").trim();
  if(!/^\S+@\S+\.\S+$/.test(email))return{message:"یک ایمیل معتبر وارد کن."};
  if(password.length<8)return{message:"رمز عبور باید حداقل ۸ کاراکتر باشد."};
  if(phone&&!/^(\+98|0)?9\d{9}$/.test(phone))return{message:"شماره موبایل معتبر نیست."};
  const supabase=await createSupabaseServerClient();
  const {data,error}=await supabase.auth.signUp({email,password,options:{data:{role:"BUYER",phone:phone||null}}});
  if(error)return{message:error.message.includes("registered")?"این ایمیل قبلاً ثبت شده است.":"ساخت حساب انجام نشد؛ دوباره تلاش کن."};
  if(data.user)await persistUserAttribution(data.user.id).catch(error=>console.error("Buyer attribution failed",error));
  if(data.session)redirect(safeNext(String(formData.get("next")||"")));
  return{message:"حساب ساخته شد. لینک تأیید ارسال‌شده به ایمیلت را باز کن و سپس وارد شو."};
}

export async function buyerLogoutAction(){
  const supabase=await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/");
}
