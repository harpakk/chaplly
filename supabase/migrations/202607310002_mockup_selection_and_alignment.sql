alter table public.raw_product_mockups
  add column if not exists needs_alignment boolean not null default false;

create table if not exists public.design_mockup_selections (
  design_id uuid not null references public.designs(id) on delete cascade,
  mockup_id uuid not null references public.raw_product_mockups(id) on delete cascade,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  primary key(design_id,mockup_id)
);

alter table public.design_mockup_selections enable row level security;
create policy design_mockup_selections_own on public.design_mockup_selections
for all to authenticated
using(exists(select 1 from public.designs d where d.id=design_id and d.owner_user_id=auth.uid()))
with check(exists(select 1 from public.designs d where d.id=design_id and d.owner_user_id=auth.uid()));
grant select,insert,update,delete on public.design_mockup_selections to authenticated;

create or replace function public.mark_mockups_for_realignment()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if (old.print_area_width,old.print_area_height) is distinct from (new.print_area_width,new.print_area_height) then
    update public.raw_product_mockups set needs_alignment=true where raw_product_id=new.raw_product_id;
  end if;
  return new;
end $$;
drop trigger if exists raw_product_views_mark_mockups on public.raw_product_views;
create trigger raw_product_views_mark_mockups after update of print_area_width,print_area_height
on public.raw_product_views for each row execute function public.mark_mockups_for_realignment();
