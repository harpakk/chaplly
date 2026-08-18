-- A seller may design and price every variant supported by an approved offer,
-- even when that variant is temporarily out of stock. Public availability is
-- still governed by live supplier inventory and seller variant status.
do $migration$
declare
  current_definition text;
  updated_definition text;
  availability_definition text;
begin
  current_definition := pg_get_functiondef(
    'public.save_seller_product(jsonb)'::regprocedure
  );
  updated_definition := replace(
    current_definition,
    '        and stock_status in (''AVAILABLE'',''LOW_STOCK'');',
    ';'
  );
  if updated_definition = current_definition then
    raise exception 'save_seller_product stock filter signature was not found';
  end if;
  availability_definition := replace(
    updated_definition,
    'case when v_primary_variant is null then ''OUT_OF_STOCK'' else ''ACTIVE'' end',
    'case when exists(select 1 from public.supplier_offer_variants where id=v_primary_variant and stock_quantity>0 and stock_status in (''AVAILABLE'',''LOW_STOCK'')) then ''ACTIVE'' else ''OUT_OF_STOCK'' end'
  );
  if availability_definition = updated_definition then
    raise exception 'save_seller_product availability signature was not found';
  end if;
  execute availability_definition;
end
$migration$;

revoke all on function public.save_seller_product(jsonb) from public,anon;
grant execute on function public.save_seller_product(jsonb)
  to authenticated,service_role;

notify pgrst, 'reload schema';
