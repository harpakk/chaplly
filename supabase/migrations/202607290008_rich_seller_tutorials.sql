alter table public.tutorials
  add column if not exists summary text,
  add column if not exists learning_outcomes text[] not null default '{}',
  add column if not exists content jsonb not null default '[]'::jsonb,
  add column if not exists difficulty text not null default 'BEGINNER';

update public.tutorials
set summary = coalesce(nullif(summary,''),left(description,220))
where summary is null or summary='';

alter table public.tutorials
  alter column thumbnail_file_id set not null;

alter table public.tutorials
  drop constraint if exists tutorials_content_array_check,
  add constraint tutorials_content_array_check
    check(jsonb_typeof(content)='array'),
  drop constraint if exists tutorials_difficulty_check,
  add constraint tutorials_difficulty_check
    check(difficulty in ('BEGINNER','INTERMEDIATE','ADVANCED'));

create index if not exists tutorials_published_sort_idx
  on public.tutorials(status,sort_order,created_at)
  where status='PUBLISHED';
