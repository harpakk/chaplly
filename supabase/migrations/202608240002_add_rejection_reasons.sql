insert into public.rejection_reasons (code, title, status, sort_order)
values
  ('DUPLICATE_PRODUCT', 'محصول تکراری', 'ACTIVE', 30),
  ('OTHER', 'سایر', 'ACTIVE', 100)
on conflict (code) do update
set title = excluded.title,
    status = excluded.status,
    sort_order = excluded.sort_order,
    updated_at = now();
