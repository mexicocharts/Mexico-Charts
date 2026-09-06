/** Offline audit artifact generation. Production execution is supplied separately through the SELECT-only tool. */
import { chmod, readFile, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { repoRoot, toolDirectory, tsxLoader, esbuildExecutable, outputArgument, offlineChildEnvironment, verifyAuditCheckout, bundledRosterFrontendSources } from './paths.mjs';
import { createPrivateAuditStorage } from './storage.mjs';

const output = outputArgument();
if (output === repoRoot || output === toolDirectory || output.startsWith(toolDirectory + '/')) throw new Error('Choose a separate private artifact directory');
const bundles = [
  ['artifacts/api-server/src/lib/monitoring-candidate-policy.ts', 'monitor-audit-evaluator', 'MonitorAudit'],
  ['scripts/monitor-pro-audit-tools/replay.mjs', 'monitor-audit-replay', 'MonitorAuditReplay'],
  ['scripts/monitor-pro-audit-tools/manifest-helper.mjs', 'monitor-audit-manifest-helper', 'MonitorAuditManifest'],
];
// No output creation, chmod, compiler, or source import is allowed before this.
const checkout=verifyAuditCheckout({requiredSources:[...bundles.map(([source])=>source),...bundledRosterFrontendSources]});
const esbuild = esbuildExecutable();
const storage = createPrivateAuditStorage(output);
await storage.persist('generation-status.json',{status:'generating'});
const compiledInputs=new Set();
for (const [source, name, global] of bundles) {
  // Reject existing symlink artifacts before the compiler writes into this private root.
  await storage.persist(name+'.js','');await storage.persist(name+'.meta.json','');
  execFileSync(esbuild, [source, '--bundle', '--platform=browser', '--format=iife', '--global-name='+global,
    '--target=es2022', '--minify', ...(name==='monitor-audit-evaluator'?[]:['--tsconfig-raw={"compilerOptions":{"alwaysStrict":false}}']), '--outfile='+resolve(output,name+'.js'), '--metafile='+resolve(output,name+'.meta.json')],
    { cwd:repoRoot, stdio:['ignore','pipe','pipe'] });
  await chmod(resolve(output,name+'.js'),0o600);
  await chmod(resolve(output,name+'.meta.json'),0o600);
  const compilation=JSON.parse(await readFile(resolve(output,name+'.meta.json'),'utf8'));
  const verified=checkout.verifySources(Object.keys(compilation.inputs));
  for(const input of verified){
    if(compilation.inputs[input.path].bytes!==input.bytes)throw new Error('Compiler input size differs from verified source: '+input.path);
    compiledInputs.add(input.path);
  }
}
// Only this isolated child imports source SQL/schema modules. It receives no
// production variables and rejects every pg query/connect and network attempt.
const manifest = JSON.parse(execFileSync(process.execPath,
  ['--import',tsxLoader,resolve(toolDirectory,'extract-manifest.mjs')],
  { cwd:repoRoot, env:offlineChildEnvironment(), encoding:'utf8', maxBuffer:4*1024*1024 }));
const bundledSourceFiles=checkout.verifySources(manifest.bundledPopulation.sourceFiles.map(file=>file.path));
if(JSON.stringify(bundledSourceFiles)!==JSON.stringify(manifest.bundledPopulation.sourceFiles))throw new Error('Bundled roster source bytes differ from verified HEAD inputs');
await storage.persist('monitor-audit-sql-manifest.json',manifest);
await storage.persist('monitor-audit-evidence-fixed-clock.sql',manifest.queries.fixedClockEvidence+'\n');
await storage.persist('monitor-audit-replay-storage.mjs',await readFile(resolve(toolDirectory,'storage.mjs'),'utf8'));
const names = [...bundles.flatMap(([,name])=>[name+'.js',name+'.meta.json']),
  'monitor-audit-sql-manifest.json','monitor-audit-evidence-fixed-clock.sql','monitor-audit-replay-storage.mjs'];
const artifacts = [];
for (const file of names) {
  const body=await readFile(resolve(output,file));
  artifacts.push({file,bytes:body.length,sha256:createHash('sha256').update(body).digest('hex'),mode:(await stat(resolve(output,file))).mode&0o777});
}
const metadata = {revision:manifest.revision,readOnly:true,networkAttemptsDuringExtraction:manifest.networkAttemptsDuringExtraction,
  databaseQueryAttemptsDuringExtraction:manifest.databaseQueryAttemptsDuringExtraction,
  sourceCheckout:{root:checkout.root,gitTopLevel:checkout.topLevel,revision:checkout.revision,verifiedSourceCount:checkout.sources.length,
    compiledInputs:checkout.verifySources([...compiledInputs].sort()),bundledSourceFiles},
  recommendedClock:manifest.recommendedClock,artifacts};
checkout.verifyUnchanged();
if(manifest.revision!==checkout.revision)throw new Error('Extracted manifest revision differs from verified source checkout');
await storage.persist('monitor-audit-artifacts.json',metadata);
await storage.persist('generation-status.json',{status:'complete',revision:manifest.revision});
console.log(JSON.stringify({revision:manifest.revision,output,sourceTables:manifest.sourceTables.length,
  networkAttempts:metadata.networkAttemptsDuringExtraction,databaseQueryAttempts:metadata.databaseQueryAttemptsDuringExtraction,artifacts}));
