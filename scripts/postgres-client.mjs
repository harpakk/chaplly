import pg from "pg";

export const retryableConnectionError=(error)=>{
  const message=error instanceof Error?error.message:String(error);
  return error?.code==="08006"||
    /eauthtimeout|timeout while waiting|timeout expired|etimedout|econnreset|connection terminated/i.test(message);
};

export async function connectPostgres(connectionString=process.env.DATABASE_URL){
  if(!connectionString)throw new Error("DATABASE_URL is required.");
  let lastError;
  for(let attempt=0;attempt<3;attempt+=1){
    const client=new pg.Client({
      connectionString,
      ssl:{rejectUnauthorized:false},
      connectionTimeoutMillis:20_000,
      keepAlive:true,
    });
    // pg can emit a socket error in addition to rejecting the active query.
    // Registering a listener prevents that second notification from crashing
    // migration/maintenance scripts before their retry logic can run.
    client.on("error",()=>undefined);
    try{
      await client.connect();
      return client;
    }catch(error){
      lastError=error;
      await client.end().catch(()=>undefined);
      if(!retryableConnectionError(error)||attempt===2)throw error;
      await new Promise(resolve=>setTimeout(resolve,500*(attempt+1)));
    }
  }
  throw lastError;
}
