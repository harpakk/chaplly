import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

const escapeHtml = (value: unknown) =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ number: string }> },
) {
  const { number } = await params;
  const receipt = request.nextUrl.searchParams.get("receipt") || "";
  const user = await getCurrentUser();
  const db = createSupabaseAdmin();
  let query = db
    .from("orders")
    .select(
      "number,buyer_user_id,subtotal,shipping_amount,total,currency,shipping_address_snapshot,created_at,paid_at,order_items(quantity,line_total,product_snapshot)",
    )
    .eq("number", number);
  query = user
    ? query.eq("buyer_user_id", user.id)
    : query.eq("idempotency_key", receipt).is("buyer_user_id", null);
  const { data: order, error } = await query.maybeSingle();
  if (error || !order)
    return NextResponse.json({ error: "INVOICE_NOT_FOUND" }, { status: 404 });

  const address = order.shipping_address_snapshot as Record<string, unknown>;
  const itemRows = order.order_items
    .map((item) => {
      const snapshot = item.product_snapshot as Record<string, unknown>;
      return `<tr><td>${escapeHtml(snapshot.title || "محصول")}</td><td>${escapeHtml(snapshot.color || "")} / ${escapeHtml(snapshot.size || "")}</td><td>${item.quantity}</td><td>${Number(item.line_total).toLocaleString("fa-IR")} ریال</td></tr>`;
    })
    .join("");
  const html = `<!doctype html><html lang="fa" dir="rtl"><head><meta charset="utf-8"><title>فاکتور ${escapeHtml(order.number)}</title><style>body{font-family:Tahoma,sans-serif;max-width:900px;margin:40px auto;color:#17241f}header{display:flex;justify-content:space-between;border-bottom:2px solid #16834f;padding-bottom:18px}table{width:100%;border-collapse:collapse;margin:30px 0}th,td{border:1px solid #ddd;padding:12px;text-align:right}.total{font-size:20px;font-weight:bold;color:#16834f}.address{background:#f4f7f5;padding:16px;border-radius:10px}</style></head><body><header><div><h1>فاکتور چاپلی</h1><p>شماره سفارش: <b>${escapeHtml(order.number)}</b></p></div><div><p>تاریخ: ${new Date(order.created_at).toLocaleDateString("fa-IR")}</p><p>وضعیت پرداخت: موفق</p></div></header><table><thead><tr><th>محصول</th><th>تنوع</th><th>تعداد</th><th>مبلغ</th></tr></thead><tbody>${itemRows}</tbody></table><p>هزینه ارسال: ${Number(order.shipping_amount).toLocaleString("fa-IR")} ریال</p><p class="total">مبلغ پرداخت‌شده: ${Number(order.total).toLocaleString("fa-IR")} ریال</p><div class="address"><b>نشانی تحویل</b><p>${escapeHtml(address.recipientName || address.recipient_name)} — ${escapeHtml(address.addressLine || address.address_line)}</p><p>${escapeHtml(address.phone)}</p></div></body></html>`;
  return new NextResponse(html, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "content-disposition": `attachment; filename="chapli-invoice-${order.number}.html"`,
      "cache-control": "private, no-store",
    },
  });
}
