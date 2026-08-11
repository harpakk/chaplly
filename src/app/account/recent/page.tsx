import { AccountShell } from "@/components/account-shell";
import { ProductCard } from "@/components/product-card";
import { requireBuyer } from "@/lib/auth";
import { getBuyerAccountData } from "@/lib/dashboard-data";
export default async function RecentPage(){const user=await requireBuyer();const data=await getBuyerAccountData(user.id);const name=[data.profile.first_name,data.profile.last_name].filter(Boolean).join(" ");return <AccountShell active="/account/recent" name={name}><div className="account-heading"><span>ردپای خوش‌سلیقگی</span><h1>دیده‌شده‌های اخیر</h1><p>برای وقتی که اسمش یادت نیست ولی هنوز توی ذهنت مانده.</p></div>{data.recent.length?<div className="product-grid account-products">{data.recent.map((item)=><ProductCard product={item} key={item.id}/>)}</div>:<div className="empty-state">هنوز محصولی را ندیده‌ای.</div>}</AccountShell>}
