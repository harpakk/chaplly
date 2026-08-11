"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";

const className="route-is-changing";

export function NavigationFeedback(){
  const pathname=usePathname();
  const searchParams=useSearchParams();

  useEffect(()=>{
    document.documentElement.classList.remove(className);
  },[pathname,searchParams]);

  useEffect(()=>{
    let timer:ReturnType<typeof setTimeout>|undefined;
    const start=(event:MouseEvent)=>{
      if(event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
      const target=event.target instanceof Element?event.target.closest("a[href]"):null;
      if(!(target instanceof HTMLAnchorElement)||target.target==="_blank"||target.hasAttribute("download"))return;
      const url=new URL(target.href,window.location.href);
      if(url.origin!==window.location.origin||url.pathname===window.location.pathname)return;
      document.documentElement.classList.add(className);
      if(timer)clearTimeout(timer);
      timer=setTimeout(()=>document.documentElement.classList.remove(className),10000);
    };
    document.addEventListener("click",start,true);
    return()=>{document.removeEventListener("click",start,true);if(timer)clearTimeout(timer)};
  },[]);

  return <div className="instant-navigation" aria-hidden="true"><i/><span/></div>;
}
