import { dirname, resolve, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { realpathSync, readFileSync, lstatSync } from 'node:fs';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
export const toolDirectory = dirname(fileURLToPath(import.meta.url));
export const repoRoot = resolve(toolDirectory, '../..');
export const tsxLoader = resolve(repoRoot, 'scripts/node_modules/tsx/dist/loader.mjs');
// These imported frontend data files must be verified before SQL extraction
// imports the bundled-roster adapter. The API source roots cover its TS inputs.
export const bundledRosterFrontendSources = [
  'artifacts/mexico-charts/scripts/artist-profile-routes.mjs',
  'artifacts/mexico-charts/scripts/supplemental-artist-routes.mjs',
];

function checkedGit(root) {
  const locationOverrides=new Set(['GIT_DIR','GIT_WORK_TREE','GIT_COMMON_DIR','GIT_INDEX_FILE','GIT_OBJECT_DIRECTORY',
    'GIT_ALTERNATE_OBJECT_DIRECTORIES','GIT_CEILING_DIRECTORIES','GIT_DISCOVERY_ACROSS_FILESYSTEM','GIT_NAMESPACE','GIT_REPLACE_REF_BASE']);
  const present=Object.keys(process.env).filter(key=>locationOverrides.has(key)||key.startsWith('GIT_CONFIG')).sort();
  if(present.length)throw new Error('Audit generation rejects Git location/configuration overrides: '+present.join(', '));
  return (...args)=>execFileSync('git',['-c','core.fsmonitor=false','-C',root,...args],
    {encoding:'utf8',env:{...process.env,GIT_OPTIONAL_LOCKS:'0',GIT_NO_REPLACE_OBJECTS:'1'},stdio:['ignore','pipe','pipe'],maxBuffer:16*1024*1024});
}

/** Read-only preflight. Parent Git discovery is never evidence of isolation. */
export function verifyAuditCheckout({root=repoRoot,requiredSources=[]}={}) {
  const actualRoot=realpathSync(root),git=checkedGit(actualRoot);
  const topLevel=realpathSync(git('rev-parse','--show-toplevel').trim());
  if(topLevel!==actualRoot)throw new Error('Audit source directory is not its own Git top-level; parent/shared checkout metadata is rejected');
  const marker=resolve(actualRoot,'.git'),markerType=lstatSync(marker);
  if(markerType.isSymbolicLink())throw new Error('Audit checkout cannot share Git metadata through a symlink');
  if(markerType.isFile()) {
    const gitDir=realpathSync(git('rev-parse','--absolute-git-dir').trim());
    let backlink;
    try { backlink=realpathSync(readFileSync(resolve(gitDir,'gitdir'),'utf8').trim()); }
    catch { throw new Error('Audit Git file is not a verified linked-worktree metadata record'); }
    if(backlink!==marker)throw new Error('Linked-worktree Git metadata points to a different worktree');
  } else if(!markerType.isDirectory())throw new Error('Audit checkout requires its own Git metadata or a verified linked worktree');
  const revision=git('rev-parse','HEAD').trim();
  if(git('status','--porcelain=v1','--untracked-files=normal').trim())throw new Error('Audit generation requires a clean committed source checkout');
  const tree=git('ls-tree','-rz','--full-tree','HEAD').split('\0').filter(Boolean).map(record=>{
    const split=record.indexOf('\t'),[mode,type,blob]=record.slice(0,split).split(' ');
    return {path:record.slice(split+1),mode,type,blob};
  });
  const sourceRoots=['artifacts/api-server/src/lib/','lib/db/src/','scripts/monitor-pro-audit-tools/'];
  const paths=[...new Set([...requiredSources,...tree.filter(entry=>sourceRoots.some(prefix=>entry.path.startsWith(prefix)) ||
    /(?:^|\/)tsconfig[^/]*\.json$/.test(entry.path) || ['package.json','scripts/package.json','lib/db/package.json','artifacts/api-server/package.json','pnpm-workspace.yaml'].includes(entry.path)).map(entry=>entry.path)])];
  const objectFormat=git('rev-parse','--show-object-format').trim();
  if(!['sha1','sha256'].includes(objectFormat))throw new Error('Unsupported Git object format for source verification');
  const byPath=new Map(tree.map(entry=>[entry.path,entry]));
  const verifySources=sourcePaths=>sourcePaths.map(path=>{
    const entry=byPath.get(path);
    if(!entry||entry.type!=='blob'||!['100644','100755'].includes(entry.mode))throw new Error('Audit source is not a tracked regular HEAD file: '+path);
    const absolute=resolve(actualRoot,path),real=realpathSync(absolute),rel=relative(actualRoot,real);
    if(rel==='..'||rel.startsWith('..'+sep)||!lstatSync(absolute).isFile())throw new Error('Audit source escapes its verified checkout: '+path);
    const bytes=readFileSync(absolute),blob=createHash(objectFormat).update('blob '+bytes.length+'\0').update(bytes).digest('hex');
    if(blob!==entry.blob)throw new Error('Audit source bytes differ from HEAD: '+path);
    return {path,bytes:bytes.length,gitBlob:blob,sha256:createHash('sha256').update(bytes).digest('hex')};
  });
  const sources=verifySources(paths);
  return {root:actualRoot,topLevel,revision,sources,verifySources,
    verifyUnchanged:()=>{if(git('rev-parse','HEAD').trim()!==revision)throw new Error('Audit source revision changed during generation');verifySources(paths);}};
}
export function esbuildExecutable() {
  const requireTsx = createRequire(realpathSync(resolve(repoRoot, 'scripts/node_modules/tsx/package.json')));
  return requireTsx.resolve('esbuild/bin/esbuild');
}
export function outputArgument(argumentsList = process.argv.slice(2)) {
  if (argumentsList.length !== 2 || argumentsList[0] !== '--output' || !argumentsList[1] || argumentsList[1].startsWith('--')) {
    throw new Error('Usage: node <script> --output <private-artifact-directory>');
  }
  return resolve(argumentsList[1]);
}
/** The SQL extraction subprocess receives no production configuration. */
export function offlineChildEnvironment() {
  const environment = {};
  for (const key of ['PATH', 'TMPDIR', 'TMP', 'TEMP', 'SYSTEMROOT']) if (process.env[key]) environment[key] = process.env[key];
  environment.NEON_DATABASE_URL = 'postgresql://manifest-only.invalid/audit';
  return environment;
}
