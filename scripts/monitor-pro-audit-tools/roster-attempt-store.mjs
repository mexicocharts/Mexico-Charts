import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import os from 'node:os';
import assert from 'node:assert/strict';
export const sha256 = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
export function privateDirectory(dir) {
 fs.mkdirSync(dir,{recursive:true,mode:0o700});
 assert(fs.lstatSync(dir).isDirectory() && !fs.lstatSync(dir).isSymbolicLink());
}
export function readBytes(file) {
 const fd=fs.openSync(file,fs.constants.O_RDONLY|fs.constants.O_NOFOLLOW);
 try {assert(fs.fstatSync(fd).isFile());return fs.readFileSync(fd);} finally {fs.closeSync(fd);}
}
export function readJson(file) {return JSON.parse(readBytes(file));}
function syncDirectory(dir) {const fd=fs.openSync(dir,'r');try{fs.fsyncSync(fd);}finally{fs.closeSync(fd);}}
export function writeExclusive(file,value) {
 privateDirectory(path.dirname(file));
 const bytes=Buffer.isBuffer(value)?value:Buffer.from(JSON.stringify(value,null,2)+'\n');
 const tmp=file+'.tmp-'+crypto.randomUUID();
 const fd=fs.openSync(tmp,'wx',0o600);
 try {fs.writeFileSync(fd,bytes);fs.fsyncSync(fd);} finally {fs.closeSync(fd);}
 try {fs.linkSync(tmp,file);} finally {fs.unlinkSync(tmp);}
 syncDirectory(path.dirname(file));
 return {file,bytes:bytes.length,sha256:sha256(bytes)};
}
export function acquireAuditLock(root) {
 privateDirectory(root);const file=path.join(root,'LOCK.json');
 if(fs.existsSync(file)) {
  const old=readJson(file);assert.equal(old.host,os.hostname(),'Lock belongs to another host');
  let alive=true;try{process.kill(old.pid,0);}catch(e){if(e.code==='ESRCH')alive=false;else throw e;}
  assert(!alive,'An audit process still owns the lock');
  privateDirectory(path.join(root,'locks'));
  fs.renameSync(file,path.join(root,'locks',old.id+'.abandoned.json'));syncDirectory(root);
 }
 const owner={id:crypto.randomUUID(),pid:process.pid,host:os.hostname(),at:new Date().toISOString()};
 writeExclusive(file,owner);
 return ()=>{assert.equal(readJson(file).id,owner.id);writeExclusive(path.join(root,'locks',owner.id+'.released.json'),owner);fs.unlinkSync(file);syncDirectory(root);};
}
export function createAttemptStore(root,scopeHash) {
 privateDirectory(root);
 const folder=index=>{assert(Number.isSafeInteger(index)&&index>=0);return path.join(root,String(index));};
 function last(index) {
  const dir=folder(index);if(!fs.existsSync(dir))return null;
  const starts=fs.readdirSync(dir).filter(n=>/^\d+\.start\.json$/.test(n)).map(n=>Number(n.split('.')[0])).sort((a,b)=>a-b);
  if(!starts.length)return null;
  assert(starts.every((n,i)=>n===i),'Attempt journal has a gap');
  const number=starts.at(-1),startFile=path.join(dir,number+'.start.json'),start=readJson(startFile);
  assert.equal(start.index,index);assert.equal(start.scopeHash,scopeHash);
  const outcomeFile=path.join(dir,number+'.outcome.json');let outcome=null;
  if(fs.existsSync(outcomeFile)){const saved=readJson(outcomeFile);assert.equal(saved.startSha256,sha256(readBytes(startFile)));outcome=saved.outcome;}
  return {...start,startFile,outcomeFile,outcome};
 }
 function reserve(index,context) {
  const previous=last(index);
  assert(!previous || previous.outcome?.status==='zero_query_deferred','Prior attempt is not safely deferred');
  const number=previous?previous.number+1:0;
  const start={index,number,scopeHash,at:new Date().toISOString(),context};
  writeExclusive(path.join(folder(index),number+'.start.json'),start);return last(index);
 }
 function finish(attempt,outcome) {
  assert.equal(last(attempt.index).startFile,attempt.startFile,'Attempt superseded');
  return writeExclusive(attempt.outcomeFile,{startSha256:sha256(readBytes(attempt.startFile)),outcome});
 }
 return {last,reserve,finish};
}
