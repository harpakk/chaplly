import { createHash } from "crypto";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

type CopyRequest = { designId?: string; requestId?: string; imageDataUrl?: string };
type Quota = { allowed: boolean; limit: number; used: number; remaining: number };

const outputText = (payload: { output?: Array<{ content?: Array<{ type?: string; text?: string }> }> }) =>
  (payload.output || []).flatMap((item) => item.content || []).filter((item) => item.type === "output_text").map((item) => item.text || "").join("").trim();

export async function POST(request: Request) {
  const user = await getCurrentUser();
  const seller = user?.memberships.some((item) => item.organization.type === "SELLER" && item.status === "ACTIVE");
  if (!user || !seller) return NextResponse.json({ message: "برای استفاده از دستیار وارد حساب فروشنده شوید." }, { status: 401 });
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return NextResponse.json({ message: "دستیار هوشمند فعلاً در دسترس نیست." }, { status: 503 });

  const body = (await request.json().catch(() => ({}))) as CopyRequest;
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuid.test(body.designId || "") || !uuid.test(body.requestId || ""))
    return NextResponse.json({ message: "اطلاعات طرح معتبر نیست." }, { status: 400 });
  if (body.imageDataUrl && (!/^data:image\/(png|jpeg|webp);base64,/i.test(body.imageDataUrl) || body.imageDataUrl.length > 5_500_000))
    return NextResponse.json({ message: "حجم یا فرمت تصویر پیش‌نمایش مناسب نیست." }, { status: 400 });

  const db = createSupabaseAdmin();
  const { data: design, error: designError } = await db.from("designs").select("id,raw_product_id").eq("id", body.designId!).eq("owner_user_id", user.id).maybeSingle();
  if (designError || !design) return NextResponse.json({ message: "طرح برای این فروشنده پیدا نشد." }, { status: 404 });

  const { data: quotaData, error: quotaError } = await db.rpc("service_reserve_seller_ai_copy", { p_user_id: user.id, p_design_id: design.id, p_request_id: body.requestId! });
  if (quotaError) {
    console.error("Seller AI copy quota reservation failed", quotaError);
    return NextResponse.json({ message: "بررسی سهمیه دستیار انجام نشد؛ کمی بعد دوباره تلاش کنید." }, { status: 503 });
  }
  const quota = quotaData as unknown as Quota;
  if (!quota.allowed)
    return NextResponse.json({ message: "سهمیه رایگان امروز تمام شده است؛ فردا دوباره امتحان کنید.", quota }, { status: 429 });

  const refund = async () => {
    const { error } = await db.rpc("service_release_seller_ai_copy", { p_user_id: user.id, p_request_id: body.requestId! });
    if (error) console.error("Seller AI copy quota refund failed", error);
  };

  try {
    const [{ data: raw, error: rawError }, { data: selected, error: selectedError }] = await Promise.all([
      db.from("raw_products").select("name,material,production_notes,category_id").eq("id", design.raw_product_id).maybeSingle(),
      db.from("design_variants").select("raw_product_variant_id").eq("design_id", design.id),
    ]);
    if (rawError || selectedError || !raw) throw new Error("PRODUCT_CONTEXT_UNAVAILABLE");
    const variantIds = (selected || []).map((item) => item.raw_product_variant_id);
    const [{ data: category }, variantsResult, { data: colors }, { data: sizes }] = await Promise.all([
      raw.category_id ? db.from("categories").select("name").eq("id", raw.category_id).maybeSingle() : Promise.resolve({ data: null }),
      variantIds.length ? db.from("raw_product_variants").select("id,color_id,size_id").in("id", variantIds) : Promise.resolve({ data: [], error: null }),
      db.from("raw_product_colors").select("id,name").eq("raw_product_id", design.raw_product_id),
      db.from("raw_product_sizes").select("id,name").eq("raw_product_id", design.raw_product_id),
    ]);
    if (variantsResult.error) throw variantsResult.error;
    const colorNames = new Map((colors || []).map((item) => [item.id, item.name]));
    const sizeNames = new Map((sizes || []).map((item) => [item.id, item.name]));
    const varieties = (variantsResult.data || []).map((item) => `${colorNames.get(item.color_id) || "رنگ استاندارد"} / ${sizeNames.get(item.size_id) || "سایز استاندارد"}`);
    const context = [`نوع محصول: ${category?.name || "محصول چاپی"}`, `نام محصول خام: ${raw.name}`, raw.material ? `جنس: ${raw.material}` : "", raw.production_notes ? `نکات تولید: ${raw.production_notes}` : "", varieties.length ? `تنوع‌ها: ${[...new Set(varieties)].join("، ")}` : ""].filter(Boolean).join("\n");
    const content: Array<Record<string, string>> = [{ type: "input_text", text: context }];
    if (body.imageDataUrl) content.push({ type: "input_image", image_url: body.imageDataUrl, detail: "low" });
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: process.env.OPENAI_PRODUCT_COPY_MODEL || "gpt-5.6-luna",
        instructions: "شما کپی‌رایتر فارسی فروشگاه چاپلی هستید. برای همین محصول یک عنوان طبیعی و متمایز، یک زیرعنوان کوتاه و توضیح انسانی و متقاعدکننده بنویسید. فقط از اطلاعات داده‌شده و چیزهایی که واقعاً در تصویر دیده می‌شود استفاده کنید؛ ویژگی، تضمین یا جنس اختراع نکنید. لحن صمیمی، حرفه‌ای و مناسب فروشگاه ایرانی باشد. نام محصول خام را عیناً به‌عنوان عنوان تکرار نکنید. توضیح ۲ تا ۴ پاراگراف کوتاه و بدون Markdown باشد.",
        input: [{ role: "user", content }],
        text: { format: { type: "json_schema", name: "seller_product_copy", strict: true, schema: { type: "object", additionalProperties: false, properties: { title: { type: "string", minLength: 3, maxLength: 90 }, subtitle: { type: "string", minLength: 3, maxLength: 140 }, description: { type: "string", minLength: 40, maxLength: 1800 } }, required: ["title", "subtitle", "description"] } } },
        max_output_tokens: 900,
        safety_identifier: createHash("sha256").update(`chapli-product-copy:${user.id}`).digest("hex"),
        store: false,
      }),
      signal: AbortSignal.timeout(45_000),
    });
    if (!response.ok) throw new Error(`OPENAI_${response.status}`);
    const text = outputText(await response.json());
    const copy = JSON.parse(text) as { title?: string; subtitle?: string; description?: string };
    if (!copy.title?.trim() || !copy.subtitle?.trim() || !copy.description?.trim()) throw new Error("EMPTY_PRODUCT_COPY");
    return NextResponse.json({ copy: { title: copy.title.trim(), subtitle: copy.subtitle.trim(), description: copy.description.trim() }, quota });
  } catch (error) {
    await refund();
    console.error("Seller AI product copy failed", error);
    return NextResponse.json({ message: "ساخت متن انجام نشد و از سهمیه شما کم نشد؛ دوباره تلاش کنید." }, { status: 502 });
  }
}
