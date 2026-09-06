/** Local artifact generation only; no production configuration or connection. */
import crypto from 'node:crypto';
import net from 'node:net';
import {buildJsonChunkSql,canonicalCheckpointJson,md5Utf8,CHECKPOINT_HASH_VERSION} from './replay.mjs';
import {repoRoot,verifyAuditCheckout,bundledRosterFrontendSources} from './paths.mjs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createRequire} from 'node:module';
const checkout=verifyAuditCheckout({requiredSources:bundledRosterFrontendSources});
const revision=checkout.revision;
for(const key of Object.keys(process.env))if(/DATABASE|NEON|^PG/.test(key))delete process.env[key];
process.env.NEON_DATABASE_URL='postgresql://manifest-only.invalid/audit';
let networkAttempts=0;const connect=net.Socket.prototype.connect;
net.Socket.prototype.connect=function(){networkAttempts++;throw new Error('Network is disabled during SQL extraction');};
const requireDatabase=createRequire(resolve(repoRoot,'lib/db/package.json'));
const pg=requireDatabase('pg');
let databaseQueryAttempts=0;
pg.Pool.prototype.query=function(){databaseQueryAttempts++;throw new Error('Database queries are disabled during SQL extraction');};
pg.Pool.prototype.connect=function(){databaseQueryAttempts++;throw new Error('Database connections are disabled during SQL extraction');};
const audit=await import(pathToFileURL(resolve(repoRoot,'artifacts/api-server/src/lib/monitoring-candidate-audit.ts')).href);
const schema=await import(pathToFileURL(resolve(repoRoot,'artifacts/api-server/src/lib/monitoring-audit-schema.ts')).href);
const bundled=await import(pathToFileURL(resolve(repoRoot,'artifacts/api-server/src/lib/monitoring-bundled-roster.ts')).href);
const database=await import(pathToFileURL(resolve(repoRoot,'lib/db/src/index.ts')).href);
const sourceTables=[...schema.MONITORING_AUDIT_SOURCE_TABLES];
const literal=value=>"'"+value.replaceAll("'","''")+"'";
const nowCalls=(audit.MONITORING_CANDIDATE_EVIDENCE_SQL.match(/\bnow\(\)/g)||[]).length;
if(nowCalls!==3)throw new Error('Unexpected evidence clock dependencies');
const queries={
  identityClock:"SELECT current_database() database_name, current_timestamp::text audit_now, current_setting('transaction_read_only') read_only",
  schema:`SELECT name table_name, to_regclass('public.' || name) IS NOT NULL present FROM unnest(ARRAY[${sourceTables.map(literal).join(',')}]::text[]) name ORDER BY name`,
  population:audit.MONITORING_CANDIDATE_POPULATION_SQL,
  acceptedAliases:audit.MONITORING_ACCEPTED_ALIAS_SQL,
  discovery:audit.MONITORING_DISCOVERY_CANDIDATES_SQL,
  evidence:audit.MONITORING_CANDIDATE_EVIDENCE_SQL,
  transactionClockEvidence:`SELECT to_char(transaction_timestamp() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') audit_captured_at, evidence.* FROM (${audit.MONITORING_CANDIDATE_EVIDENCE_SQL}) evidence`,
  fixedClockEvidence:audit.MONITORING_CANDIDATE_EVIDENCE_SQL.replace(/\bnow\(\)/g,'$2::timestamptz').replaceAll("'database_now_America/New_York'","'fixed_audit_now_America/New_York'"),
};
const emptySourceCtes=Object.fromEntries(sourceTables.map(table=>{
  const sql=schema.withUnavailableMonitoringSources('SELECT 1',[table]);
  return [table,sql.slice(5,-' SELECT 1'.length)];
}));
const sha=value=>crypto.createHash('sha256').update(value).digest('hex');
const bundledRows=bundled.getMonitoringBundledRosterRows();
const bundledPopulation={protocol:'monitor-audit-bundled-population-v1',revision,
  rows:bundledRows,rowsHashVersion:CHECKPOINT_HASH_VERSION,rowsMd5:md5Utf8(canonicalCheckpointJson(bundledRows)),
  sourceFiles:checkout.verifySources([...bundled.MONITORING_BUNDLED_ROSTER_SOURCE_PATHS]),
  sourceInventory:bundled.MONITORING_BUNDLED_ROSTER_SOURCE_INVENTORY,
  populationScope:'database_and_bundled_rosters',populationLimitations:bundled.monitoringCandidatePopulationScope([]).populationLimitations};
const manifest={revision,readOnly:true,providerCalls:0,sourceTables,queries,emptySourceCtes,bundledPopulation,
  parameters:{evidence:{'$1::jsonb':'Exactly one [{artist_key,source_keys}] object for heavy evidence capture'},fixedClockEvidence:{'$1::jsonb':'Requested exact candidate source keys','$2::timestamptz':'Same fixed explicit audit clock passed to the evaluator'}},
  recommendedClock:{mode:'evidence_transaction_timestamp',rowField:'audit_captured_at',runClock:'metadata.now is run start only',sqlClock:'transaction_timestamp() equals original now()',defaultTransport:'one full response'},
  fixedClockAdaptation:{replacedNowCalls:nowCalls,timezone:'America/New_York',historyRangeDays:90,lowerBound:'Eastern audit date minus89days',allTimeRetained:true,provenanceLabel:'fixed_audit_now_America/New_York',originalSourceUnmodified:true},
  transport:{protocol:'monitor-audit-json-v1',defaultFullFrameTemplate:buildJsonChunkSql('SELECT __REVIEWED_QUERY_COLUMNS__'),defaultMode:'one_full_response_per_artist',chunkFallbackCharacters:24000},
  querySha256:Object.fromEntries(Object.entries(queries).map(([key,value])=>[key,sha(value)])),networkAttemptsDuringExtraction:networkAttempts,databaseQueryAttemptsDuringExtraction:databaseQueryAttempts};
if(networkAttempts||databaseQueryAttempts)throw new Error('SQL extraction attempted network or database access');
checkout.verifyUnchanged();

await Promise.all(['pool','publicReadPool','monitoringReadPool','youtubeCollectorPool','youtubeCoveragePool'].map(key=>database[key].end()));
net.Socket.prototype.connect=connect;
process.stdout.write(JSON.stringify(manifest)+'\n');
