"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Eye, EyeOff, X } from "lucide-react";
import { quickSellerRegisterAction, type AuthState } from "@/app/actions/auth";

export function QuickSellerSignupForm({ compact=false }: { compact?: boolean }) {
  const [state, action, pending] = useActionState<AuthState, FormData>(quickSellerRegisterAction, {});
  const [showPassword,setShowPassword]=useState(false);
  return <form action={action} className={`quick-seller-signup ${compact?"compact":""}`}>
    <label><span>ایمیل</span><input name="email" type="email" autoComplete="email" placeholder="name@example.com" required/>{state.errors?.email&&<small>{state.errors.email[0]}</small>}</label>
    <label><span>رمز عبور</span><div><input name="password" type={showPassword?"text":"password"} autoComplete="new-password" placeholder="حداقل ۸ کاراکتر" required minLength={8}/><button type="button" aria-label="نمایش رمز عبور" onClick={()=>setShowPassword(value=>!value)}>{showPassword?<EyeOff/>:<Eye/>}</button></div>{state.errors?.password&&<small>{state.errors.password[0]}</small>}</label>
    {state.message&&<p role="alert">{state.message}</p>}
    <button className="creator-button" disabled={pending}>{pending?"در حال ساخت حساب…":<>رایگان شروع کن <ArrowLeft/></>}</button>
    <small className="quick-terms">با ثبت‌نام، <Link href="/terms">قوانین</Link> و <Link href="/privacy">حریم خصوصی</Link> را می‌پذیری.</small>
  </form>;
}

export function SellerSignupTrigger({children,className="creator-button"}:{children:React.ReactNode;className?:string}){
  const [open,setOpen]=useState(false);
  return <><button type="button" className={className} onClick={()=>setOpen(true)}>{children}</button>{open&&<div className="quick-signup-backdrop" role="presentation" onMouseDown={(event)=>{if(event.target===event.currentTarget)setOpen(false)}}><section className="quick-signup-modal" role="dialog" aria-modal="true" aria-label="ثبت‌نام رایگان فروشنده"><button type="button" className="quick-signup-close" onClick={()=>setOpen(false)} aria-label="بستن"><X/></button><span>فقط ۶۰ ثانیه تا اولین محصول</span><h2>حسابت رو رایگان بساز</h2><p>فقط ایمیل و رمز. بقیه اطلاعات اختیاریه.</p><QuickSellerSignupForm/></section></div>}</>;
}
