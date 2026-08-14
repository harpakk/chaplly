import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

const messages: Record<string, string> = {
  COUPON_INVALID: "کد تخفیف معتبر نیست.",
  COUPON_EXPIRED: "مهلت استفاده از این کد تخفیف تمام شده است.",
  COUPON_EXHAUSTED: "ظرفیت استفاده از این کد تخفیف تمام شده است.",
  COUPON_NOT_APPLICABLE: "این کد برای کالاهای سبد شما قابل استفاده نیست.",
};

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as {
      code?: string;
      items?: { variantId?: string; quantity?: number }[];
    };
    const code = String(payload.code || "").trim();
    const items = Array.isArray(payload.items) ? payload.items : [];
    if (!/^\d{1,6}$/.test(code) || !items.length)
      return NextResponse.json({ message: messages.COUPON_INVALID }, { status: 400 });
    const { data, error } = await createSupabaseAdmin().rpc("service_quote_coupon", {
      p_code: code,
      p_items: items.map((item) => ({
        variantId: String(item.variantId || ""),
        quantity: Number(item.quantity || 0),
      })),
    });
    if (error) {
      const key = Object.keys(messages).find((entry) => error.message.includes(entry));
      return NextResponse.json(
        { message: key ? messages[key] : "بررسی کد تخفیف انجام نشد." },
        { status: 400 },
      );
    }
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ message: "درخواست نامعتبر است." }, { status: 400 });
  }
}
