"use client";

import { FormEvent, useEffect, useRef, useState, useTransition } from "react";
import { Bot, Headphones, Send, Sparkles, UserRound, X } from "lucide-react";
import { sendSupportAiMessageAction } from "@/app/actions/dashboard";

type ChatMessage = { role: "user" | "assistant"; body: string };

export function SupportAiChat({
  role,
  open,
  onClose,
  onEscalate,
}: {
  role: "buyer" | "seller";
  open: boolean;
  onClose: () => void;
  onEscalate: () => void;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [conversationId, setConversationId] = useState("");
  const [remaining, setRemaining] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const input = useRef<HTMLTextAreaElement>(null);
  const messagesEnd = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEnd.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, pending]);

  if (!open) return null;

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const body = input.current?.value.trim() || "";
    if (!body || pending) return;
    if (input.current) input.current.value = "";
    setError("");
    setMessages((current) => [...current, { role: "user", body }]);
    startTransition(async () => {
      const formData = new FormData();
      formData.set("role", role);
      formData.set("body", body);
      if (conversationId) formData.set("conversationId", conversationId);
      const result = await sendSupportAiMessageAction(formData);
      if ("conversationId" in result && result.conversationId)
        setConversationId(result.conversationId);
      if ("remaining" in result && typeof result.remaining === "number")
        setRemaining(result.remaining);
      if (result.ok) {
        setMessages((current) => [
          ...current,
          { role: "assistant", body: result.answer },
        ]);
      } else {
        setError(result.message);
      }
    });
  };

  return (
    <div className="support-ai-backdrop" role="dialog" aria-modal="true">
      <section className="support-ai-popup">
        <header>
          <span className="support-ai-avatar"><Bot /></span>
          <div>
            <b>دستیار هوشمند چاپلی</b>
            <small><Sparkles /> پاسخ‌گویی فوری بر اساس راهنمای چاپلی</small>
          </div>
          <button type="button" onClick={onClose} aria-label="بستن"><X /></button>
        </header>

        <div className="support-ai-messages">
          {!messages.length && (
            <div className="support-ai-welcome">
              <Bot />
              <h3>سلام! چطور می‌توانم کمکتان کنم؟</h3>
              <p>سؤال خود را درباره سفارش، محصول، حساب یا کار با چاپلی بنویسید.</p>
            </div>
          )}
          {messages.map((message, index) => (
            <article className={message.role} key={`${message.role}-${index}`}>
              <span>{message.role === "assistant" ? <Bot /> : <UserRound />}</span>
              <p>{message.body}</p>
            </article>
          ))}
          {pending && (
            <article className="assistant pending">
              <span><Bot /></span><p>در حال بررسی و نوشتن پاسخ…</p>
            </article>
          )}
          <div ref={messagesEnd} />
        </div>

        {error && <p className="support-ai-error">{error}</p>}
        <form onSubmit={submit}>
          <textarea ref={input} maxLength={3000} placeholder="پیام خود را بنویسید…" disabled={pending || remaining === 0} />
          <button disabled={pending || remaining === 0} aria-label="ارسال"><Send /></button>
        </form>
        <footer>
          <small>{remaining === null ? "روزانه ۱۰ پیام برای هر کاربر" : `${remaining.toLocaleString("fa-IR")} پیام امروز باقی مانده`}</small>
          <button type="button" onClick={onEscalate}><Headphones /> ارتباط با پشتیبان انسانی</button>
        </footer>
      </section>
    </div>
  );
}
