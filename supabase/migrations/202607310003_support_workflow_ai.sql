create table if not exists public.support_knowledge_base (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  category text not null default 'GENERAL',
  content text not null,
  status text not null default 'ACTIVE' check (status in ('ACTIVE','INACTIVE')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists support_knowledge_base_touch on public.support_knowledge_base;
create trigger support_knowledge_base_touch before update on public.support_knowledge_base
for each row execute function public.touch_updated_at();

alter table public.support_knowledge_base enable row level security;

create or replace function public.enforce_ticket_message_hourly_limit()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if new.sender_id is not null and new.sender_role in ('BUYER','SELLER','SUPPLIER') and (
    select count(*) from public.ticket_messages
    where sender_id=new.sender_id and created_at >= now() - interval '1 hour'
  ) >= 5 then
    raise exception 'TICKET_MESSAGE_RATE_LIMIT';
  end if;
  return new;
end $$;

drop trigger if exists ticket_messages_hourly_limit on public.ticket_messages;
create trigger ticket_messages_hourly_limit before insert on public.ticket_messages
for each row execute function public.enforce_ticket_message_hourly_limit();

create index if not exists ticket_messages_sender_rate_idx
on public.ticket_messages(sender_id,created_at desc) where sender_id is not null;

