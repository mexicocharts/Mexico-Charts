import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,stat,rm,writeFile,unlink,symlink} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {resolve} from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {repoRoot,toolDirectory,tsxLoader,offlineChildEnvironment} from './paths.mjs';

test('offline CLI resolves the checkout from another cwd, isolates configuration and generates private verified artifacts',async()=>{
  const output=await mkdtemp(tmpdir()+'/monitor-audit-generation-');
  const outside=output+'-outside.json';
  try{
    const log=execFileSync(process.execPath,[resolve(toolDirectory,'generate.mjs'),'--output',output],
      {cwd:tmpdir(),encoding:'utf8',env:{...process.env,DATABASE_URL:'postgresql://secret-sentinel.invalid/db'}});
    assert.ok(!log.includes('secret-sentinel'));
    const metadata=JSON.parse(await readFile(resolve(output,'monitor-audit-artifacts.json'),'utf8'));
    assert.equal(metadata.revision,execFileSync('git',['-C',repoRoot,'rev-parse','HEAD'],{encoding:'utf8'}).trim());
    assert.equal(metadata.networkAttemptsDuringExtraction,0);assert.equal(metadata.databaseQueryAttemptsDuringExtraction,0);
    assert.equal((await stat(output)).mode&0o777,0o700);
    for(const artifact of metadata.artifacts){
      const file=resolve(output,artifact.file),body=await readFile(file);
      assert.equal(createHash('sha256').update(body).digest('hex'),artifact.sha256);
      assert.equal((await stat(file)).mode&0o777,0o600);
    }
    execFileSync(process.execPath,['--import',tsxLoader,resolve(toolDirectory,'verify-evaluator.mjs'),'--output',output],
      {cwd:tmpdir(),env:offlineChildEnvironment(),encoding:'utf8'});
    const pure=JSON.parse(await readFile(resolve(output,'monitor-audit-evaluator.verification.json'),'utf8'));
    assert.equal(pure.evaluatorParityCases.length,14);assert.equal(pure.dateNowForbidden,true);assert.equal(pure.externalImports,0);
    assert.equal(pure.identityPermutationParity.permutations,40);assert.equal(pure.identityPermutationParity.tiedNameOrderingLimitationConfirmed,true);
    if(process.env.MONITOR_HISTORY_PGLITE_MODULE){
      execFileSync(process.execPath,[resolve(toolDirectory,'verify-manifest.mjs'),'--output',output],{cwd:tmpdir(),encoding:'utf8'});
      const postgres=JSON.parse(await readFile(resolve(output,'monitor-audit-manifest.verification.json'),'utf8'));
      assert.equal(postgres.transactionClockEvidenceExecuted,true);assert.equal(postgres.allTypedMissingCtesExecuted,true);
    }
    await writeFile(outside,'{"outside":true}',{mode:0o600});
    await unlink(resolve(output,'monitor-audit-evaluator.verification.json'));
    await symlink(outside,resolve(output,'monitor-audit-evaluator.verification.json'));
    assert.throws(()=>execFileSync(process.execPath,['--import',tsxLoader,resolve(toolDirectory,'verify-evaluator.mjs'),'--output',output],
      {cwd:tmpdir(),env:offlineChildEnvironment(),stdio:'pipe'}));
    await unlink(resolve(output,'monitor-audit-evaluator.js'));
    await symlink(outside,resolve(output,'monitor-audit-evaluator.js'));
    assert.throws(()=>execFileSync(process.execPath,[resolve(toolDirectory,'generate.mjs'),'--output',output],{cwd:tmpdir(),stdio:'pipe'}));
    assert.equal(await readFile(outside,'utf8'),'{"outside":true}');
  }finally{await rm(output,{recursive:true,force:true});await rm(outside,{force:true});}
});
