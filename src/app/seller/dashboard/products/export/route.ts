import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

const quote=(value:unknown)=>`"${String(typeof value==="object"?JSON.stringify(value):value??"").replaceAll('"','""')}"`;

export async function GET(request:NextRequest){
  const user=await getCurrentUser();
  const membership=user?.memberships.find(item=>item.organization.type==="SELLER"&&item.status==="ACTIVE");
  const storeId=membership?.organization.stores[0]?.id;
  if(!user||!membership||!storeId)return NextResponse.json({error:"Unauthorized"},{status:401});
  const selected=request.nextUrl.searchParams.get("ids")?.split(",").filter(Boolean)||[];
  const db=createSupabaseAdmin();
  let productQuery=db.from("seller_products").select("*").eq("store_id",storeId).order("created_at");
  if(selected.length)productQuery=productQuery.in("id",selected);
  const {data:products,error}=await productQuery;if(error)return NextResponse.json({error:error.message},{status:500});
  const ids=(products||[]).map(item=>item.id),designIds=(products||[]).flatMap(item=>item.design_id?[item.design_id]:[]);
  const [variants,images,details,tags,styles,videos,designViews]=await Promise.all([
    ids.length?db.from("seller_product_variants").select("*").in("seller_product_id",ids):Promise.resolve({data:[],error:null}),
    ids.length?db.from("product_images").select("*,storage_files(*)").in("seller_product_id",ids):Promise.resolve({data:[],error:null}),
    ids.length?db.from("product_details").select("*").in("seller_product_id",ids):Promise.resolve({data:[],error:null}),
    ids.length?db.from("product_tags").select("*,tags(*)").in("seller_product_id",ids):Promise.resolve({data:[],error:null}),
    ids.length?db.from("product_graphic_styles").select("*,graphic_styles(*)").in("seller_product_id",ids):Promise.resolve({data:[],error:null}),
    ids.length?db.from("product_videos").select("*,storage_files(*)").in("seller_product_id",ids):Promise.resolve({data:[],error:null}),
    designIds.length?db.from("design_views").select("*").in("design_id",designIds):Promise.resolve({data:[],error:null}),
  ]);
  const related=[variants,images,details,tags,styles,videos,designViews];const failed=related.find(result=>result.error);
  if(failed?.error)return NextResponse.json({error:failed.error.message},{status:500});
  const headers=["id","slug","title","subtitle","description","price","discounted_price","status","moderation_status","raw_product_id","design_id","primary_supplier_offer_id","backup_supplier_offer_id","rating_average","review_count","sales_count","view_count","seo_title","seo_description","created_at","updated_at","published_at","variants","images","details","tags","graphic_styles","videos","design_views"];
  const rows=(products||[]).map(product=>[
    ...headers.slice(0,22).map(key=>product[key as keyof typeof product]),
    variants.data?.filter(item=>item.seller_product_id===product.id),
    images.data?.filter(item=>item.seller_product_id===product.id),
    details.data?.filter(item=>item.seller_product_id===product.id),
    tags.data?.filter(item=>item.seller_product_id===product.id),
    styles.data?.filter(item=>item.seller_product_id===product.id),
    videos.data?.filter(item=>item.seller_product_id===product.id),
    designViews.data?.filter(item=>item.design_id===product.design_id),
  ]);
  const csv="\uFEFF"+[headers.map(quote).join(","),...rows.map(row=>row.map(quote).join(","))].join("\r\n");
  return new NextResponse(csv,{headers:{"content-type":"text/csv; charset=utf-8","content-disposition":`attachment; filename="chapli-products-${new Date().toISOString().slice(0,10)}.csv"`}});
}
