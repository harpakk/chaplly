import {createClient} from "@supabase/supabase-js";
import {connectPostgres} from "./postgres-client.mjs";

const required=["NEXT_PUBLIC_SUPABASE_URL","NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY","SUPABASE_SECRET_KEY","DATABASE_URL"];
for(const key of required)if(!process.env[key])throw new Error(`${key} is required.`);
const url=process.env.NEXT_PUBLIC_SUPABASE_URL,publishable=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const password=process.env.SEED_DEFAULT_PASSWORD||"ChapliDemo!1405";
const results=[];
const check=(name,condition,detail)=>{if(!condition)throw new Error(`${name} failed: ${detail||""}`);results.push({name,detail});};
const clientFor=()=>createClient(url,publishable,{auth:{persistSession:false,autoRefreshToken:false}});
const login=async email=>{const client=clientFor();const {data,error}=await client.auth.signInWithPassword({email,password});if(error)throw error;return{client,user:data.user};};

const anon=clientFor();
const [anonProducts,anonOrders,anonProfiles]=await Promise.all([
  anon.from("seller_products").select("id",{count:"exact",head:true}),
  anon.from("orders").select("id"),
  anon.from("profiles").select("id"),
]);
check("anon can read published marketplace products",(anonProducts.count||0)>0,`count=${anonProducts.count}`);
check("anon cannot read orders",!anonOrders.error&&anonOrders.data?.length===0,anonOrders.error?.message);
check("anon cannot read profiles",!anonProfiles.error&&anonProfiles.data?.length===0,anonProfiles.error?.message);

const buyer=await login("buyer@chapli.dev");
const buyerOrders=await buyer.client.from("orders").select("id,buyer_user_id");
const buyerEarnings=await buyer.client.from("earnings").select("id");
check("buyer reads own orders only",!buyerOrders.error&&(buyerOrders.data?.length||0)>0&&buyerOrders.data.every(row=>row.buyer_user_id===buyer.user.id),buyerOrders.error?.message);
check("buyer cannot read earnings",!buyerEarnings.error&&buyerEarnings.data?.length===0,buyerEarnings.error?.message);
const tempAddress=await buyer.client.from("buyer_addresses").insert({
  user_id:buyer.user.id,label:"RLS verification",recipient_name:"Verification User",phone:"09120000000",
  province:"تهران",city:"تهران",address_line:"نشانی موقت آزمون",postal_code:"0000000000",is_default:false,
}).select("id,label").single();
check("buyer can write and read own address",!tempAddress.error&&tempAddress.data?.label==="RLS verification",tempAddress.error?.message);
if(tempAddress.data){
  const removed=await buyer.client.from("buyer_addresses").delete().eq("id",tempAddress.data.id).select("id");
  check("buyer can clean up own address",!removed.error&&removed.data?.length===1,removed.error?.message);
}

const seller=await login("seller@chapli.dev");
const sellerMemberships=await seller.client.from("memberships").select("organization_id,user_id");
const sellerBalances=await seller.client.from("balance_projections").select("organization_id");
check("seller sees only own membership",!sellerMemberships.error&&sellerMemberships.data?.length===1&&sellerMemberships.data[0].user_id===seller.user.id,sellerMemberships.error?.message);
check("seller balance is tenant-scoped",!sellerBalances.error&&sellerBalances.data?.length===1,sellerBalances.error?.message);
const storagePath=`${seller.user.id}/verification/rls-test-${Date.now()}.png`;
const testPng=Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=","base64");
const uploaded=await seller.client.storage.from("design-files").upload(storagePath,new Blob([testPng],{type:"image/png"}),{upsert:false});
check("seller can upload to own private design folder",!uploaded.error,uploaded.error?.message);
const fileRecord=await seller.client.from("storage_files").insert({
  owner_user_id:seller.user.id,owner_organization_id:sellerMemberships.data[0].organization_id,
  bucket:"design-files",path:storagePath,kind:"DESIGN_SOURCE",original_name:"rls-test.png",
  mime_type:"image/png",size_bytes:testPng.length,state:"READY",
}).select("id").single();
check("seller can register owned file metadata",!fileRecord.error, fileRecord.error?.message);
const downloaded=await seller.client.storage.from("design-files").download(storagePath);
check("seller can read own private design file",!downloaded.error&&Number(downloaded.data?.size)>0,downloaded.error?.message);
const buyerPrivateRead=await buyer.client.storage.from("design-files").download(storagePath);
check("buyer cannot read seller private design file",Boolean(buyerPrivateRead.error),buyerPrivateRead.error?.message);
const storageRemoved=await seller.client.storage.from("design-files").remove([storagePath]);
check("seller can remove own private design file",!storageRemoved.error,storageRemoved.error?.message);
if(fileRecord.data){
  const service=createClient(url,process.env.SUPABASE_SECRET_KEY,{auth:{persistSession:false}});
  await service.from("storage_files").delete().eq("id",fileRecord.data.id);
}

const supplier=await login("supplier@chapli.dev");
const supplierMemberships=await supplier.client.from("memberships").select("organization_id,user_id");
const supplierFulfilments=await supplier.client.from("fulfilments").select("id,supplier_organization_id");
check("supplier sees only own membership",!supplierMemberships.error&&supplierMemberships.data?.length===1&&supplierMemberships.data[0].user_id===supplier.user.id,supplierMemberships.error?.message);
check("supplier has assigned demo fulfilments",!supplierFulfilments.error&&(supplierFulfilments.data?.length||0)>0&&supplierFulfilments.data.every(row=>row.supplier_organization_id===supplierMemberships.data[0].organization_id),supplierFulfilments.error?.message);

const admin=await login("admin@chapli.dev");
const adminService=createClient(url,process.env.SUPABASE_SECRET_KEY,{auth:{persistSession:false}});
const adminGrant=await adminService.from("admin_profiles").update({access_expires_at:new Date(Date.now()+5*60*1000).toISOString()}).eq("user_id",admin.user.id);
check("temporary admin grant can be issued",!adminGrant.error,adminGrant.error?.message);
const adminOrders=await admin.client.from("orders").select("id");
check("admin RLS can inspect all orders",!adminOrders.error&&(adminOrders.data?.length||0)>(buyerOrders.data?.length||0),adminOrders.error?.message);

const db=await connectPostgres();
const catalog=await db.query(`select
  (select count(*)::int from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relkind='r' and c.relname<>'_chapli_migrations' and c.relrowsecurity) rls_tables,
  (select count(*)::int from pg_tables where schemaname='public' and tablename<>'_chapli_migrations') user_tables,
  (select count(*)::int from pg_policies where schemaname='public') policies,
  (select count(*)::int from storage.buckets) buckets,
  (select count(*)::int from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public') functions,
  (select count(*)::int from cron.job where jobname='chapli-complete-sent-fulfilments' and active) cron_jobs`);
const meta=catalog.rows[0];
check("RLS enabled on every public user table",meta.rls_tables===meta.user_tables,`${meta.rls_tables}/${meta.user_tables}`);
check("RLS policies installed",meta.policies>=160,`policies=${meta.policies}`);
check("all storage buckets installed",meta.buckets===8,`buckets=${meta.buckets}`);
check("transaction functions installed",meta.functions>=27,`functions=${meta.functions}`);
check("sent-to-done cron active",meta.cron_jobs===1,`jobs=${meta.cron_jobs}`);

const setActor=async userId=>{
  await db.query("set local role authenticated");
  await db.query("select set_config('request.jwt.claims',$1,true)",[JSON.stringify({sub:userId,role:"authenticated",aal:"aal1"})]);
};
const ids=(await db.query(`select
  (select id from public.profiles where email='buyer@chapli.dev') buyer_id,
  (select id from public.profiles where email='seller@chapli.dev') seller_id,
  (select id from public.profiles where email='supplier@chapli.dev') supplier_id,
  (select id from public.profiles where email='admin@chapli.dev') admin_id,
  (select id from public.buyer_addresses where user_id=(select id from public.profiles where email='buyer@chapli.dev') order by is_default desc limit 1) address_id,
  (select spv.id from public.seller_product_variants spv join public.seller_products sp on sp.id=spv.seller_product_id where sp.status='PUBLISHED' and sp.moderation_status='APPROVED' and spv.status='ACTIVE' limit 1) variant_id,
  (select organization_id from public.memberships where user_id=(select id from public.profiles where email='seller@chapli.dev') limit 1) seller_org,
  (select id from public.bank_accounts where organization_id=(select organization_id from public.memberships where user_id=(select id from public.profiles where email='seller@chapli.dev') limit 1) order by priority limit 1) seller_bank,
  (select seller_product_id from public.product_moderation_queue where status='PENDING' limit 1) pending_product,
  (select d.id from public.designs d where d.owner_user_id=(select id from public.profiles where email='seller@chapli.dev') limit 1) seller_design,
  (select f.id from public.fulfilments f where f.supplier_organization_id=(select organization_id from public.memberships where user_id=(select id from public.profiles where email='supplier@chapli.dev') limit 1) and f.status='SENT' limit 1) sent_fulfilment`)).rows[0];

await db.query("begin");
try{
  await setActor(ids.buyer_id);
  const first=await db.query("select public.checkout_create_order($1,$2,jsonb_build_array(jsonb_build_object('variantId',$3::text,'quantity',1))) id",["verify-checkout-idempotency",ids.address_id,ids.variant_id]);
  const second=await db.query("select public.checkout_create_order($1,$2,jsonb_build_array(jsonb_build_object('variantId',$3::text,'quantity',1))) id",["verify-checkout-idempotency",ids.address_id,ids.variant_id]);
  check("checkout is transactional and idempotent",first.rows[0].id===second.rows[0].id,`${first.rows[0].id}/${second.rows[0].id}`);
}finally{await db.query("rollback");}

await db.query("begin");
try{
  await setActor(ids.seller_id);
  const first=await db.query("select public.request_payout($1,$2,$3) id",[ids.seller_org,ids.seller_bank,"seed-payout-pending"]);
  const second=await db.query("select public.request_payout($1,$2,$3) id",[ids.seller_org,ids.seller_bank,"seed-payout-pending"]);
  check("payout request prevents duplicate payment",first.rows[0].id===second.rows[0].id,first.rows[0].id);
  if(ids.seller_design){
    const remaining=await db.query("select public.consume_ai_credit($1,$2) remaining",[ids.seller_design,"verify-ai-credit"]);
    check("AI lifetime credit consumption is transactional",remaining.rows[0].remaining===0,`remaining=${remaining.rows[0].remaining}`);
  }
}finally{await db.query("rollback");}

if(ids.pending_product){
  await db.query("begin");
  try{
    await setActor(ids.admin_id);
    await db.query("select public.moderate_product($1,'APPROVED',null,null)",[ids.pending_product]);
    const state=await db.query("select status,moderation_status from public.seller_products where id=$1",[ids.pending_product]);
    check("admin moderation updates queue/product atomically",state.rows[0].status==="PUBLISHED"&&state.rows[0].moderation_status==="APPROVED",JSON.stringify(state.rows[0]));
  }finally{await db.query("rollback");}
}

if(ids.sent_fulfilment){
  await db.query("begin");
  try{
    await setActor(ids.supplier_id);
    const state=await db.query("select public.transition_fulfilment($1::uuid,'SENT'::public.fulfilment_status,null,$2::text)",[ids.sent_fulfilment,"verify-sent-idempotency"]);
    check("supplier sent transition is idempotent",Boolean(state.rows[0].transition_fulfilment),state.rows[0].transition_fulfilment);
  }finally{await db.query("rollback");}
}
await db.end();
for(const session of [buyer,seller,supplier,admin])await session.client.auth.signOut();
console.log(JSON.stringify({ok:true,checks:results.length,results},null,2));
