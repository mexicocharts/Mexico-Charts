import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { realpathSync } from 'node:fs';
import { createRequire } from 'node:module';
export const toolDirectory = dirname(fileURLToPath(import.meta.url));
export const repoRoot = resolve(toolDirectory, '../..');
export const tsxLoader = resolve(repoRoot, 'scripts/node_modules/tsx/dist/loader.mjs');
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
