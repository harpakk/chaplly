import "server-only";

import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { dispatchSmsOutbox, queueSms } from "@/lib/sms";

const one = <T>(value: T | T[] | null | undefined): T | undefined =>
  Array.isArray(value) ? value[0] : (value ?? undefined);
const text = (value: unknown) => typeof value === "string" ? value : "";
const snapshot = (value: unknown) => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};

async function organizationRecipients(organizationIds: string[]) {
  if (!organizationIds.length) return new Map<string, { userId: string; phone: string; name: string }>();
  const db = createSupabaseAdmin();
  const [{ data: memberships }, { data: organizations }] = await Promise.all([
    db.from("memberships").select("organization_id,user_id,role,profiles!memberships_user_id_fkey(first_name,last_name,phone)").in("organization_id", organizationIds).eq("status", "ACTIVE"),
    db.from("organizations").select("id,display_name,contact_phone").in("id", organizationIds),
  ]);
  const result = new Map<string, { userId: string; phone: string; name: string }>();
  for (const organizationId of organizationIds) {
    const membership = (memberships || []).filter((item) => item.organization_id === organizationId).sort((a, b) => Number(b.role === "OWNER") - Number(a.role === "OWNER"))[0];
    const profile = one(membership?.profiles);
    const organization = (organizations || []).find((item) => item.id === organizationId);
    result.set(organizationId, {
      userId: membership?.user_id || "",
      phone: profile?.phone || organization?.contact_phone || "",
      name: organization?.display_name || [profile?.first_name, profile?.last_name].filter(Boolean).join(" "),
    });
  }
  return result;
}

export async function queueOrderPaidSms(orderId: string) {
  const db = createSupabaseAdmin();
  const [{ data: order }, { data: items }, { data: fulfilments }] = await Promise.all([
    db.from("orders").select("id,number,buyer_user_id,total,customer_snapshot,paid_at,profiles!orders_buyer_user_id_fkey(first_name,last_name,phone)").eq("id", orderId).maybeSingle(),
    db.from("order_items").select("id,seller_organization_id,supplier_organization_id,product_snapshot").eq("order_id", orderId),
    db.from("fulfilments").select("id,supplier_organization_id,due_at").eq("order_id", orderId),
  ]);
  if (!order?.paid_at) return;
  const customer = snapshot(order.customer_snapshot);
  const buyer = one(order.profiles);
  const buyerFirstName = buyer?.first_name || text(customer.firstName) || text(customer.first_name) || text(customer.recipientName) || "مشتری";
  const buyerPhone = buyer?.phone || text(customer.phone);
  await queueSms({ eventType: "BUYER_ORDER_PAID", recipientUserId: order.buyer_user_id, recipientPhone: buyerPhone, payload: { buyerFirstName, orderNumber: order.number }, idempotencyKey: `sms:BUYER_ORDER_PAID:${order.id}` });

  const productNames = (items || []).map((item) => text(snapshot(item.product_snapshot).title)).filter(Boolean);
  const sellerIds = [...new Set((items || []).map((item) => item.seller_organization_id).filter(Boolean))] as string[];
  const supplierIds = [...new Set((items || []).map((item) => item.supplier_organization_id).filter(Boolean))] as string[];
  const recipients = await organizationRecipients([...new Set([...sellerIds, ...supplierIds])]);
  for (const organizationId of sellerIds) {
    const recipient = recipients.get(organizationId)!;
    const names = (items || []).filter((item) => item.seller_organization_id === organizationId).map((item) => text(snapshot(item.product_snapshot).title)).filter(Boolean).join("، ");
    await queueSms({ eventType: "SELLER_NEW_ORDER", recipientUserId: recipient.userId || null, recipientPhone: recipient.phone, payload: { orderNumber: order.number, totalPrice: Number(order.total).toLocaleString("fa-IR"), productNames: names, sellerName: recipient.name }, idempotencyKey: `sms:SELLER_NEW_ORDER:${order.id}:${organizationId}` });
  }
  for (const organizationId of supplierIds) {
    const recipient = recipients.get(organizationId)!;
    const names = (items || []).filter((item) => item.supplier_organization_id === organizationId).map((item) => text(snapshot(item.product_snapshot).title)).filter(Boolean).join("، ") || productNames.join("، ");
    await queueSms({ eventType: "SUPPLIER_NEW_ORDER", recipientUserId: recipient.userId || null, recipientPhone: recipient.phone, payload: { orderNumber: order.number, productNames: names, supplierName: recipient.name }, idempotencyKey: `sms:SUPPLIER_NEW_ORDER:${order.id}:${organizationId}` });
  }
  for (const fulfilment of fulfilments || []) {
    if (!fulfilment.due_at) continue;
    const recipient = recipients.get(fulfilment.supplier_organization_id);
    await queueSms({ eventType: "SUPPLIER_SHIPPING_DEADLINE", recipientUserId: recipient?.userId || null, recipientPhone: recipient?.phone, payload: { orderNumber: order.number }, idempotencyKey: `sms:SUPPLIER_SHIPPING_DEADLINE:${fulfilment.id}`, availableAt: new Date(new Date(fulfilment.due_at).getTime() - 36 * 3600000).toISOString() });
  }
  await dispatchSmsOutbox();
}

export async function queueOrderShippedSms(fulfilmentId: string, carrier: string, trackingCode: string) {
  const db = createSupabaseAdmin();
  const { data: fulfilment } = await db.from("fulfilments").select("id,order_id,orders(id,number,buyer_user_id,customer_snapshot,profiles!orders_buyer_user_id_fkey(first_name,phone))").eq("id", fulfilmentId).maybeSingle();
  const order = one(fulfilment?.orders);
  if (!order) return;
  const customer = snapshot(order.customer_snapshot), buyer = one(order.profiles);
  await queueSms({ eventType: "BUYER_ORDER_SHIPPED", recipientUserId: order.buyer_user_id, recipientPhone: buyer?.phone || text(customer.phone), payload: { buyerFirstName: buyer?.first_name || text(customer.firstName), orderNumber: order.number, carrier, trackingCode }, idempotencyKey: `sms:BUYER_ORDER_SHIPPED:${fulfilmentId}` });
  await dispatchSmsOutbox();
}

export async function queueCompletedReviewSms() {
  const db = createSupabaseAdmin();
  const cutoff = new Date(Date.now() - 2 * 86400000).toISOString();
  const { data: orders } = await db.from("orders").select("id,number,buyer_user_id,customer_snapshot,completed_at,profiles!orders_buyer_user_id_fkey(first_name,phone),order_items(product_snapshot)").eq("status", "DONE").lte("completed_at", cutoff).limit(100);
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "https://chaplly.ir").replace(/\/$/, "");
  for (const order of orders || []) {
    const customer = snapshot(order.customer_snapshot), buyer = one(order.profiles);
    const productNames = (order.order_items || []).map((item) => text(snapshot(item.product_snapshot).title)).filter(Boolean).join("، ");
    await queueSms({ eventType: "BUYER_REVIEW_REQUEST", recipientUserId: order.buyer_user_id, recipientPhone: buyer?.phone || text(customer.phone), payload: { buyerFirstName: buyer?.first_name || text(customer.firstName), productNames, orderNumber: order.number, reviewUrl: `${appUrl}/review?order=${encodeURIComponent(order.number)}` }, idempotencyKey: `sms:BUYER_REVIEW_REQUEST:${order.id}` });
  }
}

export async function queueOrderLifecycleSms(orderId: string, event: "DELIVERED" | "CANCELLED") {
  const db = createSupabaseAdmin();
  const { data: order } = await db.from("orders").select("id,number,buyer_user_id,customer_snapshot,profiles!orders_buyer_user_id_fkey(first_name,phone),order_items(seller_organization_id,supplier_organization_id,product_snapshot)").eq("id", orderId).maybeSingle();
  if (!order) return;
  const customer = snapshot(order.customer_snapshot), buyer = one(order.profiles);
  const buyerPayload = { buyerFirstName: buyer?.first_name || text(customer.firstName), orderNumber: order.number };
  if (event === "DELIVERED") {
    await queueSms({ eventType: "BUYER_ORDER_DELIVERED", recipientUserId: order.buyer_user_id, recipientPhone: buyer?.phone || text(customer.phone), payload: buyerPayload, idempotencyKey: `sms:BUYER_ORDER_DELIVERED:${order.id}` });
  } else {
    await queueSms({ eventType: "BUYER_ORDER_CANCELLED", recipientUserId: order.buyer_user_id, recipientPhone: buyer?.phone || text(customer.phone), payload: buyerPayload, idempotencyKey: `sms:BUYER_ORDER_CANCELLED:${order.id}` });
    const items = order.order_items || [];
    const sellerIds = [...new Set(items.map((item) => item.seller_organization_id).filter(Boolean))] as string[];
    const supplierIds = [...new Set(items.map((item) => item.supplier_organization_id).filter(Boolean))] as string[];
    const recipients = await organizationRecipients([...sellerIds, ...supplierIds]);
    for (const [role, ids] of [["SELLER", sellerIds], ["SUPPLIER", supplierIds]] as const)
      for (const organizationId of ids) {
        const recipient = recipients.get(organizationId)!;
        const productNames = items.filter((item) => role === "SELLER" ? item.seller_organization_id === organizationId : item.supplier_organization_id === organizationId).map((item) => text(snapshot(item.product_snapshot).title)).filter(Boolean).join("، ");
        await queueSms({ eventType: `${role}_ORDER_CANCELLED`, recipientUserId: recipient.userId || null, recipientPhone: recipient.phone, payload: { orderNumber: order.number, productNames }, idempotencyKey: `sms:${role}_ORDER_CANCELLED:${order.id}:${organizationId}` });
      }
  }
  await dispatchSmsOutbox();
}

export async function queueReturnApprovedSms(returnId: string) {
  const db = createSupabaseAdmin();
  const { data: request } = await db.from("return_requests").select("id,buyer_user_id,order_items(orders(id,number,customer_snapshot,profiles!orders_buyer_user_id_fkey(first_name,phone)))").eq("id", returnId).maybeSingle();
  const order = one(one(request?.order_items)?.orders);
  if (!request || !order) return;
  const customer = snapshot(order.customer_snapshot), buyer = one(order.profiles);
  await queueSms({ eventType: "BUYER_RETURN_APPROVED", recipientUserId: request.buyer_user_id, recipientPhone: buyer?.phone || text(customer.phone), payload: { buyerFirstName: buyer?.first_name || text(customer.firstName), orderNumber: order.number }, idempotencyKey: `sms:BUYER_RETURN_APPROVED:${returnId}` });
  await dispatchSmsOutbox();
}

export async function queuePayoutPaidSms(payoutId: string, reference: string | null) {
  const db = createSupabaseAdmin();
  const { data: payout } = await db.from("payout_requests").select("id,organization_id,amount,organizations(type,display_name)").eq("id", payoutId).maybeSingle();
  const organization = one(payout?.organizations);
  if (!payout || !organization || !["SELLER", "SUPPLIER"].includes(organization.type)) return;
  const recipient = (await organizationRecipients([payout.organization_id])).get(payout.organization_id);
  await queueSms({ eventType: `${organization.type}_PAYOUT_PAID`, recipientUserId: recipient?.userId || null, recipientPhone: recipient?.phone, payload: { recipientName: recipient?.name || organization.display_name, amount: Number(payout.amount).toLocaleString("fa-IR"), reference: reference || "-" }, idempotencyKey: `sms:${organization.type}_PAYOUT_PAID:${payoutId}` });
  await dispatchSmsOutbox();
}

export async function queueSupplierExceptionSms(exceptionId: string, resolution: string) {
  const db = createSupabaseAdmin();
  const { data: exception } = await db.from("fulfilment_exceptions").select("id,supplier_organization_id,fulfilments(orders(number))").eq("id", exceptionId).maybeSingle();
  if (!exception) return;
  const recipient = (await organizationRecipients([exception.supplier_organization_id])).get(exception.supplier_organization_id);
  const order = one(one(exception.fulfilments)?.orders);
  await queueSms({ eventType: "SUPPLIER_EXCEPTION_RESOLVED", recipientUserId: recipient?.userId || null, recipientPhone: recipient?.phone, payload: { orderNumber: order?.number || "-", resolution }, idempotencyKey: `sms:SUPPLIER_EXCEPTION_RESOLVED:${exceptionId}` });
  await dispatchSmsOutbox();
}
