import { AdminAnalyticsChart } from "@/components/admin-analytics-chart";
import { getAdminAnalytics } from "@/lib/admin-analytics";
export default async function AnalyticsPage({searchParams}:{searchParams:Promise<{days?:string}>}){
 const raw=Number((await searchParams).days||30);const days=Number.isFinite(raw)?Math.max(1,Math.min(Math.trunc(raw),730)):30;
 return <div className="admin-page"><div className="admin-page-title"><div><span>تحلیل عملکرد</span><h1>آنالیتیکس</h1></div></div><AdminAnalyticsChart data={await getAdminAnalytics(days)} days={days}/></div>;
}
