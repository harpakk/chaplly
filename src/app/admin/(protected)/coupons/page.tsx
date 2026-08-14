import { CouponManager } from "@/components/coupon-manager";
import { createAdminCouponAction, toggleAdminCouponAction } from "@/app/actions/dashboard";
import { getCouponManagementData } from "@/lib/coupon-data";

export default async function AdminCouponsPage() {
  const data = await getCouponManagementData();
  return <div className="admin-page coupon-admin-page"><div className="admin-page-title"><span>فروش و بازاریابی</span><h1>مدیریت کدهای تخفیف</h1><p>کدهای عمومی یا محدود به فروشگاه و نوع محصول ایجاد کنید.</p></div><CouponManager data={data} seller={false} createAction={createAdminCouponAction} toggleAction={toggleAdminCouponAction} /></div>;
}
