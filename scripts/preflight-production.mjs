import fs from "node:fs/promises";
import path from "node:path";
import { connectPostgres } from "./postgres-client.mjs";

const failures=[];
const checks=[];
const check=(name,ok,detail="")=>{
  checks.push({name,ok,detail});
  if(!ok)failures.push(name);
};
const present=(key)=>Boolean(process.env[key]?.trim());

for(const key of [
  "NEXT_PUBLIC_SUPABASE_URL","NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_SECRET_KEY","DATABASE_URL","NEXT_PUBLIC_APP_URL",
  "ADMIN_COOKIE_SECRET","RELEASE_VERSION","COMMIT_SHA",
]) check(`Environment: ${key}`,present(key));
check("Production deployment mode",process.env.DEPLOYMENT_ENV==="production");
check("HTTPS application URL",process.env.NEXT_PUBLIC_APP_URL?.startsWith("https://"));
check("Profile-only Admin access",process.env.ADMIN_ACCESS_MODE==="profile");
check("Admin MFA required",process.env.ADMIN_REQUIRE_MFA==="true");
check("No static Admin password",!present("ADMIN_STATIC_PASSWORD"));
check("Production seeding disabled",process.env.ALLOW_PRODUCTION_SEED!=="true");
check("Automatic repair disabled",process.env.ALLOW_DATA_REPAIR!=="true");
check("Payment is not in development mode",process.env.PAYMENT_MODE!=="development");
check("Payment provider configured",present("PAYMENT_PROVIDER"));
check("WooCommerce credential encryption configured",present("WOOCOMMERCE_ENCRYPTION_KEY")||present("ADMIN_COOKIE_SECRET"));
if(process.env.PAYMENT_PROVIDER==="ZARINPAL") {
  check("ZarinPal merchant ID configured",/^[0-9a-f-]{36}$/i.test(process.env.ZARINPAL_MERCHANT_ID||""));
  check("ZarinPal production callback configured",process.env.ZARINPAL_CALLBACK_URL==="https://chaplly.ir/api/payments/zarinpal/callback");
} else {
  check("Payment webhook secret configured",present("PAYMENT_WEBHOOK_SECRET"));
}
for(const [key,value] of Object.entries(process.env))
  if(key.startsWith("NEXT_PUBLIC_"))
    check(`Public variable ${key} contains no privileged marker`,
      !/service_role|sb_secret_|private[_-]?key|database_url/i.test(value||""));

const migrationFiles=(await fs.readdir(path.resolve("supabase/migrations")))
  .filter(name=>name.endsWith(".sql")).map(name=>name.replace(/\.sql$/,"")).sort();
const db=await connectPostgres();
try{
  const [
    migrations,rls,policies,buckets,cron,admins,demoUsers,failedWebhooks,
    failedNotifications,unassigned,
  ]=await Promise.all([
    db.query("select version from public.chapli_schema_migrations order by version"),
    db.query("select count(*)::int total,count(*) filter(where relrowsecurity)::int protected from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and c.relname<>'chapli_schema_migrations'"),
    db.query("select count(*)::int count from pg_policies where schemaname='public'"),
    db.query("select count(*)::int count from storage.buckets"),
    db.query("select count(*)::int count from cron.job where jobname='chapli-complete-sent-fulfilments' and active"),
    db.query("select count(*)::int count from public.admin_profiles where is_active"),
    db.query("select count(*)::int count from auth.users where email like '%@chapli.dev'"),
    db.query("select count(*)::int count from public.webhook_events where status in ('FAILED','DEAD_LETTER')"),
    db.query("select count(*)::int count from public.notification_outbox where status='FAILED'"),
    db.query("select count(*)::int count from public.fulfilments where status not in ('DONE','CANCELLED') and supplier_organization_id is null"),
  ]);
  const applied=new Set(migrations.rows.map(row=>row.version));
  const missing=migrationFiles.filter(version=>!applied.has(version));
  check("All repository migrations applied",missing.length===0,`missing=${missing.length}`);
  check("RLS enabled on all public tables",rls.rows[0].total===rls.rows[0].protected,`${rls.rows[0].protected}/${rls.rows[0].total}`);
  check("RLS policies installed",policies.rows[0].count>0,`policies=${policies.rows[0].count}`);
  check("Storage buckets installed",buckets.rows[0].count===8,`buckets=${buckets.rows[0].count}`);
  check("Fulfilment cron installed exactly once",cron.rows[0].count===1,`jobs=${cron.rows[0].count}`);
  check("At least one active Admin exists",admins.rows[0].count>0,`admins=${admins.rows[0].count}`);
  check("Demo Auth users removed",demoUsers.rows[0].count===0,`demoUsers=${demoUsers.rows[0].count}`);
  check("No failed/dead-letter webhooks",failedWebhooks.rows[0].count===0,`failed=${failedWebhooks.rows[0].count}`);
  check("No failed notification outbox rows",failedNotifications.rows[0].count===0,`failed=${failedNotifications.rows[0].count}`);
  check("No unassigned active fulfilments",unassigned.rows[0].count===0,`unassigned=${unassigned.rows[0].count}`);
}finally{
  await db.end();
}
console.log(JSON.stringify({ok:failures.length===0,checks,failed:failures},null,2));
if(failures.length)process.exitCode=1;
