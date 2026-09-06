import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,stat,rm,writeFile,unlink,symlink,mkdir,readdir,realpath,copyFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {resolve,relative,dirname} from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {repoRoot,toolDirectory,offlineChildEnvironment,verifyAuditCheckout,bundledRosterFrontendSources} from './paths.mjs';

const git=(root,...args)=>execFileSync('git',['-c','core.hooksPath=/dev/null','-c','core.fsmonitor=false','-C',root,...args],
  {encoding:'utf8',env:{...process.env,GIT_OPTIONAL_LOCKS:'0'},stdio:['ignore','pipe','pipe']}).trim();
async function seedRepository(root) {
  await mkdir(root,{recursive:true});git(root,'init','-q');
  await writeFile(resolve(root,'.gitignore'),'node_modules\nprivate/\n');
  await writeFile(resolve(root,'app.txt'),'unchanged application');
  git(root,'add','.');git(root,'-c','user.name=Audit Fixture','-c','user.email=audit-fixture@example.invalid','commit','-qm','fixture');
}
async function dependencyOverlay(target) {
  for(const scope of ['','scripts','lib/db','artifacts/api-server']) {
    const source=resolve(repoRoot,scope,'node_modules'),destination=resolve(target,scope,'node_modules');
    await mkdir(destination,{recursive:true});
    for(const entry of await readdir(source,{withFileTypes:true})) {
      if(entry.name.startsWith('.'))continue;
      if(entry.name==='@workspace') {
        await mkdir(resolve(destination,entry.name),{recursive:true});
        for(const workspace of await readdir(resolve(source,entry.name))) {
          const mapped=resolve(target,relative(repoRoot,await realpath(resolve(source,entry.name,workspace))));
          await symlink(mapped,resolve(destination,entry.name,workspace));
        }
      } else await symlink(await realpath(resolve(source,entry.name)),resolve(destination,entry.name));
    }
  }
}
async function committedToolWorktree(base) {
  const seed=resolve(base,'seed'),worktree=resolve(base,'worktree');await mkdir(seed);
  const configs=git(repoRoot,'ls-tree','-r','--name-only','HEAD').split('\n').filter(path=>/(?:^|\/)(?:package|tsconfig[^/]*)\.json$/.test(path));
  const archive=execFileSync('git',['-C',repoRoot,'archive','HEAD','artifacts/api-server/src/lib','lib','scripts/monitor-pro-audit-tools','.gitignore','pnpm-workspace.yaml',...bundledRosterFrontendSources,...configs],{maxBuffer:32*1024*1024});
  execFileSync('tar',['-x','-C',seed],{input:archive});
  // Commit current tool inputs in this synthetic fixture; never label its bytes
  // as the production checkout revision when reviewing uncommitted changes.
  for(const file of await readdir(toolDirectory))if(file.endsWith('.mjs')||file==='README.md')await copyFile(resolve(toolDirectory,file),resolve(seed,'scripts/monitor-pro-audit-tools',file));
  for(const file of ['monitoring-bundled-roster.ts','monitoring-candidate-policy.ts','monitoring-candidate-audit.ts',
    'monitoring-youtube-serving.ts','monitoring-youtube-native-diagnostics.ts','monitoring-youtube-native-contract.ts','monitoring-youtube-native-history.ts'])
    await copyFile(resolve(repoRoot,'artifacts/api-server/src/lib',file),resolve(seed,'artifacts/api-server/src/lib',file));
  git(seed,'init','-q');git(seed,'add','.');git(seed,'-c','user.name=Audit Fixture','-c','user.email=audit-fixture@example.invalid','commit','-qm','committed audit fixture');
  git(seed,'worktree','add','--detach',worktree,'HEAD');await dependencyOverlay(worktree);
  return {seed,worktree};
}

test('offline CLI verifies a real linked worktree from another cwd and generates private source-bound artifacts',async()=>{
  const base=await mkdtemp(tmpdir()+'/monitor-audit-generation-');
  const {worktree}=await committedToolWorktree(base), tools=resolve(worktree,'scripts/monitor-pro-audit-tools');
  const tsxLoader=resolve(worktree,'scripts/node_modules/tsx/dist/loader.mjs'),output=resolve(base,'output');
  const outside=output+'-outside.json';
  try{
    const log=execFileSync(process.execPath,[resolve(tools,'generate.mjs'),'--output',output],
      {cwd:tmpdir(),encoding:'utf8',env:{...process.env,DATABASE_URL:'postgresql://secret-sentinel.invalid/db'}});
    assert.ok(!log.includes('secret-sentinel'));
    const metadata=JSON.parse(await readFile(resolve(output,'monitor-audit-artifacts.json'),'utf8'));
    assert.equal(metadata.revision,git(worktree,'rev-parse','HEAD'));
    assert.equal(metadata.sourceCheckout.gitTopLevel,await realpath(worktree));assert.ok(metadata.sourceCheckout.verifiedSourceCount>3);
    assert.ok(metadata.sourceCheckout.compiledInputs.some(input=>input.path.endsWith('/replay.mjs')&&input.sha256));
    assert.deepEqual(metadata.sourceCheckout.bundledSourceFiles.map(file=>file.path),[...bundledRosterFrontendSources,'artifacts/api-server/src/lib/supplemental-artist-data.ts']);
    const manifest=JSON.parse(await readFile(resolve(output,'monitor-audit-sql-manifest.json'),'utf8'));
    assert.equal(manifest.bundledPopulation.revision,metadata.revision);
    assert.ok(manifest.bundledPopulation.rows.length>0);assert.deepEqual(manifest.bundledPopulation.sourceFiles,metadata.sourceCheckout.bundledSourceFiles);
    assert.equal(metadata.networkAttemptsDuringExtraction,0);assert.equal(metadata.databaseQueryAttemptsDuringExtraction,0);
    assert.equal((await stat(output)).mode&0o777,0o700);
    for(const artifact of metadata.artifacts){
      const file=resolve(output,artifact.file),body=await readFile(file);
      assert.equal(createHash('sha256').update(body).digest('hex'),artifact.sha256);
      assert.equal((await stat(file)).mode&0o777,0o600);
    }
    execFileSync(process.execPath,['--import',tsxLoader,resolve(tools,'verify-evaluator.mjs'),'--output',output],
      {cwd:tmpdir(),env:offlineChildEnvironment(),encoding:'utf8'});
    const pure=JSON.parse(await readFile(resolve(output,'monitor-audit-evaluator.verification.json'),'utf8'));
    assert.equal(pure.evaluatorParityCases.length,14);assert.equal(pure.dateNowForbidden,true);assert.equal(pure.externalImports,0);
    assert.equal(pure.identityPermutationParity.permutations,40);assert.equal(pure.identityPermutationParity.tiedNameOrderingLimitationConfirmed,true);
    if(process.env.MONITOR_HISTORY_PGLITE_MODULE){
      execFileSync(process.execPath,[resolve(tools,'verify-manifest.mjs'),'--output',output],{cwd:tmpdir(),encoding:'utf8'});
      const postgres=JSON.parse(await readFile(resolve(output,'monitor-audit-manifest.verification.json'),'utf8'));
      assert.equal(postgres.transactionClockEvidenceExecuted,true);assert.equal(postgres.allTypedMissingCtesExecuted,true);
      assert.equal(postgres.bundledPopulationVerified,true);assert.equal(postgres.populationComplete,false);
    }
    await writeFile(outside,'{"outside":true}',{mode:0o600});
    await unlink(resolve(output,'monitor-audit-evaluator.verification.json'));
    await symlink(outside,resolve(output,'monitor-audit-evaluator.verification.json'));
    assert.throws(()=>execFileSync(process.execPath,['--import',tsxLoader,resolve(tools,'verify-evaluator.mjs'),'--output',output],
      {cwd:tmpdir(),env:offlineChildEnvironment(),stdio:'pipe'}));
    await unlink(resolve(output,'monitor-audit-evaluator.js'));
    await symlink(outside,resolve(output,'monitor-audit-evaluator.js'));
    assert.throws(()=>execFileSync(process.execPath,[resolve(tools,'generate.mjs'),'--output',output],{cwd:tmpdir(),stdio:'pipe'}));
    assert.equal(await readFile(outside,'utf8'),'{"outside":true}');
  }finally{await rm(base,{recursive:true,force:true});}
});

test('nested false checkout is rejected before output changes or compilation and leaves parent application intact',async()=>{
  const base=await mkdtemp(tmpdir()+'/monitor-audit-false-root-'),parent=resolve(base,'parent'),fake=resolve(parent,'private','fake'),output=resolve(base,'output');
  try{
    await seedRepository(parent);const originalHead=git(parent,'rev-parse','HEAD');
    const directory=resolve(fake,'scripts/monitor-pro-audit-tools');await mkdir(directory,{recursive:true});
    for(const file of ['generate.mjs','paths.mjs','storage.mjs'])await copyFile(resolve(toolDirectory,file),resolve(directory,file));
    await mkdir(output,{mode:0o755});await writeFile(resolve(output,'sentinel.txt'),'existing private output');
    const mode=(await stat(output)).mode&0o777;
    for(const linkedMetadata of [false,true]) {
      if(linkedMetadata)await symlink(resolve(parent,'.git'),resolve(fake,'.git'));
      assert.throws(()=>execFileSync(process.execPath,[resolve(directory,'generate.mjs'),'--output',output],{cwd:parent,stdio:'pipe'}),
        error=>/parent\/shared checkout metadata|share Git metadata through a symlink/.test(error.stderr.toString()));
      assert.deepEqual(await readdir(output),['sentinel.txt']);assert.equal((await stat(output)).mode&0o777,mode);
      assert.equal(await readFile(resolve(output,'sentinel.txt'),'utf8'),'existing private output');
      assert.equal(git(parent,'rev-parse','HEAD'),originalHead);assert.equal(await readFile(resolve(parent,'app.txt'),'utf8'),'unchanged application');
      assert.equal(git(parent,'status','--porcelain'),'');
    }
  }finally{await rm(base,{recursive:true,force:true});}
});

test('preflight rejects Git location/config overrides by name, while harmless authentication variables remain allowed',async()=>{
  const base=await mkdtemp(tmpdir()+'/monitor-audit-git-env-'),root=resolve(base,'repo'),output=resolve(base,'output');
  try{
    await seedRepository(root);const directory=resolve(root,'scripts/monitor-pro-audit-tools');await mkdir(directory,{recursive:true});
    for(const file of ['generate.mjs','paths.mjs','storage.mjs'])await copyFile(resolve(toolDirectory,file),resolve(directory,file));
    git(root,'add','.');git(root,'-c','user.name=Audit Fixture','-c','user.email=audit-fixture@example.invalid','commit','-qm','tool sources');
    for(const name of ['GIT_DIR','GIT_WORK_TREE','GIT_COMMON_DIR','GIT_INDEX_FILE','GIT_OBJECT_DIRECTORY','GIT_ALTERNATE_OBJECT_DIRECTORIES','GIT_CONFIG_COUNT','GIT_REPLACE_REF_BASE']){
      assert.throws(()=>execFileSync(process.execPath,[resolve(directory,'generate.mjs'),'--output',output],
        {env:{...process.env,[name]:'private-override-sentinel'},stdio:'pipe'}),error=>{
          const stderr=error.stderr.toString();assert.ok(stderr.includes(name));assert.ok(!stderr.includes('private-override-sentinel'));return true;
        });
      await assert.rejects(stat(output),{code:'ENOENT'});
    }
    const code=`import {verifyAuditCheckout} from ${JSON.stringify(resolve(directory,'paths.mjs'))};console.log(verifyAuditCheckout().revision)`;
    const revision=execFileSync(process.execPath,['--input-type=module','-e',code],
      {env:{...process.env,GIT_ASKPASS:'unused-auth-sentinel',GIT_TERMINAL_PROMPT:'0'},encoding:'utf8'}).trim();
    assert.equal(revision,git(root,'rev-parse','HEAD'));await assert.rejects(stat(output),{code:'ENOENT'});
  }finally{await rm(base,{recursive:true,force:true});}
});

test('preflight verifies tracked source bytes even when Git status hides an assumed-unchanged entry',async()=>{
  const base=await mkdtemp(tmpdir()+'/monitor-audit-source-integrity-');
  try{
    await seedRepository(base);await mkdir(resolve(base,'src'));await writeFile(resolve(base,'src/entry.mjs'),'export default 1;\n');
    git(base,'add','.');git(base,'-c','user.name=Audit Fixture','-c','user.email=audit-fixture@example.invalid','commit','-qm','tracked source');
    const checkout=verifyAuditCheckout({root:base,requiredSources:['src/entry.mjs']});
    assert.equal(checkout.sources.find(source=>source.path==='src/entry.mjs').gitBlob,git(base,'rev-parse','HEAD:src/entry.mjs'));
    assert.throws(()=>verifyAuditCheckout({root:base,requiredSources:['src/untracked.mjs']}),/not a tracked regular HEAD file/);
    git(base,'update-index','--assume-unchanged','src/entry.mjs');await writeFile(resolve(base,'src/entry.mjs'),'export default 2;\n');
    assert.equal(git(base,'status','--porcelain'),'');
    assert.throws(()=>verifyAuditCheckout({root:base,requiredSources:['src/entry.mjs']}),/bytes differ from HEAD/);
    assert.throws(()=>checkout.verifyUnchanged(),/bytes differ from HEAD/);
  }finally{await rm(base,{recursive:true,force:true});}
});

test('preflight binds to the actual HEAD tree rather than a replacement-ref view',async()=>{
  const base=await mkdtemp(tmpdir()+'/monitor-audit-replacement-ref-');
  try{
    await seedRepository(base);await mkdir(resolve(base,'src'));await writeFile(resolve(base,'src/entry.mjs'),'export default 1;\n');
    git(base,'add','.');git(base,'-c','user.name=Audit Fixture','-c','user.email=audit-fixture@example.invalid','commit','-qm','original source');
    const original=git(base,'rev-parse','HEAD'),originalBlob=git(base,'rev-parse','HEAD:src/entry.mjs');
    await writeFile(resolve(base,'src/entry.mjs'),'export default 2;\n');git(base,'add','.');
    git(base,'-c','user.name=Audit Fixture','-c','user.email=audit-fixture@example.invalid','commit','-qm','replacement source');
    const replacement=git(base,'rev-parse','HEAD');git(base,'reset','--hard',original);git(base,'replace',original,replacement);
    assert.notEqual(git(base,'rev-parse','HEAD:src/entry.mjs'),originalBlob);
    const checkout=verifyAuditCheckout({root:base,requiredSources:['src/entry.mjs']});
    assert.equal(checkout.revision,original);assert.equal(checkout.sources.find(source=>source.path==='src/entry.mjs').gitBlob,originalBlob);
  }finally{await rm(base,{recursive:true,force:true});}
});
