"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut, X } from "lucide-react";
import { WishlistButton } from "@/components/wishlist-button";
import { ResilientImage } from "@/components/resilient-image";

export function ProductGallery({images,title,productId,initialLiked=false}:{images:string[];title:string;productId:string;initialLiked?:boolean}){
  const usable=images.length?images:["/images/product-placeholder.png"];
  const [active,setActive]=useState(0);
  const [zoomOpen,setZoomOpen]=useState(false);
  const [zoom,setZoom]=useState(1);
  const move=(amount:number)=>{setActive((current)=>(current+amount+usable.length)%usable.length);setZoom(1)};
  useEffect(()=>{
    if(!zoomOpen)return;
    const keyboard=(event:KeyboardEvent)=>{if(event.key==="ArrowLeft")move(1);if(event.key==="ArrowRight")move(-1);if(event.key==="Escape")setZoomOpen(false)};
    window.addEventListener("keydown",keyboard);return()=>window.removeEventListener("keydown",keyboard);
  },[zoomOpen,usable.length]); // eslint-disable-line react-hooks/exhaustive-deps
  return <div className="pdp-gallery">
    <div className="pdp-main-image" onClick={()=>setZoomOpen(true)}>
      <div className="pdp-image-stack">{usable.map((image,index)=><ResilientImage className={index===active?"active":""} src={image} alt={index===active?title:""} fill priority={index<3} unoptimized sizes="(max-width:900px) 100vw,45vw" key={`${image}:${index}`}/>)}</div>
      <WishlistButton productId={productId} title={title} initialLiked={initialLiked} stopPropagation />
      <button type="button" className="pdp-zoom-trigger" aria-label="بزرگ‌نمایی تصویر"><ZoomIn/></button>
    </div>
    {usable.length>1&&<div className="pdp-thumbs">{usable.map((image,index)=><button type="button" className={index===active?"active":""} onClick={()=>{setActive(index);setZoom(1)}} key={`${image}:${index}`}><ResilientImage src={image} alt="" width={110} height={110} unoptimized/></button>)}</div>}
    {zoomOpen&&<div className="product-zoom-backdrop" onClick={()=>setZoomOpen(false)}><div className="product-zoom-modal" onClick={(event)=>event.stopPropagation()}>
      <button className="zoom-close" onClick={()=>setZoomOpen(false)} aria-label="بستن"><X/></button>
      {usable.length>1&&<><button className="zoom-previous" onClick={()=>move(-1)} aria-label="تصویر قبلی"><ChevronRight/></button><button className="zoom-next" onClick={()=>move(1)} aria-label="تصویر بعدی"><ChevronLeft/></button></>}
      <div className="zoom-image pdp-image-stack">{usable.map((image,index)=><ResilientImage className={index===active?"active":""} src={image} alt={index===active?title:""} fill unoptimized sizes="95vw" style={{transform:`scale(${zoom})`}} key={`${image}:${index}`}/>)}</div>
      <div className="zoom-controls"><button onClick={()=>setZoom(value=>Math.max(1,value-.25))}><ZoomOut/></button><span>{Math.round(zoom*100).toLocaleString("fa-IR")}٪</span><button onClick={()=>setZoom(value=>Math.min(3,value+.25))}><ZoomIn/></button></div>
    </div></div>}
  </div>;
}
