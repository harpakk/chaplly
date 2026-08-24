-- Approval means the product is ready for every public storefront.
update public.seller_products
set visibility = 'VISIBLE'
where moderation_status = 'APPROVED'
  and status = 'PUBLISHED'
  and visibility <> 'VISIBLE';

create or replace function public.ensure_approved_product_visible()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.moderation_status = 'APPROVED' and new.status = 'PUBLISHED' then
    new.visibility := 'VISIBLE';
  end if;
  return new;
end
$$;

drop trigger if exists approved_product_visible on public.seller_products;
create trigger approved_product_visible
before insert or update of moderation_status,status,visibility on public.seller_products
for each row execute function public.ensure_approved_product_visible();
