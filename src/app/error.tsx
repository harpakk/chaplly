"use client";

import { AlertTriangle, RefreshCw } from "lucide-react";

export default function ErrorPage({error,reset}:{error:Error&{digest?:string};reset:()=>void}){
  return <main className="route-state error"><AlertTriangle/><h1>این بخش درست بارگذاری نشد</h1><p>{process.env.NODE_ENV==="development"?error.message:"اتصال را بررسی کن و دوباره تلاش کن."}</p><button className="button button-primary" onClick={reset}><RefreshCw/> تلاش دوباره</button></main>;
}
