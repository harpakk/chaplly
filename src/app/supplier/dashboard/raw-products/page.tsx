import { SupplierConsole } from "@/components/supplier-console";
import { requireSupplier } from "@/lib/auth";
import { getSupplierDashboardData } from "@/lib/dashboard-data";
import Link from "next/link";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
export default async function Page(){
  const context=await requireSupplier();
  const organizationId=context.membership.organization.id;
  const {data:profile}=await createSupabaseAdmin().from("supplier_profiles").select("capacity_per_day").eq("organization_id",organizationId).maybeSingle();
  if(!profile?.capacity_per_day)return <main className="supplier-page"><div className="inventory-warning-banner inventory-empty-banner"><div><b>ظرفیت تولید روزانه هنوز ثبت نشده است</b><span>پیش از ثبت محصول خام، ظرفیت روزانه مجموعه را در پروفایل وارد کنید.</span></div><Link href="/supplier/dashboard/settings">تکمیل پروفایل</Link></div></main>;
  return <SupplierConsole section="raw-products" data={await getSupplierDashboardData(organizationId,"raw-products")}/>;
}
