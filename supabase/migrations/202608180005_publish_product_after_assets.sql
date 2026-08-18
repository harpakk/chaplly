-- Keep a product unavailable while its metadata/images are still being saved.
-- The server action switches it to PUBLISHED only after those steps succeed.
do $$
declare
  v_definition text:=pg_get_functiondef('public.save_seller_product(jsonb)'::regprocedure);
  v_before text:=v_definition;
begin
  v_definition:=replace(v_definition,
    'case when v_publish then ''PUBLISHED'' else ''DRAFT'' end',
    'case when v_publish then ''PENDING'' else ''DRAFT'' end');
  if v_definition=v_before then
    raise exception 'save_seller_product deferred publish signature was not found';
  end if;
  execute v_definition;
end $$;
