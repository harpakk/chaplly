import Link from "next/link";
import { Sparkles } from "lucide-react";

export default function SellerReelsPage() {
  return <div className="coming-soon-backdrop"><section className="coming-soon-dialog" role="dialog" aria-modal="true"><Sparkles/><span>قابلیت جدید چاپلی</span><h1>آپلود ریلز به‌زودی</h1><p>در حال آماده‌سازی تجربه‌ای بهتر برای ویدیوهای فروشندگان هستیم. فعلاً امکان مشاهده یا آپلود ریلز فعال نیست.</p><Link href="/seller/dashboard?section=products">بازگشت به محصولات</Link></section></div>;
}
