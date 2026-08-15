import "server-only";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
export type AnalyticsPoint={day:string;indexViews:number;productViews:number;sales:number;averageBasket:number;totalSales:number;conversionRate:number};
export type AttributionPoint={sourceKey:string;visits:number;uniqueVisits:number;signups:number;buys:number;visitPercentage:number};
export type SellerAnswerChart={key:string;title:string;total:number;values:{label:string;count:number;percentage:number;color?:string}[]};
export type AdminAnalyticsData={series:AnalyticsPoint[];sellers:{all:number;moreThanFive:number;withSales:number};attribution:AttributionPoint[];sellerAnswers:SellerAnswerChart[]};
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
export async function getAdminAnalytics(days:number):Promise<AdminAnalyticsData>{
 const db=createSupabaseAdmin();
 const rpc=db.rpc as unknown as (name:string,args:object)=>Promise<{data:unknown;error:{message:string}|null}>;
 const p_days=Math.max(1,Math.min(days,730));
 const [analytics,attribution,profiles]=await Promise.all([
  rpc("service_admin_analytics",{p_days}),
  rpc("service_admin_attribution",{p_days}),
  db.from("seller_profiles").select("onboarding_answers"),
 ]);
 if(analytics.error||attribution.error||profiles.error)throw new Error(analytics.error?.message||attribution.error?.message||profiles.error?.message);
 return {...(analytics.data as Omit<AdminAnalyticsData,"attribution"|"sellerAnswers">),attribution:(attribution.data||[]) as AttributionPoint[],sellerAnswers:sellerAnswerCharts((profiles.data||[]) as unknown[])};
}
