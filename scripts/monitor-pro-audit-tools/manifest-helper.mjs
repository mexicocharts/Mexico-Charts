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
    evidence:candidate=>{
      check(typeof candidate.artistKey==='string'&&Array.isArray(candidate.sourceKeys)&&candidate.sourceKeys.every(value=>typeof value==='string'),'Exact candidate source keys required');
      const requested=JSON.stringify([{artist_key:candidate.artistKey,source_keys:candidate.sourceKeys}]);
      return fixed.replace('$1::jsonb',literal(requested)+'::jsonb').replaceAll('$2::timestamptz',literal(now)+'::timestamptz');
    },
  };
}
