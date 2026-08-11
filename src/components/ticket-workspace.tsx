"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import {
  Bot,
  CheckCircle2,
  FileText,
  Paperclip,
  Plus,
  RotateCcw,
  Send,
  Shield,
  UserRound,
  X,
} from "lucide-react";
import { ActionForm } from "@/components/action-form";
import { SupportAiChat } from "@/components/support-ai-chat";
import {
  changeTicketStatusAction,
  createTicketAction,
  generateTicketAiDraftAction,
  sendTicketMessageAction,
} from "@/app/actions/dashboard";
import type { getTicketsData } from "@/lib/dashboard-data";

type Role = "seller" | "supplier" | "buyer" | "admin";
type TicketData = Awaited<ReturnType<typeof getTicketsData>>;
const date = (value: string) =>
  new Intl.DateTimeFormat("fa-IR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
const orderStatusFa = (status: string) =>
  ({
    PENDING: "در انتظار تأیید",
    CONFIRMED: "تأییدشده",
    IN_PRODUCTION: "در حال آماده‌سازی",
    READY_TO_SHIP: "آماده ارسال",
    PARTIALLY_SENT: "بخشی ارسال‌شده",
    SENT: "ارسال‌شده",
    DONE: "تحویل‌شده",
    CANCELLED: "لغوشده",
    RETURNED: "مرجوع‌شده",
    DISPUTED: "در حال بررسی",
  } as Record<string, string>)[status] || status;

export function TicketWorkspace({
  role,
  data,
  orders = [],
}: {
  role: Role;
  data: TicketData;
  orders?: Array<{ id: string; number: string; status: string }>;
}) {
  const searchParams = useSearchParams();
  const requestedOrder = searchParams.get("order") || "";
  const [active, setActive] = useState(data.tickets[0]?.id || "");
  const [filter, setFilter] = useState("OPEN");
  const [newOpen, setNewOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [newOrder, setNewOrder] = useState(requestedOrder || orders[0]?.number || "");
  const [newBody, setNewBody] = useState(requestedOrder || orders[0] ? `شماره سفارش: ${requestedOrder || orders[0]?.number}\n` : "");
  const [draft, setDraft] = useState("");
  const [aiSuggestion, setAiSuggestion] = useState("");
  const [aiMessage, setAiMessage] = useState("");
  const [aiPending, startAi] = useTransition();
  const current =
    data.tickets.find((ticket) => ticket.id === active) || data.tickets[0];
  const closed = current
    ? ["RESOLVED", "CLOSED"].includes(current.status)
    : false;
  useEffect(() => {
    setDraft("");
    setAiSuggestion(current?.ai_draft || "");
    setAiMessage("");
  }, [current?.id, current?.ai_draft]);
  useEffect(() => {
    if (!(["buyer", "seller"] as Role[]).includes(role) || searchParams.get("new") !== "1") return;
    const orderNumber = searchParams.get("order") || orders[0]?.number || "";
    const topic = searchParams.get("topic");
    const topicLabel = topic === "cancellation" ? "درخواست لغو" : topic === "return" ? "درخواست مرجوعی" : "گزارش مشکل";
    setNewOrder(orderNumber);
    setNewBody(`شماره سفارش: ${orderNumber}\nموضوع: ${topicLabel}\n`);
    if (role === "seller") setNewOpen(true);
    else setAiOpen(true);
  }, [orders, role, searchParams]);
  const visible = useMemo(
    () =>
      filter === "ALL"
        ? data.tickets
        : filter === "CLOSED"
          ? data.tickets.filter((ticket) =>
              ["RESOLVED", "CLOSED"].includes(ticket.status),
            )
          : data.tickets.filter(
              (ticket) => !["RESOLVED", "CLOSED"].includes(ticket.status),
            ),
    [data.tickets, filter],
  );
  const makeAiDraft = () => {
    if (!current) return;
    setAiMessage("");
    startAi(async () => {
      const formData = new FormData();
      formData.set("ticketId", current.id);
      const result = await generateTicketAiDraftAction(formData);
      if (result.ok && "draft" in result) setAiSuggestion(result.draft);
      setAiMessage(result.message);
    });
  };

  return (
    <div className={`ticket-workspace role-${role}`}>
      <aside className="ticket-filters">
        {role !== "admin" && (
          <button className="ticket-new" onClick={() => role === "supplier" ? setNewOpen(true) : setAiOpen(true)}>
            <Plus /> تیکت جدید
          </button>
        )}
        {[
          ["OPEN", "باز"],
          ["CLOSED", "حل‌شده"],
          ["ALL", "همه"],
        ].map(([key, label]) => (
          <button
            className={filter === key ? "active" : ""}
            onClick={() => setFilter(key)}
            key={key}
          >
            {label}
          </button>
        ))}
      </aside>
      <section className="ticket-inbox">
        <header>
          <div>
            <h2>{role === "admin" ? "صندوق پشتیبانی" : "پشتیبانی چاپلی"}</h2>
            <span>{visible.length} گفت‌وگو</span>
          </div>
        </header>
        {visible.length ? (
          visible.map((ticket) => (
            <button
              className={current?.id === ticket.id ? "active" : ""}
              onClick={() => setActive(ticket.id)}
              key={ticket.id}
            >
              <div>
                <span>
                  {ticket.id.slice(0, 8)} · {ticket.category}
                </span>
                <time>{date(ticket.last_message_at)}</time>
              </div>
              <h3>{ticket.subject}</h3>
              <p>{ticket.messages.at(-1)?.body || "بدون پیام"}</p>
              <footer>
                <em
                  className={
                    ticket.priority === "HIGH" || ticket.priority === "URGENT"
                      ? "high"
                      : ""
                  }
                >
                  {ticket.priority}
                </em>
                <span>{ticket.status}</span>
              </footer>
            </button>
          ))
        ) : (
          <div className="empty-state">تیکتی در این فیلتر نیست.</div>
        )}
      </section>
      {current ? (
        <section className="ticket-thread">
          <header>
            <div>
              <span>
                {current.id.slice(0, 8)} · مرجع{" "}
                {current.reference_id || "ندارد"}
              </span>
              <h2>{current.subject}</h2>
            </div>
            <div className="ticket-head-actions">
              <em>{current.priority}</em>
              <ActionForm action={changeTicketStatusAction}>
                <input type="hidden" name="role" value={role} />
                <input type="hidden" name="ticketId" value={current.id} />
                <input
                  type="hidden"
                  name="intent"
                  value={closed ? "reopen" : "close"}
                />
                <button className={closed ? "reopen" : "resolve"}>
                  {closed ? <RotateCcw /> : <CheckCircle2 />}
                  {closed ? "بازگشایی" : "حل و بستن"}
                </button>
              </ActionForm>
            </div>
          </header>
          {current.reference_id && (
            <div className="ticket-reference">
              <FileText />
              <div>
                <span>مرجع پیوست‌شده</span>
                <b>
                  {current.reference_type} · {current.reference_id}
                </b>
              </div>
            </div>
          )}
          <div className="ticket-messages">
            {current.messages.map((message) => (
              <article
                className={
                  message.sender_role === role.toUpperCase() ? "mine" : ""
                }
                key={message.id}
              >
                <i>
                  {message.sender_role === "ADMIN" ? <Shield /> : <UserRound />}
                </i>
                <div>
                  <header>
                    <b>
                      {message.sender
                        ? `${message.sender.first_name || ""} ${message.sender.last_name || ""}`
                        : message.sender_role}
                    </b>
                    <time>{date(message.created_at)}</time>
                  </header>
                  <p>{message.body}</p>
                  {message.visibility === "INTERNAL" && (
                    <small>یادداشت داخلی مدیر</small>
                  )}
                </div>
              </article>
            ))}
            {current.attachments.map((file) => (
              <a className="ticket-file" href={file.url} download key={file.id}>
                <FileText />
                {file.file_name}{" "}
                <small>
                  {Math.round(Number(file.size_bytes || 0) / 1024)} KB
                </small>
              </a>
            ))}
          </div>
          {closed ? (
            <div className="ticket-closed-note">
              این گفت‌وگو بسته شده است. برای ادامه، آن را بازگشایی کنید.
            </div>
          ) : (
            <ActionForm
              action={sendTicketMessageAction}
              className="ticket-composer"
              onSuccess={() => setDraft("")}
            >
              <input type="hidden" name="role" value={role} />
              <input type="hidden" name="ticketId" value={current.id} />
              {role === "admin" && aiSuggestion && (
                <div className="ticket-ai-suggestion">
                  <div><Bot /><b>پیش‌نویس پیشنهادی دستیار</b></div>
                  <p>{aiSuggestion}</p>
                  <button type="button" onClick={() => setDraft(aiSuggestion)}>
                    استفاده در کادر پاسخ
                  </button>
                </div>
              )}
              <textarea
                name="body"
                required
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                placeholder={
                  role === "admin"
                    ? "پاسخ پشتیبانی را بنویس…"
                    : "پیامت را واضح و با جزئیات بنویس…"
                }
              />
              {role === "admin" && (
                <div className="ticket-ai-row">
                  <button
                    type="button"
                    onClick={makeAiDraft}
                    disabled={aiPending}
                  >
                    <Bot />{" "}
                    {aiPending ? "در حال آماده‌سازی…" : "پیشنهاد پاسخ با AI"}
                  </button>
                  {aiMessage && <small>{aiMessage}</small>}
                </div>
              )}
              <div>
                <label>
                  <Paperclip /> پیوست فایل
                  <input name="attachments" type="file" multiple />
                </label>
                {role === "admin" && (
                  <label>
                    <input name="internal" type="checkbox" /> یادداشت داخلی
                  </label>
                )}
                <button>
                  ارسال پاسخ <Send />
                </button>
              </div>
              {role !== "admin" && (
                <small className="ticket-rate-note">
                  حداکثر ۵ پیام پشتیبانی در هر ساعت
                </small>
              )}
            </ActionForm>
          )}
        </section>
      ) : (
        <section className="ticket-thread empty-state">
          <Shield />
          <h2>یک گفت‌وگو را انتخاب کنید</h2>
        </section>
      )}
      {newOpen && (
        <div className="ticket-modal-back">
          <ActionForm action={createTicketAction} className="ticket-modal" onSuccess={() => setNewOpen(false)}>
            <button type="button" onClick={() => setNewOpen(false)}>
              <X />
            </button>
            <span>گفت‌وگوی جدید</span>
            <h2>چطور می‌توانیم کمک کنیم؟</h2>
            <input type="hidden" name="role" value={role} />
            {role === "buyer" && <><input type="hidden" name="category" value="ORDER"/><input type="hidden" name="referenceType" value="ORDER"/><label>سفارش مرتبط<select name="orderId" required value={newOrder} onChange={(event)=>{const number=event.target.value;setNewOrder(number);setNewBody(`شماره سفارش: ${number}\n`);}}><option value="" disabled>انتخاب سفارش</option>{orders.map(order=><option value={order.number} key={order.id}>{order.number} · {orderStatusFa(order.status)}</option>)}</select></label></>}
            {role !== "buyer" && <>
            <label>
              دسته‌بندی
              <select name="category">
                <option value="ORDER">سفارش</option>
                <option value="FINANCIAL">مالی و تسویه</option>
                <option value="PRODUCT">محصول</option>
                <option value="ACCOUNT">حساب کاربری</option>
                <option value="BUG">گزارش مشکل</option>
              </select>
            </label>
            </>}
            <label>
              اولویت
              <select name="priority">
                <option value="NORMAL">عادی</option>
                <option value="HIGH">بالا</option>
                <option value="URGENT">فوری</option>
                <option value="LOW">کم</option>
              </select>
            </label>
            <label>
              موضوع
              <input name="subject" required minLength={3} />
            </label>
            {role !== "buyer" && <label>
              مرجع مرتبط
              <input name="referenceId" placeholder="شماره سفارش یا محصول" />
            </label>}
            {role !== "buyer" && <input name="referenceType" type="hidden" value="USER_REFERENCE" />}
            <label>
              شرح کامل
              <textarea name="body" required minLength={3} value={role === "buyer" ? newBody : undefined} onChange={role === "buyer" ? (event)=>setNewBody(event.target.value) : undefined} />
            </label>
            <label className="ticket-attach">
              <Paperclip />
              <div>
                <b>فایل یا تصویر</b>
                <span>حداکثر ۵ فایل، هرکدام ۱۰MB</span>
              </div>
              <input name="attachments" type="file" multiple />
            </label>
            <small className="ticket-rate-note">
              حداکثر ۵ پیام پشتیبانی در هر ساعت
            </small>
            <footer>
              <button type="button" onClick={() => setNewOpen(false)}>
                انصراف
              </button>
              <button>ثبت تیکت</button>
            </footer>
          </ActionForm>
        </div>
      )}
      {(role === "buyer" || role === "seller") && (
        <SupportAiChat
          role={role}
          open={aiOpen}
          onClose={() => setAiOpen(false)}
          onEscalate={() => {
            setAiOpen(false);
            setNewOpen(true);
          }}
        />
      )}
    </div>
  );
}
