do $$ begin
  alter type public.asset_kind add value if not exists 'ARTICLE_IMAGE';
exception when duplicate_object then null;
end $$;

create table if not exists public.articles (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  excerpt text not null,
  seo_title text not null,
  seo_description text not null,
  keywords text[] not null default '{}',
  content jsonb not null default '[]'::jsonb check (jsonb_typeof(content) = 'array'),
  hero_file_id uuid references public.storage_files(id) on delete set null,
  author_id uuid not null references public.profiles(id) on delete restrict,
  status text not null default 'DRAFT' check (status in ('DRAFT','PUBLISHED','ARCHIVED')),
  reading_minutes integer not null default 1 check (reading_minutes > 0),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists articles_public_idx on public.articles(published_at desc)
where status = 'PUBLISHED';
drop trigger if exists articles_touch on public.articles;
create trigger articles_touch before update on public.articles
for each row execute function public.touch_updated_at();

alter table public.articles enable row level security;
drop policy if exists articles_public_read on public.articles;
create policy articles_public_read on public.articles for select to anon,authenticated
using (status = 'PUBLISHED' and published_at is not null and published_at <= now());

notify pgrst, 'reload schema';
