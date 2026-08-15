import "server-only";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
export type AnalyticsPoint={day:string;indexViews:number;productViews:number;sales:number;averageBasket:number;totalSales:number;conversionRate:number};
export type AttributionPoint={sourceKey:string;visits:number;uniqueVisits:number;signups:number;buys:number;visitPercentage:number};
export type SellerAnswerChart={key:string;title:string;total:number;values:{label:string;count:number;percentage:number;color?:string}[]};
export type SellerFunnel={uniqueVisitors:number;allSellers:number;withSales:number;moreThanOne:number;moreThanFive:number;moreThanTen:number;exactlyOne:number;twoToFive:number;sixToTen:number;overTen:number};
export type AdminAnalyticsData={series:AnalyticsPoint[];sellers:{all:number;moreThanFive:number;withSales:number};funnel:SellerFunnel;attribution:AttributionPoint[];sellerAnswers:SellerAnswerChart[]};
const answerLabels:Record<string,Record<string,string>>={
 sellerType:{INFLUENCER:"اینفلوئنسر / تولیدکننده محتوا",DESIGNER:"گرافیست / طراح",BRAND:"برند یا شرکت",ENTREPRENEUR:"راه‌اندازی آنلاین‌شاپ"},
 experienceLevel:{NONE:"هنوز شروع نکرده",BEGINNER:"تازه‌کار",ACTIVE:"فروش فعال",PRO:"حرفه‌ای"},
 audienceSize:{UNDER_10K:"کمتر از ۱۰ هزار","10K_100K":"۱۰ تا ۱۰۰ هزار","100K_1M":"۱۰۰ هزار تا ۱ میلیون",OVER_1M:"بیشتر از ۱ میلیون"},
 monthlyViews:{UNDER_100K:"کمتر از ۱۰۰ هزار","100K_1M":"۱۰۰ هزار تا ۱ میلیون","1M_10M":"۱ تا ۱۰ میلیون",OVER_10M:"بیشتر از ۱۰ میلیون"},
 primaryCategory:{APPAREL:"پوشاک",ACCESSORIES:"اکسسوری",HOME:"خانه و زندگی",STATIONERY:"لوازم تحریر",MIXED:"ترکیبی"},
 brandTone:{FUN:"بامزه و خودمانی",MINIMAL:"مینیمال",BOLD:"جسور",ARTISTIC:"هنری",PROFESSIONAL:"حرفه‌ای"},
};
const chartQuestions=[
 ["sellerType","نوع فعالیت","choice"],["experienceLevel","تجربه فروش آنلاین","choice"],
 ["instagramHandle","آیدی اینستاگرام","presence"],["websiteUrl","سایت فعلی","presence"],
 ["audienceSize","اندازه مخاطب","choice"],["monthlyViews","بازدید ماهانه","choice"],
 ["storeName","نام فروشگاه","presence"],
 ["storeDescription","توضیح فروشگاه","presence"],["primaryCategory","دسته اصلی محصولات","choice"],
 ["brandTone","حال‌وهوای برند","choice"],
 ["brandColor","رنگ اصلی برند","color"],
] as const;
function sellerAnswerCharts(rows:unknown[]):SellerAnswerChart[]{
 const answers=rows.map(row=>((row as {onboarding_answers?:unknown}).onboarding_answers||{}) as Record<string,unknown>);
 return chartQuestions.map(([key,title,kind])=>{
  const counts=new Map<string,number>();
  for(const answer of answers){
   const raw=typeof answer[key]==="string"?String(answer[key]).trim():"";
   const value=kind==="presence"?(raw?"ANSWERED":"EMPTY"):(raw||"EMPTY");
   counts.set(value,(counts.get(value)||0)+1);
  }
  const values=[...counts].sort((a,b)=>b[1]-a[1]).map(([value,count])=>({
   label:kind==="presence"?(value==="ANSWERED"?"تکمیل‌شده":"بدون پاسخ"):(value==="EMPTY"?"بدون پاسخ":answerLabels[key]?.[value]||value),
   count,percentage:answers.length?count*100/answers.length:0,
   ...(kind==="color"&&/^#[0-9a-f]{6}$/i.test(value)?{color:value}:{}),
  }));
  return{key,title,total:answers.length,values};
 });
}
const funnelNumber=(value:unknown)=>Math.max(0,Number(value)||0);
function normalizeFunnel(value:unknown):SellerFunnel{
 const row=(value||{}) as Record<string,unknown>;
 return{uniqueVisitors:funnelNumber(row.uniqueVisitors),allSellers:funnelNumber(row.allSellers),withSales:funnelNumber(row.withSales),moreThanOne:funnelNumber(row.moreThanOne),moreThanFive:funnelNumber(row.moreThanFive),moreThanTen:funnelNumber(row.moreThanTen),exactlyOne:funnelNumber(row.exactlyOne),twoToFive:funnelNumber(row.twoToFive),sixToTen:funnelNumber(row.sixToTen),overTen:funnelNumber(row.overTen)};
}
async function fallbackSellerFunnel(db:ReturnType<typeof createSupabaseAdmin>,days:number):Promise<SellerFunnel>{
 const sellerCount=await db.from("organizations").select("id",{count:"exact",head:true}).eq("type","SELLER");
 if(sellerCount.error)throw new Error(sellerCount.error.message);
 const sales=new Map<string,number>();
 for(let from=0;;from+=1000){
  const page=await db.from("order_items").select("seller_organization_id,quantity,orders!inner(paid_at,status)").not("seller_organization_id","is",null).not("orders.paid_at","is",null).not("orders.status","in",'("CANCELLED","RETURNED")').range(from,from+999);
  if(page.error)throw new Error(page.error.message);
  for(const item of page.data||[]){const id=item.seller_organization_id;if(id)sales.set(id,(sales.get(id)||0)+Number(item.quantity));}
  if((page.data?.length||0)<1000)break;
 }
 const visitorHashes=new Set<string>();
 const startsOn=new Date(Date.now()-(Math.max(1,Math.min(days,730))-1)*86400000).toISOString().slice(0,10);
 for(let from=0;;from+=1000){
  const page=await db.from("storefront_unique_visits").select("visitor_hash").gte("day",startsOn).range(from,from+999);
  if(page.error){if(page.error.code==="PGRST205"||page.error.message.includes("storefront_unique_visits"))break;throw new Error(page.error.message);}
  for(const visit of page.data||[])visitorHashes.add(visit.visitor_hash);
  if((page.data?.length||0)<1000)break;
 }
 const totals=[...sales.values()];
 return{uniqueVisitors:visitorHashes.size,allSellers:sellerCount.count||0,withSales:totals.filter(value=>value>=1).length,moreThanOne:totals.filter(value=>value>1).length,moreThanFive:totals.filter(value=>value>5).length,moreThanTen:totals.filter(value=>value>10).length,exactlyOne:totals.filter(value=>value===1).length,twoToFive:totals.filter(value=>value>=2&&value<=5).length,sixToTen:totals.filter(value=>value>=6&&value<=10).length,overTen:totals.filter(value=>value>10).length};
}
export async function getAdminAnalytics(days:number):Promise<AdminAnalyticsData>{
 const db=createSupabaseAdmin();
 const rpc=db.rpc as unknown as (name:string,args:object)=>Promise<{data:unknown;error:{message:string}|null}>;
 const p_days=Math.max(1,Math.min(days,730));
 const [analytics,attribution,profiles,funnelResult]=await Promise.all([
  rpc("service_admin_analytics",{p_days}),
  rpc("service_admin_attribution",{p_days}),
  db.from("seller_profiles").select("onboarding_answers"),
  rpc("service_admin_seller_funnel",{p_days}),
 ]);
 if(analytics.error||attribution.error||profiles.error)throw new Error(analytics.error?.message||attribution.error?.message||profiles.error?.message);
 const funnel=funnelResult.error
  ? await fallbackSellerFunnel(db,p_days)
  : normalizeFunnel(funnelResult.data);
 return {...(analytics.data as Omit<AdminAnalyticsData,"funnel"|"attribution"|"sellerAnswers">),funnel,attribution:(attribution.data||[]) as AttributionPoint[],sellerAnswers:sellerAnswerCharts((profiles.data||[]) as unknown[])};
}
