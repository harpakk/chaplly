import Link from "next/link";
import { ArrowLeft, Compass, Home, Search } from "lucide-react";

export default function NotFound() {
  return (
    <main className="chapli-404" dir="rtl">
      <section>
        <div className="chapli-404-code">
          <span>۴</span>
          <i>چ</i>
          <span>۴</span>
        </div>
        <small>این صفحه از چاپ خارج شده!</small>
        <h1>چیزی که دنبالش بودی اینجا نیست</h1>
        <p>
          ممکن است لینک تغییر کرده باشد، محصول حذف شده باشد یا آدرس را کمی
          متفاوت نوشته باشی.
        </p>
        <div>
          <Link className="primary" href="/">
            <Home /> بازگشت به خانه
          </Link>
          <Link href="/search">
            <Search /> جست‌وجوی محصولات
          </Link>
        </div>
        <Link className="discover" href="/#products">
          <Compass /> دیدن محصولات تازه <ArrowLeft />
        </Link>
      </section>
    </main>
  );
}
