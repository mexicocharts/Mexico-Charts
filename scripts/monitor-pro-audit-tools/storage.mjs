/** Optional POSIX host adapter. No database/provider imports or initialization. */
import { Buffer } from 'node:buffer';
import { constants } from 'node:fs';
import { mkdir, lstat, open, rename, unlink } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
export function createPrivateAuditStorage(directory) {
  const root = resolve(directory);
  function filename(key) {
    if (typeof key !== 'string' || !key.split('/').every(part => /^[A-Za-z0-9_.-]+$/.test(part) && part !== '.' && part !== '..')) throw new Error('Unsafe audit artifact key');
    return resolve(root,key);
  }
  async function inspect(path) {
    try { return await lstat(path); } catch(error) { if(error?.code==='ENOENT') return null; throw error; }
  }
  async function directoryGuard(path, create, recursive=false) {
    let state=await inspect(path);
    if (!state && create) { await mkdir(path,{recursive,mode:0o700});state=await inspect(path); }
    if (!state) return false;
    if (state.isSymbolicLink() || !state.isDirectory()) throw new Error('Audit directories cannot be symlinks or non-directories');
    if (create) {
      const handle=await open(path,constants.O_RDONLY|constants.O_DIRECTORY|constants.O_NOFOLLOW);
      try { await handle.chmod(0o700); } finally { await handle.close(); }
    }
    return true;
  }
  async function parents(key,create) {
    if (!await directoryGuard(root,create,true)) return false;
    let parent=root;
    for(const part of key.split('/').slice(0,-1)) {
      parent=resolve(parent,part);
      if(!await directoryGuard(parent,create))return false;
    }
    return true;
  }
  async function fileGuard(path) {
    const state=await inspect(path);
    if(state && (state.isSymbolicLink() || !state.isFile()))throw new Error('Audit artifacts cannot be symlinks or non-files');
    return state;
  }
  async function readText(key) {
      const path=filename(key);
      if(!await parents(key,false)||!await fileGuard(path))return null;
      const file=await open(path,constants.O_RDONLY|constants.O_NOFOLLOW);
      try {
        const bytes=await file.readFile(),value=bytes.toString('utf8');
        if(!bytes.equals(Buffer.from(value,'utf8')))throw new Error('Audit text artifact must contain exact valid UTF8 bytes');
        return value;
      }
      finally { await file.close(); }
  }
  return {
    readText,
    async read(key) {
      const value=await readText(key);return value===null?null:key.endsWith('.csv')?value:JSON.parse(value);
    },
    async persist(key,value) {
      const path=filename(key);
      await parents(key,true);await fileGuard(path);
      const temporary=path+'.'+randomUUID()+'.pending';let file;
      try {
        file=await open(temporary,constants.O_WRONLY|constants.O_CREAT|constants.O_EXCL|constants.O_NOFOLLOW,0o600);
        await file.writeFile(typeof value==='string'?value:JSON.stringify(value)+'\n','utf8');await file.sync();await file.close();file=null;
        await parents(key,false);await fileGuard(path);await rename(temporary,path);
        const folder=await open(dirname(path),constants.O_RDONLY|constants.O_DIRECTORY|constants.O_NOFOLLOW);
        try{await folder.sync();}finally{await folder.close();}
      } finally { if(file)await file.close();await unlink(temporary).catch(error=>{if(error?.code!=='ENOENT')throw error;}); }
      return {key,path};
    }
  };
}
