import { connectPostgres } from "./postgres-client.mjs";

const apply = process.argv.includes("--apply");
if (apply && process.env.NODE_ENV === "production" && process.env.ALLOW_DATA_REPAIR !== "true") {
  throw new Error("Set ALLOW_DATA_REPAIR=true explicitly for a production repair.");
}

const db = await connectPostgres();
try {
  await db.query("begin");
  const results = {};

  results.designVariants = (await db.query(`
    insert into public.design_variants(design_id,raw_product_variant_id)
    select distinct sp.design_id,spv.raw_product_variant_id
    from public.seller_product_variants spv
    join public.seller_products sp on sp.id=spv.seller_product_id
    where sp.design_id is not null and not exists(
      select 1 from public.design_variants dv
      where dv.design_id=sp.design_id
        and dv.raw_product_variant_id=spv.raw_product_variant_id
    )
    on conflict do nothing
    returning design_id
  `)).rowCount;

  results.unavailableVariants = (await db.query(`
    update public.seller_product_variants spv set
      status='OUT_OF_STOCK',updated_at=now()
    where spv.status='ACTIVE' and (
      spv.supplier_offer_variant_id is null or not exists(
        select 1
        from public.supplier_offer_variants sov
        join public.supplier_offers so on so.id=sov.supplier_offer_id
        where sov.id=spv.supplier_offer_variant_id
          and sov.raw_product_variant_id=spv.raw_product_variant_id
          and sov.stock_status in ('AVAILABLE','LOW_STOCK')
          and so.status='ACTIVE' and so.approval_status='APPROVED'
      )
    )
    returning id
  `)).rowCount;

  results.assignmentHistory = (await db.query(`
    insert into public.supplier_assignment_events(
      fulfilment_id,to_supplier_organization_id,to_supplier_offer_id,
      reason,idempotency_key,snapshot,created_at
    )
    select
      f.id,f.supplier_organization_id,f.supplier_offer_id,
      'HISTORY_REPAIR','assignment-backfill:'||f.id::text,
      f.assignment_snapshot,f.created_at
    from public.fulfilments f
    where not exists(
      select 1 from public.supplier_assignment_events e
      where e.fulfilment_id=f.id
    )
    on conflict(idempotency_key) do nothing
    returning id
  `)).rowCount;

  results.missingStorageObjects = (await db.query(`
    update public.storage_files f set
      state='REJECTED',
      metadata=f.metadata||jsonb_build_object(
        'integrityError','STORAGE_OBJECT_MISSING',
        'checkedAt',now()
      ),
      updated_at=now()
    where f.state='READY' and not exists(
      select 1 from storage.objects o
      where o.bucket_id=f.bucket and o.name=f.path
    )
    returning id
  `)).rowCount;

  if (apply) await db.query("commit");
  else await db.query("rollback");

  console.log(JSON.stringify({
    mode: apply ? "applied" : "dry-run",
    changes: results,
  }, null, 2));
} catch (error) {
  await db.query("rollback");
  throw error;
} finally {
  await db.end();
}
