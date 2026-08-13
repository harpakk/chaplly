import Image from "next/image";

const ENAMAD_URL =
  "https://trustseal.enamad.ir/?id=487791&Code=qrE7sbA03shPD1EHYzz2G08u9TQwGpVx";

export function TrustLogos() {
  return (
    <div className="trust-logos" aria-label="نمادهای اعتماد چاپلی">
      <a
        href={ENAMAD_URL}
        target="_blank"
        rel="noopener"
        referrerPolicy="origin"
        aria-label="مشاهده اعتبار نماد اعتماد الکترونیکی چاپلی"
      >
        <Image
          src="/images/trust/enamad.jpg"
          alt="نماد اعتماد الکترونیکی"
          width={100}
          height={100}
          referrerPolicy="origin"
        />
      </a>
      <span><Image src="/images/trust/nezam-senfi.jpg" alt="نماد نظام صنفی رایانه‌ای" width={100} height={100} /></span>
      <span><Image src="/images/trust/samandehi.webp" alt="نشان ملی ثبت رسانه‌های دیجیتال" width={100} height={100} /></span>
      <span><Image src="/images/trust/zarinpal.jpg" alt="پرداخت امن زرین‌پال" width={100} height={100} /></span>
    </div>
  );
}
