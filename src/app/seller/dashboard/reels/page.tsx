import { requireSeller } from "@/lib/auth";
import { getSellerReelUploadData } from "@/lib/dashboard-data";
import { SellerReelUploader } from "@/components/seller-reel-uploader";

export default async function SellerReelsPage() {
  const context = await requireSeller();
  const store = context.membership.organization.stores[0];
  const data = store ? await getSellerReelUploadData(store.id) : { products: [], reels: [] };
  return <div className="sd-page"><div className="sd-page-head"><span>محتوای ویدیویی</span><h1>ریلز محصولات</h1><p>ویدیوهای کوتاه محصولاتتان را برای نمایش در چاپلی ارسال کنید.</p></div><SellerReelUploader products={data.products} reels={data.reels}/></div>;
}
