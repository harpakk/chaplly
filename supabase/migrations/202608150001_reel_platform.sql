alter table public.reel_posts drop constraint if exists reel_posts_status_check;
alter table public.reel_posts alter column caption set default '';
alter table public.reel_posts add column if not exists tags text[] not null default '{}';
alter table public.reel_posts add column if not exists social_url text;
alter table public.reel_posts add column if not exists duration_seconds numeric(6,2);
alter table public.reel_posts add column if not exists width integer;
alter table public.reel_posts add column if not exists height integer;
alter table public.reel_posts add column if not exists view_count integer not null default 0;
alter table public.reel_posts add column if not exists reviewed_by uuid references public.profiles(id) on delete set null;
alter table public.reel_posts add column if not exists reviewed_at timestamptz;
alter table public.reel_posts add column if not exists rejection_reason text;
alter table public.reel_posts add constraint reel_posts_status_check check(status in ('DRAFT','PENDING','PUBLISHED','REJECTED','ARCHIVED'));
alter table public.reel_posts add constraint reel_posts_duration_check check(duration_seconds is null or (duration_seconds > 0 and duration_seconds <= 60.5));
alter table public.reel_posts add constraint reel_posts_dimensions_check check(width is null or height is null or (width > 0 and height > width and width <= 720 and height <= 1280));
alter table public.reel_posts add constraint reel_posts_social_url_check check(social_url is null or social_url ~ '^https?://');

create table public.reel_products(
  reel_id uuid not null references public.reel_posts(id) on delete cascade,
  seller_product_id uuid not null references public.seller_products(id) on delete cascade,
  sort_order integer not null default 0,
  primary key(reel_id,seller_product_id)
);
insert into public.reel_products(reel_id,seller_product_id)
select id,seller_product_id from public.reel_posts where seller_product_id is not null on conflict do nothing;

create table public.reel_view_events(
  id uuid primary key default gen_random_uuid(),
  reel_id uuid not null references public.reel_posts(id) on delete cascade,
  viewer_key text not null,
  viewed_on date not null default current_date,
  viewed_at timestamptz not null default now(),
  unique(reel_id,viewer_key,viewed_on)
);
create index reel_view_events_recent_idx on public.reel_view_events(viewed_at desc,reel_id);
create index reel_products_product_idx on public.reel_products(seller_product_id,reel_id);
create index reel_posts_moderation_idx on public.reel_posts(status,created_at desc);

alter table public.reel_products enable row level security;
alter table public.reel_view_events enable row level security;
create policy reel_products_public_read on public.reel_products for select to anon,authenticated
  using(exists(select 1 from public.reel_posts r where r.id=reel_id and r.status='PUBLISHED'));
create policy reel_products_store_manage on public.reel_products for all to authenticated
  using(exists(select 1 from public.reel_posts r where r.id=reel_id and public.can_manage_store(r.store_id)))
  with check(exists(select 1 from public.reel_posts r where r.id=reel_id and public.can_manage_store(r.store_id)));

create or replace function public.service_record_reel_view(p_reel_id uuid,p_viewer_key text)
returns boolean language plpgsql security definer set search_path=public as $$
begin
  if length(p_viewer_key)<3 or length(p_viewer_key)>100 then return false; end if;
  if not exists(select 1 from public.reel_posts where id=p_reel_id and status='PUBLISHED') then return false; end if;
  insert into public.reel_view_events(reel_id,viewer_key) values(p_reel_id,p_viewer_key) on conflict do nothing;
  if not found then return false; end if;
  update public.reel_posts set view_count=view_count+1 where id=p_reel_id;
  return true;
end $$;

create or replace function public.public_top_reels(p_days integer default 10,p_limit integer default 12)
returns jsonb language sql stable security definer set search_path=public as $$
  select coalesce(jsonb_agg(to_jsonb(ranked) order by ranked.recent_views desc,ranked.published_at desc),'[]'::jsonb)
  from (
    select r.id,r.caption,r.tags,r.social_url,r.like_count,r.save_count,r.view_count,r.published_at,
      count(v.id)::integer recent_views,
      jsonb_build_object('name',s.name,'slug',s.slug,'social_url',s.social_url) store,
      jsonb_build_object('bucket',f.bucket,'path',f.path) file,
      coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'title',p.title,'slug',p.slug) order by rp.sort_order,p.title)
        from public.reel_products rp join public.seller_products p on p.id=rp.seller_product_id
        where rp.reel_id=r.id and p.status='PUBLISHED' and p.moderation_status='APPROVED'),'[]'::jsonb) products
    from public.reel_posts r
    join public.stores s on s.id=r.store_id
    join public.storage_files f on f.id=r.video_file_id and f.state='READY'
    left join public.reel_view_events v on v.reel_id=r.id and v.viewed_at>=now()-make_interval(days=>greatest(1,least(p_days,30)))
    where r.status='PUBLISHED'
    group by r.id,s.id,f.id
    order by count(v.id) desc,r.view_count desc,r.published_at desc
    limit greatest(1,least(p_limit,30))
  ) ranked;
$$;

revoke all on function public.service_record_reel_view(uuid,text) from public,anon,authenticated;
grant execute on function public.service_record_reel_view(uuid,text) to service_role;
revoke all on function public.public_top_reels(integer,integer) from public;
grant execute on function public.public_top_reels(integer,integer) to anon,authenticated,service_role;
