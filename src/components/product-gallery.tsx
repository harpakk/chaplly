"use client";

import { useState } from "react";
import { ZoomIn, ZoomOut, X } from "lucide-react";
import { WishlistButton } from "@/components/wishlist-button";
import { ResilientImage } from "@/components/resilient-image";

export function ProductGallery({images,title,productId,initialLiked=false}:{images:string[];title:string;productId:string;initialLiked?:boolean}){
  const usable=images.length?images:["/images/product-placeholder.png"];
  const [active,setActive]=useState(0);
  const [zoomOpen,setZoomOpen]=useState(false);
  const [zoom,setZoom]=useState(1);
  return <div className="pdp-gallery">
    <div className="pdp-main-image" onClick={()=>setZoomOpen(true)}>
      <ResilientImage src={usable[active]} alt={title} fill priority sizes="(max-width:900px) 100vw,45vw"/>
      <WishlistButton productId={productId} title={title} initialLiked={initialLiked} stopPropagation />
      <button type="button" className="pdp-zoom-trigger" aria-label="بزرگ‌نمایی تصویر"><ZoomIn/></button>
    </div>
    {usable.length>1&&<div className="pdp-thumbs">{usable.map((image,index)=><button type="button" className={index===active?"active":""} onClick={()=>setActive(index)} key={`${image}:${index}`}><ResilientImage src={image} alt="" width={110} height={110}/></button>)}</div>}
    {zoomOpen&&<div className="product-zoom-backdrop" onClick={()=>setZoomOpen(false)}><div className="product-zoom-modal" onClick={(event)=>event.stopPropagation()}>
      <button className="zoom-close" onClick={()=>setZoomOpen(false)}><X/></button>
      <div className="zoom-image"><ResilientImage src={usable[active]} alt={title} fill sizes="95vw" style={{transform:`scale(${zoom})`}}/></div>
      <div className="zoom-controls"><button onClick={()=>setZoom(value=>Math.max(1,value-.25))}><ZoomOut/></button><span>{Math.round(zoom*100).toLocaleString("fa-IR")}٪</span><button onClick={()=>setZoom(value=>Math.min(3,value+.25))}><ZoomIn/></button></div>
    </div></div>}
  </div>;
}
