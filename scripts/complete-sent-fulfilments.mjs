import { createClient } from "@supabase/supabase-js";
const db=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SECRET_KEY,{auth:{persistSession:false}});
const now=new Date().toISOString();
const {data:due,error}=await db.from("fulfilments").select("id").eq("status","SENT").lte("auto_complete_at",now).is("returned_at",null).is("cancelled_at",null).limit(100);
if(error)throw error;
let completed=0;
for(const row of due){
 const key=`${row.id}:AUTO_DONE`;
 const {data:event}=await db.from("fulfilment_status_events").select("id").eq("idempotency_key",key).maybeSingle();
 if(event)continue;
 const {error:updateError}=await db.from("fulfilments").update({status:"DONE",done_at:now}).eq("id",row.id).eq("status","SENT");if(updateError)throw updateError;
 const {error:eventError}=await db.from("fulfilment_status_events").insert({fulfilment_id:row.id,from_status:"SENT",to_status:"DONE",actor_type:"SYSTEM",actor_id:"AUTO_COMPLETION_JOB",idempotency_key:key});if(eventError)throw eventError;completed++;
}
console.log(JSON.stringify({checked:due.length,completed}));
