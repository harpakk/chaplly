import pg from "pg";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required.");
}

const db = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 8,
  connectionTimeoutMillis: 45_000,
});
const checks = [];
const check = (name, condition, detail) => {
  checks.push({ name, ok: Boolean(condition), detail });
};

try {
  const [
    schema,
    functions,
    fkIndexes,
    authDrift,
    relations,
    finance,
    storage,
    operations,
  ] = await Promise.all([
    db.query(`
      select
        (select count(*)::int from pg_tables
          where schemaname='public' and tablename<>'_chapli_migrations') user_tables,
        (select count(*)::int from pg_class c
          join pg_namespace n on n.oid=c.relnamespace
          where n.nspname='public' and c.relkind='r'
            and c.relname<>'_chapli_migrations' and c.relrowsecurity) rls_tables,
        (select count(*)::int from pg_policies where schemaname='public') policies,
        (select count(*)::int from public._chapli_migrations) migrations
    `),
    db.query(`
      select count(*)::int missing_search_path
      from pg_proc p
      join pg_namespace n on n.oid=p.pronamespace
      where n.nspname='public' and p.prosecdef
        and not(coalesce(p.proconfig,'{}') @> array['search_path=public'])
    `),
    db.query(`
      select count(*)::int count
      from pg_constraint c
      join pg_class t on t.oid=c.conrelid
      join pg_namespace n on n.oid=t.relnamespace
      where c.contype='f' and n.nspname='public'
        and not exists(
          select 1 from pg_index i
          where i.indrelid=c.conrelid and i.indisvalid
            and array_to_string(
              (i.indkey::smallint[])[0:cardinality(c.conkey)-1],','
            )=array_to_string(c.conkey,',')
        )
    `),
    db.query(`
      select
        (select count(*)::int from public.profiles p
          left join auth.users u on u.id=p.id where u.id is null) profiles_without_auth,
        (select count(*)::int from auth.users u
          left join public.profiles p on p.id=u.id where p.id is null) auth_without_profiles,
        (select count(*)::int from public.memberships m
          left join public.profiles p on p.id=m.user_id
          left join public.organizations o on o.id=m.organization_id
          where p.id is null or o.id is null) broken_memberships
    `),
    db.query(`
      select
        (select count(*)::int
          from public.raw_products rp
          where rp.status='ACTIVE' and not exists(
            select 1 from public.raw_product_views v
            where v.raw_product_id=rp.id
          )) active_raw_without_views,
        (select count(*)::int
          from public.raw_products rp
          join public.raw_product_views v on v.raw_product_id=rp.id
          join public.raw_product_variants rv
            on rv.raw_product_id=rp.id and rv.status='ACTIVE'
          left join public.raw_product_variant_assets a
            on a.raw_product_variant_id=rv.id
            and a.raw_product_view_id=v.id
            and a.background_file_id is not null
          where rp.status='ACTIVE' and a.raw_product_variant_id is null
        ) active_variants_missing_background,
        (select count(*)::int
          from public.design_views dv
          join public.designs d on d.id=dv.design_id
          join public.raw_product_views rv on rv.id=dv.raw_product_view_id
          where rv.raw_product_id<>d.raw_product_id) design_view_mismatch,
        (select count(*)::int
          from public.seller_product_variants spv
          join public.seller_products sp on sp.id=spv.seller_product_id
          where not exists(
            select 1 from public.design_variants dv
            where dv.design_id=sp.design_id
              and dv.raw_product_variant_id=spv.raw_product_variant_id
          )) product_variant_not_in_design,
        (select count(*)::int
          from public.supplier_offer_variants sov
          join public.supplier_offers so on so.id=sov.supplier_offer_id
          join public.raw_product_variants rv
            on rv.id=sov.raw_product_variant_id
          where so.raw_product_id<>rv.raw_product_id) supplier_variant_mismatch,
        (select count(*)::int
          from public.seller_product_variants
          where status='ACTIVE' and supplier_offer_variant_id is null
        ) active_variant_without_supplier
    `),
    db.query(`
      select
        (select count(*)::int from (
          select beneficiary_organization_id,earning_type,source_type,source_id
          from public.earnings group by 1,2,3,4 having count(*)>1
        ) d) duplicate_earnings,
        (select count(*)::int from (
          select earning_id from public.payout_request_items
          group by earning_id having count(*)>1
        ) d) earning_in_multiple_payouts,
        (select count(*)::int
          from public.payout_payment_history h
          left join public.payout_requests p on p.id=h.payout_request_id
          where p.id is null or p.status<>'PAID') invalid_payout_history
    `),
    db.query(`
      select
        (select count(*)::int from storage.buckets) buckets,
        (select count(*)::int
          from public.storage_files f
          left join storage.objects o
            on o.bucket_id=f.bucket and o.name=f.path
          where f.state='READY' and o.id is null) ready_metadata_without_object,
        (select count(*)::int
          from storage.objects o
          left join public.storage_files f
            on f.bucket=o.bucket_id and f.path=o.name
          where f.id is null) objects_without_metadata
    `),
    db.query(`
      select
        (select count(*)::int from cron.job
          where jobname='chapli-complete-sent-fulfilments' and active) completion_jobs,
        (select count(*)::int from public.webhook_events
          where status in ('FAILED','DEAD_LETTER')) failed_webhooks,
        (select count(*)::int from public.notification_outbox
          where status='FAILED') failed_notifications,
        (select count(*)::int from public.fulfilments
          where status not in ('DONE','CANCELLED','RETURNED')
            and due_at is not null and due_at<now()) overdue_fulfilments
    `),
  ]);

  const s = schema.rows[0];
  const a = authDrift.rows[0];
  const r = relations.rows[0];
  const f = finance.rows[0];
  const files = storage.rows[0];
  const ops = operations.rows[0];

  check("RLS enabled on every public user table", s.user_tables === s.rls_tables, `${s.rls_tables}/${s.user_tables}`);
  check("Every user table has at least one policy", s.policies >= s.user_tables, `policies=${s.policies}`);
  check("Migrations are tracked", s.migrations >= 10, `migrations=${s.migrations}`);
  check("Security-definer search paths are fixed", functions.rows[0].missing_search_path === 0, `missing=${functions.rows[0].missing_search_path}`);
  check("Every foreign key has a leading index", fkIndexes.rows[0].count === 0, `missing=${fkIndexes.rows[0].count}`);
  check("Auth and profile identities match", a.profiles_without_auth === 0 && a.auth_without_profiles === 0, JSON.stringify(a));
  check("Membership relations are valid", a.broken_memberships === 0, `broken=${a.broken_memberships}`);
  for (const [name, value] of Object.entries(r)) {
    check(`Relation invariant: ${name}`, value === 0, `violations=${value}`);
  }
  for (const [name, value] of Object.entries(f)) {
    check(`Finance invariant: ${name}`, value === 0, `violations=${value}`);
  }
  check("All Storage buckets are installed", files.buckets === 8, `buckets=${files.buckets}`);
  check("READY file metadata points to an object", files.ready_metadata_without_object === 0, `missing=${files.ready_metadata_without_object}`);
  check("Storage objects have metadata", files.objects_without_metadata === 0, `orphans=${files.objects_without_metadata}`);
  check("Sent-to-Done scheduled job is active once", ops.completion_jobs === 1, `jobs=${ops.completion_jobs}`);

  const failed = checks.filter((item) => !item.ok);
  console.log(JSON.stringify({
    ok: failed.length === 0,
    checks: checks.length,
    failed,
    operationalSignals: {
      failedWebhooks: ops.failed_webhooks,
      failedNotifications: ops.failed_notifications,
      overdueFulfilments: ops.overdue_fulfilments,
    },
    results: checks,
  }, null, 2));
  if (failed.length) process.exitCode = 1;
} finally {
  await db.end();
}
