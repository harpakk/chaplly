import fs from "node:fs/promises";
import {connectPostgres} from "./postgres-client.mjs";

if(!process.env.DATABASE_URL)throw new Error("DATABASE_URL is required.");
const client=await connectPostgres();
const columns=await client.query(`select table_name,column_name,data_type,udt_name,is_nullable,column_default,ordinal_position
    from information_schema.columns where table_schema='public'
    order by table_name,ordinal_position`);
const constraints=await client.query(`select c.relname table_name,con.conname name,con.contype,
    pg_get_constraintdef(con.oid,true) definition
    from pg_constraint con join pg_class c on c.oid=con.conrelid
    join pg_namespace n on n.oid=c.relnamespace where n.nspname='public'
    order by c.relname,con.contype,con.conname`);
const indexes=await client.query(`select tablename,indexname,indexdef from pg_indexes where schemaname='public' order by tablename,indexname`);
const policies=await client.query(`select tablename,policyname,cmd,roles,qual,with_check from pg_policies
    where schemaname='public' order by tablename,policyname`);
const functions=await client.query(`select p.proname,pg_get_function_identity_arguments(p.oid) arguments,
    pg_get_function_result(p.oid) result,l.lanname language,p.prosecdef security_definer
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace join pg_language l on l.oid=p.prolang
    where n.nspname='public' order by p.proname,arguments`);
const triggers=await client.query(`select event_object_table table_name,trigger_name,event_manipulation,action_timing,action_statement
    from information_schema.triggers where trigger_schema='public' order by event_object_table,trigger_name`);
const buckets=await client.query(`select id,name,public,file_size_limit,allowed_mime_types from storage.buckets order by id`);
const cron=await client.query(`select jobid,schedule,command,active,jobname from cron.job order by jobid`).catch(()=>({rows:[]}));
await client.end();

const esc=value=>String(value??"—").replaceAll("|","\\|").replaceAll("\n"," ");
const grouped=(rows,key)=>Map.groupBy(rows,row=>row[key]);
const constraintMap=grouped(constraints.rows,"table_name"),indexMap=grouped(indexes.rows,"tablename"),policyMap=grouped(policies.rows,"tablename");
const tableNames=[...new Set(columns.rows.map(row=>row.table_name))];
const lines=[
  "# Supabase backend inventory",
  "",
  `Generated from the live database on ${new Date().toISOString()}. Re-run with \`npm run db:docs\`.`,
  "",
  "Identity is sourced from `auth.users`. Application identities live in `public.profiles`, and role-specific profiles/memberships connect Buyers, Sellers, Suppliers and Admins.",
  "",
  `## Public schema (${tableNames.length} tables)`,
  "",
];
for(const table of tableNames){
  lines.push(`### \`${table}\``,"","| Column | PostgreSQL type | Required | Default |","|---|---|---:|---|");
  for(const column of columns.rows.filter(row=>row.table_name===table)){
    const type=column.data_type==="USER-DEFINED"?column.udt_name:column.data_type;
    lines.push(`| \`${esc(column.column_name)}\` | \`${esc(type)}\` | ${column.is_nullable==="NO"?"yes":"no"} | ${esc(column.column_default)} |`);
  }
  lines.push("","Constraints:");
  for(const item of constraintMap.get(table)||[])lines.push(`- \`${item.name}\`: \`${esc(item.definition)}\``);
  lines.push("","Indexes:");
  for(const item of indexMap.get(table)||[])lines.push(`- \`${item.indexname}\`: \`${esc(item.indexdef)}\``);
  lines.push("","RLS policies:");
  const tablePolicies=policyMap.get(table)||[];
  if(!tablePolicies.length)lines.push("- No client policy; table is server/service-only.");
  for(const item of tablePolicies)lines.push(`- \`${item.policyname}\` (${item.cmd}, roles: ${esc(item.roles)}): using \`${esc(item.qual)}\`; check \`${esc(item.with_check)}\``);
  lines.push("");
}
lines.push("## Database functions","",'| Function | Arguments | Result | Language | Security definer |',"|---|---|---|---|---:|");
for(const item of functions.rows)lines.push(`| \`${esc(item.proname)}\` | \`${esc(item.arguments)}\` | \`${esc(item.result)}\` | ${esc(item.language)} | ${item.security_definer?"yes":"no"} |`);
lines.push("","## Triggers","",'| Table | Trigger | Timing / event | Action |',"|---|---|---|---|");
for(const item of triggers.rows)lines.push(`| \`${item.table_name}\` | \`${item.trigger_name}\` | ${item.action_timing} ${item.event_manipulation} | \`${esc(item.action_statement)}\` |`);
lines.push("","## Storage buckets","",'| Bucket | Public | File limit | Allowed MIME types |',"|---|---:|---:|---|");
for(const item of buckets.rows)lines.push(`| \`${item.id}\` | ${item.public?"yes":"no"} | ${esc(item.file_size_limit)} | ${esc(item.allowed_mime_types)} |`);
lines.push("","Storage object access is enforced by policies on `storage.objects`; file ownership and metadata are recorded in `public.storage_files`.");
lines.push("","## Scheduled jobs","",'| ID | Name | Schedule | Active | Command |',"|---:|---|---|---:|---|");
for(const item of cron.rows)lines.push(`| ${item.jobid} | ${esc(item.jobname)} | \`${item.schedule}\` | ${item.active?"yes":"no"} | \`${esc(item.command)}\` |`);
lines.push("");
await fs.writeFile(new URL("../docs/11-supabase-schema.md",import.meta.url),lines.join("\n"),"utf8");
console.log(JSON.stringify({tables:tableNames.length,columns:columns.rows.length,policies:policies.rows.length,functions:functions.rows.length,triggers:triggers.rows.length,buckets:buckets.rows.length}));
