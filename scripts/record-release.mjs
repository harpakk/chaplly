import { connectPostgres } from "./postgres-client.mjs";

for(const key of ["RELEASE_VERSION","COMMIT_SHA","DEPLOYMENT_ENV"])
  if(!process.env[key])throw new Error(`${key} is required`);
const environment=process.env.DEPLOYMENT_ENV.toUpperCase();
if(!["TEST","STAGING","PRODUCTION"].includes(environment))
  throw new Error("DEPLOYMENT_ENV must be test, staging, or production");
const db=await connectPostgres();
try{
  const migration=await db.query(
    "select version from public.chapli_schema_migrations order by applied_at desc limit 1",
  );
  await db.query(
    `insert into public.app_releases(
      version,commit_sha,migration_version,environment,status,metadata,completed_at
    ) values($1,$2,$3,$4,'ACTIVE',$5::jsonb,now())
    on conflict(environment,version) do update set
      commit_sha=excluded.commit_sha,migration_version=excluded.migration_version,
      status='ACTIVE',metadata=excluded.metadata,completed_at=now()`,
    [
      process.env.RELEASE_VERSION,process.env.COMMIT_SHA,
      migration.rows[0]?.version||null,environment,
      JSON.stringify({source:"deployment",recordedAt:new Date().toISOString()}),
    ],
  );
  console.log(JSON.stringify({recorded:true,version:process.env.RELEASE_VERSION,environment}));
}finally{
  await db.end();
}
