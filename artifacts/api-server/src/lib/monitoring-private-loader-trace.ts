import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID, createHash } from "node:crypto";
import { MONITOR_PRIVATE_DIAGNOSTICS_ENABLED } from "./monitoring-product-mode";

type Root = { id:string; artist:string; start:number; sequence:number; emit:(row:unknown)=>void };
const traces = new AsyncLocalStorage<{root:Root; phase:string}>();
const wrapped = new WeakSet<object>();
export function privateTraceCallback(run:()=>void) {
  const c=traces.getStore(); return ()=>c?traces.run(c,run):run();
}
export function privateTraceMark(event:string, detail:object = {}) {
  const c=traces.getStore(); if(!c) return;
  try { c.root.emit({event,id:c.root.id,artist:c.root.artist,phase:c.phase,at:new Date().toISOString(),offsetMs:performance.now()-c.root.start,...detail}); } catch { /* Diagnostics never control serving. */ }
}
export function runPrivateLoaderTrace<T>(artist:string, emit:(row:unknown)=>void, run:()=>T):T {
  if (!MONITOR_PRIVATE_DIAGNOSTICS_ENABLED) return run();
  const keys=(process.env.MONITOR_PRO_LOADER_TRACE_KEY??"").split(",").filter(Boolean);
  if(process.env.MONITOR_PRO_READONLY_PREVIEW!=="true" || !keys.includes(artist)) return run();
  return traces.run({root:{id:randomUUID(),artist,start:performance.now(),sequence:0,emit},phase:"request"},()=>{privateTraceMark("request_start");return run();});
}
export async function privateLoaderPhase<T>(phase:string, run:()=>Promise<T>):Promise<T> {
  const c=traces.getStore(); if(!c)return run();
  return traces.run({root:c.root,phase},async()=>{
    const start=performance.now(); privateTraceMark("phase_start");
    try {const result=await run();privateTraceMark("phase_end",{durationMs:performance.now()-start,rows:Array.isArray(result)?result.length:undefined});return result;}
    catch(error){privateTraceMark("phase_error",{durationMs:performance.now()-start,clientReadTimeout:error instanceof Error&&/Query read timeout/i.test(error.message),statementTimeout:(error as {code?:string}).code==="57014"});throw error;}
  });
}

// Installed only by the isolated launcher, on fresh pools before first connect.
// Preserve callback/Promise APIs and all SQL values. Diagnostic comments only;
// named prepared statements and custom Query objects are deliberately untouched.
export function installPrivatePoolTrace(pool:any, poolName:string) {
  if (!MONITOR_PRIVATE_DIAGNOSTICS_ENABLED) return;
  if(process.env.MONITOR_PRO_READONLY_PREVIEW!=="true" || !process.env.MONITOR_PRO_LOADER_TRACE_KEY)return;
  const connect=pool.connect;
  pool.connect=function(...args:any[]) {
    const c=traces.getStore(), start=performance.now();
    const done=(error:any,client:any)=>{if(c)traces.run(c,()=>privateTraceMark("db_acquire",{pool:poolName,durationMs:performance.now()-start,driverProcessId:client?.processID,failed:Boolean(error)}));};
    if(typeof args[0]==="function") {const cb=args[0];args[0]=function(...a:any[]){done(a[0],a[1]);return c?traces.run(c,()=>cb.apply(this,a)):cb.apply(this,a);};return connect.apply(this,args);}
    return connect.apply(this,args).then((client:any)=>{done(null,client);return client;},(error:any)=>{done(error,null);throw error;});
  };
  pool.on("connect",(client:any)=>{
    if(wrapped.has(client))return;wrapped.add(client);const query=client.query;
    let lastContext:ReturnType<typeof traces.getStore>, lastQueryId:number|undefined;
    // Neon protocol processID is not necessarily pg_stat_activity.pid. Actual
    // PostgreSQL PIDs are correlated by the sampler using the SQL comment.
    client.once("end",()=>{if(lastContext)traces.run(lastContext,()=>privateTraceMark("db_client_end",{pool:poolName,driverProcessId:client.processID,lastQueryId}));});
    client.query=function(...args:any[]) {
      const c=traces.getStore();if(!c || typeof args[0]?.submit==="function")return query.apply(this,args);
      const text=typeof args[0]==="string"?args[0]:args[0]?.text;
      if(typeof text!=="string")return query.apply(this,args);
      const qid=++c.root.sequence,start=performance.now();let ended=false;
      lastContext=c;lastQueryId=qid;
      const info={qid,pool:poolName,driverProcessId:client.processID,queryTimeoutMs:args[0]?.query_timeout||client.connectionParameters?.query_timeout||null,
        queuedQueries:client._queryQueue?.length??null,activeQueryPresent:Boolean(client._activeQuery),sqlSha256:createHash("sha256").update(text).digest("hex")};
      const end=(error:any,result:any)=>{if(ended)return;ended=true;traces.run(c,()=>privateTraceMark("db_query_end",{...info,durationMs:performance.now()-start,rows:result?.rowCount??result?.rows?.length??null,failed:Boolean(error),clientReadTimeout:error instanceof Error&&/Query read timeout/i.test(error.message),statementTimeout:error?.code==="57014"}));};
      privateTraceMark("db_query_start",info);
      if(!args[0]?.name) {const tagged=`/* mt:${c.root.id}:q${qid} */ ${text}`;args[0]=typeof args[0]==="string"?tagged:{...args[0],text:tagged};}
      const last=args.length-1;
      if(typeof args[last]==="function") {const cb=args[last];args[last]=function(...a:any[]){end(a[0],a[1]);return traces.run(c,()=>cb.apply(this,a));};}
      try {const result=query.apply(this,args);if(result&&typeof result.then==="function")result.then((r:any)=>end(null,r),(e:any)=>end(e,null));return result;}
      catch(error){end(error,null);throw error;}
    };
  });
}
