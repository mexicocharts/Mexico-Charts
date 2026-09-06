/** Pure helpers for the reviewed SQL manifest. Inputs are trusted artifact SQL and data-only identities. */
function check(value,message){if(!value)throw new Error(message);}
const literal=value=>"'"+value.replaceAll("'","''")+"'";
export function applyAuditMissingSources(manifest,sql,missingTables){
  check(Array.isArray(missingTables)&&new Set(missingTables).size===missingTables.length,'Missing-source inventory must be unique');
  const ctes=missingTables.map(table=>{check(Object.hasOwn(manifest.emptySourceCtes,table),'Unknown missing source');return manifest.emptySourceCtes[table];});
  if(!ctes.length)return sql;
  return /^\s*WITH\s/i.test(sql)?sql.replace(/^\s*WITH\s/i,'WITH '+ctes.join(', ')+', '):'WITH '+ctes.join(', ')+' '+sql;
}
export function prepareAuditQueries(manifest,{missingTables,now,clockMode}){
  check(['run_fixed','evidence_transaction_timestamp'].includes(clockMode),'An explicit audit clock mode is required');
  check(typeof now==='string'&&/T.*(?:Z|[+-]\d\d:\d\d)$/.test(now)&&Number.isFinite(new Date(now).getTime()),'Fixed explicit audit clock required');
  const population=applyAuditMissingSources(manifest,manifest.queries.population,missingTables);
  const acceptedAliases=applyAuditMissingSources(manifest,manifest.queries.acceptedAliases,missingTables);
  const discovery=applyAuditMissingSources(manifest,manifest.queries.discovery,missingTables);
  const fixed=applyAuditMissingSources(manifest,clockMode==='run_fixed'?manifest.queries.fixedClockEvidence:manifest.queries.transactionClockEvidence,missingTables);
  check((fixed.match(/\$1::jsonb/g)||[]).length===1&&(fixed.match(/\$2::timestamptz/g)||[]).length===(clockMode==='run_fixed'?manifest.fixedClockAdaptation.replacedNowCalls:0),'Unexpected evidence parameters');
  const sourceCounts=`SELECT (SELECT count(*) FROM (${population}) p) population, (SELECT count(*) FROM (${acceptedAliases}) a) accepted_aliases, (SELECT count(*) FROM (${discovery}) d) discovery`;
  return {population,acceptedAliases,discovery,sourceCounts,
    ...(manifest.bundledPopulation===undefined?{}:{bundledPopulation:manifest.bundledPopulation}),
    evidence:candidate=>{
      check(typeof candidate.artistKey==='string'&&Array.isArray(candidate.sourceKeys)&&candidate.sourceKeys.every(value=>typeof value==='string'),'Exact candidate source keys required');
      const requested=JSON.stringify([{artist_key:candidate.artistKey,source_keys:candidate.sourceKeys}]);
      return fixed.replace('$1::jsonb',literal(requested)+'::jsonb').replaceAll('$2::timestamptz',literal(now)+'::timestamptz');
    },
  };
}

/** Population-only identity inputs. Evidence SQL and revision may evolve independently. */
export function populationManifestInputs(manifest,missingTables=[]) {
  check(manifest?.readOnly===true&&manifest.providerCalls===0&&Array.isArray(manifest.sourceTables), 'Reviewed population manifest required');
  check(new Set(manifest.sourceTables).size===manifest.sourceTables.length&&missingTables.every(table=>manifest.sourceTables.includes(table)), 'Population source inventory mismatch');
  const names=['population','acceptedAliases','discovery'];
  check(names.every(name=>typeof manifest.queries?.[name]==='string'),'Complete population SQL inputs required');
  const queries=Object.fromEntries(names.map(name=>[name,manifest.queries[name]]));
  const prepared=Object.fromEntries(names.map(name=>[name,applyAuditMissingSources(manifest,queries[name],missingTables)]));
  // All source inventory/typed schema substitutions are retained, including unneeded
  // empty CTEs: a changed schema inventory is not an inherited fresh inspection.
  const {revision,...bundled}=manifest.bundledPopulation??{};
  check(typeof manifest.queries.schema==='string','Original schema inventory SQL required');
  const sourceCounts=`SELECT (SELECT count(*) FROM (${prepared.population}) p) population, (SELECT count(*) FROM (${prepared.acceptedAliases}) a) accepted_aliases, (SELECT count(*) FROM (${prepared.discovery}) d) discovery`;
  return {schemaSql:manifest.queries.schema,sourceCounts,sourceTables:manifest.sourceTables,emptySourceCtes:manifest.emptySourceCtes,missingTables,
    queries,prepared,bundledPopulation:manifest.bundledPopulation===undefined?null:bundled};
}
