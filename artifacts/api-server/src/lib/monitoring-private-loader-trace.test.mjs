import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { installPrivatePoolTrace, runPrivateLoaderTrace, privateLoaderPhase, privateTraceCallback, privateTraceMark } from './monitoring-private-loader-trace.ts';

test('private trace preserves callbacks, promises, values and error identity without logging data', async()=>{
  process.env.MONITOR_PRO_READONLY_PREVIEW='true';
  process.env.MONITOR_PRO_LOADER_TRACE_KEY='test-artist,second-artist';
  const logs=[],calls=[];
  const failure=new Error('Query read timeout');
  const client=Object.assign(new EventEmitter(),{processID:42,connectionParameters:{query_timeout:12000},_queryQueue:[],query(...args){
    calls.push(args);const cb=args.at(-1);const result={rowCount:2,rows:[{secret:'never-log'}]};
    if(typeof cb==='function'){queueMicrotask(()=>cb(null,result));return;}
    return args[0]?.text?.includes('FAIL')?Promise.reject(failure):Promise.resolve(result);
  }});
  const pool=new EventEmitter();
  pool.connect=function(cb){if(cb){queueMicrotask(()=>cb(null,client,()=>{}));return;}return Promise.resolve(client);};
  installPrivatePoolTrace(pool,'monitoring');pool.emit('connect',client);
  let finish;
  await runPrivateLoaderTrace('test-artist',x=>logs.push(x),async()=>{
    finish=privateTraceCallback(()=>privateTraceMark('response_finish'));
    await privateLoaderPhase('identity_initial',async()=>{
      const c=await pool.connect();await c.query({text:'SELECT $1',values:['private-value']});
      await new Promise((resolve,reject)=>pool.connect((e,c)=>e?reject(e):c.query('SELECT 2',(e,r)=>e?reject(e):resolve(r))));
      await assert.rejects(c.query({text:'FAIL'}),e=>e===failure);
      await c.query({name:'prepared',text:'SELECT 3'});
    });
  });
  finish();
  assert.equal(logs.filter(x=>x.event==='db_query_end').length,4);
  assert.equal(logs.filter(x=>x.event==='db_acquire').length,2);
  assert.ok(logs.filter(x=>x.event==='db_query_start').every(x=>x.phase==='identity_initial'&&x.driverProcessId===42&&x.backendPid===undefined&&x.queryTimeoutMs===12000));
  client.emit('end');
  assert.ok(logs.some(x=>x.event==='db_client_end'&&x.lastQueryId===4));
  assert.ok(logs.some(x=>x.clientReadTimeout===true));
  assert.ok(logs.some(x=>x.event==='response_finish'));
  assert.equal(calls[0][0].values[0],'private-value');
  assert.match(calls[0][0].text,/^\/\* mt:/);
  assert.equal(calls.at(-1)[0].text,'SELECT 3');
  assert.doesNotMatch(JSON.stringify(logs),/private-value|never-log|SELECT/);
  const before=logs.length;
  await runPrivateLoaderTrace('other',x=>logs.push(x),()=>client.query('SELECT untraced'));
  assert.equal(logs.length,before);
  delete process.env.MONITOR_PRO_READONLY_PREVIEW;
  await runPrivateLoaderTrace('test-artist',x=>logs.push(x),()=>client.query('SELECT disabled'));
  assert.equal(logs.length,before);
});
