import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import test from 'node:test';import assert from 'node:assert/strict';
import {createAttemptStore,writeExclusive,readJson,acquireAuditLock} from './roster-attempt-store.mjs';
function fixture(t){const root=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'roster-store-')));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));return root;}
test('partial completion persists across fresh store instances and repeated reads',t=>{
 const root=fixture(t);let s=createAttemptStore(root,'scope');const a=s.reserve(4,{key:'Exact'});s.finish(a,{status:'completed',decision:{classification:'C',auditStatus:'incomplete'}});
 s=createAttemptStore(root,'scope');assert.equal(s.last(4).outcome.status,'completed');assert.throws(()=>s.reserve(4,{}));assert.equal(s.last(4).context.key,'Exact');
});
test('zero-query deferral preserves original attempt and next identity across resumes',t=>{
 const root=fixture(t);let s=createAttemptStore(root,'scope');const a=s.reserve(26,{});s.finish(a,{status:'zero_query_deferred',sourceQueries:0});const original=fs.readFileSync(a.outcomeFile);
 s=createAttemptStore(root,'scope');const b=s.reserve(26,{});assert.equal(b.number,1);s.finish(b,{status:'completed'});assert.deepEqual(fs.readFileSync(a.outcomeFile),original);
});
test('interrupted in-flight attempt cannot be retried without durable recovery',t=>{
 const root=fixture(t);createAttemptStore(root,'s').reserve(1,{});const s=createAttemptStore(root,'s');assert.equal(s.last(1).outcome,null);assert.throws(()=>s.reserve(1,{}));
});
test('duplicate finish and corrupt source binding cannot overwrite evidence',t=>{
 const root=fixture(t),s=createAttemptStore(root,'s'),a=s.reserve(1,{});s.finish(a,{status:'completed'});assert.throws(()=>s.finish(a,{status:'capture_failure'}));
 fs.appendFileSync(a.startFile,' ');assert.throws(()=>s.last(1));
});
test('scope drift and symlink reads fail closed',t=>{
 const root=fixture(t);const a=createAttemptStore(root,'original').reserve(1,{});assert.throws(()=>createAttemptStore(root,'other').last(1));
 fs.symlinkSync(a.startFile,path.join(root,'link'));assert.throws(()=>readJson(path.join(root,'link')));
});
test('exclusive process lock prevents concurrent resume',t=>{
 const root=fixture(t);const release=acquireAuditLock(root);assert.throws(()=>acquireAuditLock(root));release();const again=acquireAuditLock(root);again();
});
test('exclusive atomic write preserves existing artifact',t=>{
 const root=fixture(t),file=path.join(root,'x.json');writeExclusive(file,{x:1});assert.throws(()=>writeExclusive(file,{x:2}));assert.deepEqual(readJson(file),{x:1});
});
