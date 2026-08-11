import "server-only";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
export type AnalyticsPoint={day:string;indexViews:number;productViews:number;sales:number;averageBasket:number;totalSales:number;conversionRate:number};
export type AttributionPoint={sourceKey:string;visits:number;uniqueVisits:number;signups:number;buys:number;visitPercentage:number};
export type AdminAnalyticsData={series:AnalyticsPoint[];sellers:{all:number;moreThanFive:number;withSales:number};attribution:AttributionPoint[]};
export async function getAdminAnalytics(days:number):Promise<AdminAnalyticsData>{
 const db=createSupabaseAdmin();
 const rpc=db.rpc as unknown as (name:string,args:object)=>Promise<{data:unknown;error:{message:string}|null}>;
 const p_days=Math.max(1,Math.min(days,730));
 const [analytics,attribution]=await Promise.all([
  rpc("service_admin_analytics",{p_days}),
  rpc("service_admin_attribution",{p_days}),
 ]);
 if(analytics.error||attribution.error)throw new Error(analytics.error?.message||attribution.error?.message);
 return {...(analytics.data as Omit<AdminAnalyticsData,"attribution">),attribution:(attribution.data||[]) as AttributionPoint[]};
}
