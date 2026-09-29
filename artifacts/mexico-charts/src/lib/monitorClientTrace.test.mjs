import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { beginMonitorClientTrace } from './monitorClientTrace.mjs';
import { createAuthenticatedFetch } from '../auth/authenticatedFetch.mjs';

test('ordinary builds have no client trace', () => {
  assert.equal(beginMonitorClientTrace('/api/monitoring/dashboard/luismiguel'), undefined);
});

test('diagnostic transport exposes phases but never credentials or payload', async () => {
  const rows = [];
  const request = createAuthenticatedFetch({locationHref:()=> 'https://preview.example/',logger:()=>{},
    fetchImpl:async (_input, init)=>{assert.equal(init.headers.get('authorization'),'Bearer secret-test-value');return new Response('{"private":"payload"}');}});
  await request(async()=> 'secret-test-value', '/api/monitoring/dashboard/luismiguel', {}, (event, detail)=>rows.push({event,...detail}));
  assert.deepEqual(rows.map(x=>x.event), ['token_start','token_end','fetch_start','response_headers']);
  assert.doesNotMatch(JSON.stringify(rows), /secret-test-value|payload|authorization/i);
});

test('stale private build key cannot reactivate timing overlays or body interception', async () => {
  const source = (await readFile(new URL('./monitorClientTrace.mjs',import.meta.url),'utf8'))
    .replace('"./monitorProductMode.mjs"', JSON.stringify(new URL('./monitorProductMode.mjs',import.meta.url).href))
    .replaceAll('import.meta.env', '({VITE_MONITOR_CLIENT_TRACE_KEY:"luismiguel",BASE_URL:"/monitor-pro-private-preview/"})');
  const module = await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
  const oldDocument=globalThis.document, oldRaf=globalThis.requestAnimationFrame;
  let output;
  globalThis.document={getElementById:()=>output,createElement:()=>({style:{},setAttribute(){}}),body:{appendChild:node=>{output=node;}}};
  globalThis.requestAnimationFrame=fn=>fn();
  try {
    assert.equal(module.beginMonitorClientTrace('/api/monitoring/dashboard/other'),undefined);
    assert.equal(module.beginMonitorClientTrace('/api/monitoring/dashboard/luismiguel'),undefined);
    module.markMonitorPanelCommit('luismiguel');
    assert.equal(output,undefined);
  } finally {globalThis.document=oldDocument;globalThis.requestAnimationFrame=oldRaf;}
});

test('abort is reported without recording error text', async () => {
  const rows=[];
  const request=createAuthenticatedFetch({locationHref:()=> 'https://preview.example/',logger:()=>{},fetchImpl:async()=>{throw new DOMException('sensitive failure','AbortError');}});
  await assert.rejects(request(async()=>null,'/api/monitoring/dashboard/luismiguel',{},(event,detail)=>rows.push({event,...detail})),{name:'AbortError'});
  assert.equal(rows.at(-1).abort,true);
  assert.doesNotMatch(JSON.stringify(rows),/sensitive failure/);
});
