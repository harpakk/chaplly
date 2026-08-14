import { CouponManager } from "@/components/coupon-manager";
import { createSellerCouponAction, toggleSellerCouponAction } from "@/app/actions/dashboard";
import { requireSeller } from "@/lib/auth";
import { getCouponManagementData } from "@/lib/coupon-data";

export default async function SellerCouponsPage() {
  const context = await requireSeller();
  const data = await getCouponManagementData(context.membership.organization.id);
  return <div className="sd-page"><div className="sd-page-head"><span>فروش و بازاریابی</span><h1>کدهای تخفیف</h1><p>کدهای تخفیف فروشگاه را بسازید، محدود کنید و فعال یا غیرفعال نمایید.</p></div><CouponManager data={data} seller createAction={createSellerCouponAction} toggleAction={toggleSellerCouponAction} /></div>;
}
