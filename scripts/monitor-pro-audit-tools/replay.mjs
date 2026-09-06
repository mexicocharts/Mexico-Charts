/** Private read-only orchestration helpers. No database, filesystem, network, or wall-clock initialization. */
const PROTOCOL = 'monitor-audit-json-v1';
const COLUMNS = ['protocol', 'total_rows', 'payload_chars', 'payload_md5', 'chunk_start', 'chunk_chars', 'chunk'];
function requireValue(condition, message) { if (!condition) throw new Error(message); }
const plain = value => value !== null && typeof value === 'object' && !Array.isArray(value);
export const CHECKPOINT_HASH_VERSION = 'json_sorted_object_keys_v1';
/** Internal JSON equality only. Raw PostgreSQL payload strings are never changed. */
export function canonicalCheckpointJson(value) {
  if(value === null || typeof value === 'string' || typeof value === 'boolean')return JSON.stringify(value);
  if(typeof value === 'number'){requireValue(Number.isFinite(value),'Checkpoint numbers must be finite');return JSON.stringify(value);}
  if(Array.isArray(value))return '['+Array.from(value,canonicalCheckpointJson).join(',')+']';
  requireValue(plain(value)&&Object.prototype.toString.call(value)==='[object Object]','Checkpoint values must be JSON-compatible');
  return '{'+Object.keys(value).filter(key=>value[key]!==undefined).sort()
    .map(key=>JSON.stringify(key)+':'+canonicalCheckpointJson(value[key])).join(',')+'}';
}
const serialize = canonicalCheckpointJson;
const checkpointMd5 = value => md5Utf8(serialize(value));

/** Strict RFC4180 cells, including embedded CRLF/newlines and doubled quotes. */
export function parseRfc4180Csv(text) {
  requireValue(typeof text === 'string', 'CSV output must be a string');
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  const rows = []; let row = [], cell = '', state = 'start', ended = false;
  for (let index = 0; index < text.length; index++) {
    const value = text[index]; ended = false;
    if (state === 'quoted') {
      if (value === '"') { if (text[index + 1] === '"') { cell += '"'; index++; } else state = 'closed'; }
      else cell += value;
      continue;
    }
    if (value === ',' || value === '\n' || value === '\r') {
      row.push(cell); cell = ''; state = 'start';
      if (value !== ',') {
        if (value === '\r') { requireValue(text[index + 1] === '\n', 'Bare CR outside a quoted CSV cell'); index++; }
        rows.push(row); row = []; ended = true;
      }
      continue;
    }
    requireValue(state !== 'closed', 'Unexpected data after closing CSV quote');
    if (value === '"') { requireValue(state === 'start', 'Unexpected quote in unquoted CSV cell'); state = 'quoted'; }
    else { cell += value; state = 'unquoted'; }
  }
  requireValue(state !== 'quoted', 'Truncated quoted CSV cell');
  if (!ended && (text.length || row.length || cell.length)) { row.push(cell); rows.push(row); }
  if (!rows.length) return [];
  requireValue(rows.every(value => value.length === rows[0].length), 'CSV row width differs from header');
  return rows;
}

export function decodeReplitCsv(raw, { expectedColumns, expectedRows, jsonColumns = {} } = {}) {
  requireValue(plain(raw) && raw.success === true && raw.exitCode === 0 && raw.exitReason === null,
    'SQL tool did not report successful completion');
  requireValue(raw.truncated !== true && raw.isTruncated !== true && raw.isError !== true,
    'SQL tool output is truncated or erroneous');
  const records = parseRfc4180Csv(raw.output);
  requireValue(records.length > 0, 'SQL result has no CSV header');
  const [columns, ...values] = records;
  requireValue(columns.every(value => value.length > 0) && new Set(columns).size === columns.length, 'Invalid or duplicate CSV header');
  if (expectedColumns) requireValue(serialize(columns) === serialize(expectedColumns), 'Unexpected SQL result columns');
  if (expectedRows !== undefined) requireValue(values.length === expectedRows, 'Unexpected or truncated SQL row count');
  return values.map(value => Object.fromEntries(columns.map((column, index) => {
    const cell = value[index];
    if (!Object.hasOwn(jsonColumns, column)) return [column, cell];
    let decoded; try { decoded = JSON.parse(cell); } catch { throw new Error(`Invalid or truncated JSON column: ${column}`); }
    const kind = jsonColumns[column];
    requireValue(kind !== 'array' || Array.isArray(decoded), `JSON column must be an array: ${column}`);
    requireValue(kind !== 'object' || plain(decoded), `JSON column must be an object: ${column}`);
    return [column, decoded];
  })));
}

function utf8(value) {
  const bytes = [];
  for (const character of value) {
    let cp = character.codePointAt(0);
    if (cp >= 0xd800 && cp <= 0xdfff) cp = 0xfffd;
    if (cp < 0x80) bytes.push(cp);
    else if (cp < 0x800) bytes.push(0xc0 | cp >>> 6, 0x80 | cp & 63);
    else if (cp < 0x10000) bytes.push(0xe0 | cp >>> 12, 0x80 | cp >>> 6 & 63, 0x80 | cp & 63);
    else bytes.push(0xf0 | cp >>> 18, 0x80 | cp >>> 12 & 63, 0x80 | cp >>> 6 & 63, 0x80 | cp & 63);
  }
  return bytes;
}
/** PostgreSQL md5(text) compatibility without Buffer, TextEncoder or crypto globals. */
export function md5Utf8(text) {
  const bytes = utf8(text), size = bytes.length, low = (size * 8) >>> 0, high = Math.floor(size / 0x20000000);
  bytes.push(0x80); while (bytes.length % 64 !== 56) bytes.push(0);
  for (const half of [low, high]) for (let shift = 0; shift < 32; shift += 8) bytes.push(half >>> shift & 255);
  let a0 = 0x67452301, b0 = 0xefcdab89, c0 = 0x98badcfe, d0 = 0x10325476;
  const shifts = [7,12,17,22,5,9,14,20,4,11,16,23,6,10,15,21];
  for (let offset = 0; offset < bytes.length; offset += 64) {
    const words = Array.from({length:16}, (_, index) => {
      const p = offset + index * 4; return bytes[p] | bytes[p+1] << 8 | bytes[p+2] << 16 | bytes[p+3] << 24;
    });
    let a = a0, b = b0, c = c0, d = d0;
    for (let index = 0; index < 64; index++) {
      const round = index >>> 4;
      const f = round === 0 ? b & c | ~b & d : round === 1 ? d & b | ~d & c : round === 2 ? b ^ c ^ d : c ^ (b | ~d);
      const g = round === 0 ? index : round === 1 ? (5 * index + 1) % 16 : round === 2 ? (3 * index + 5) % 16 : 7 * index % 16;
      const sum = a + f + words[g] + Math.floor(Math.abs(Math.sin(index + 1)) * 0x100000000) | 0;
      const shift = shifts[round * 4 + index % 4];
      [a, b, c, d] = [d, b + (sum << shift | sum >>> 32 - shift) | 0, b, c];
    }
    a0 = a0 + a | 0; b0 = b0 + b | 0; c0 = c0 + c | 0; d0 = d0 + d | 0;
  }
  return [a0,b0,c0,d0].flatMap(value => [0,8,16,24].map(shift => (value >>> shift & 255).toString(16).padStart(2,'0'))).join('');
}

export function buildJsonChunkSql(reviewedSelect, start = 1, size = null, {canonicalRowOrder = false} = {}) {
  requireValue(typeof reviewedSelect === 'string' && /^\s*(SELECT|WITH)\b/i.test(reviewedSelect), 'A reviewed read-only SELECT is required');
  requireValue(Number.isSafeInteger(start) && start >= 1 && (size === null ? start === 1 : Number.isSafeInteger(size) && size >= 1 && size <= 100000), 'Invalid bounded chunk range');
  const sql = reviewedSelect.trim().replace(/;\s*$/, '');
  const part = size === null ? 'payload' : `substring(payload FROM ${start} FOR ${size})`;
  const order = canonicalRowOrder ? ' ORDER BY to_jsonb(monitor_replay_rows)::text COLLATE "C"' : '';
  // The caller supplies trusted, reviewed SQL. This wrapper is not a SQL parser or authorization boundary.
  return `SELECT * FROM (WITH monitor_replay_rows AS MATERIALIZED (${sql}), monitor_replay_payload AS (
    SELECT count(*) AS total_rows, COALESCE(jsonb_agg(to_jsonb(monitor_replay_rows)${order}), '[]'::jsonb)::text AS payload FROM monitor_replay_rows
  ) SELECT '${PROTOCOL}' AS protocol, total_rows, length(payload) AS payload_chars, md5(payload) AS payload_md5,
    ${start} AS chunk_start, length(${part}) AS chunk_chars,
    ${part} AS chunk FROM monitor_replay_payload) AS monitor_audit_frame`;
}
function integer(value, name) {
  requireValue(typeof value === 'string' && /^\d+$/.test(value) && Number.isSafeInteger(Number(value)), `Invalid frame ${name}`);
  return Number(value);
}
function safeId(value) { requireValue(typeof value === 'string' && /^[A-Za-z0-9_-]+$/.test(value), 'Unsafe artifact ID'); return value; }
function quoteCsv(value) { return '"' + String(value ?? '').replaceAll('"', '""') + '"'; }
export function reportCsv(report) {
  const columns = ['artistKey','artistName','classification','auditStatus','publicEligible','readinessReasons','resultArtifact'];
  return [columns.join(','), ...report.artists.map(artist => columns.map(column => quoteCsv(column === 'readinessReasons' ? serialize(artist[column]) : artist[column])).join(','))].join('\r\n') + '\r\n';
}

/** Caller persist/read MUST access durable private storage, never only an isolate store or remote /tmp.
 * persist(key, JSON-compatible value) resolves only after durable replacement succeeds.
 * read(key) returns that value or null. execute(sql, context) is the existing SELECT-only tool.
 */
export function createAuditReplay({ evaluator, metadata, execute, persist, read, chunkSize = 24000,
  failedToolRetries = 0, replayImplementation = null }) {
  requireValue(plain(evaluator) && typeof evaluator.groupMonitoringCandidateIdentities === 'function' && typeof evaluator.evaluateMonitoringCandidate === 'function', 'Pure evaluator is required');
  requireValue(plain(metadata) && ['runId','revision','sourceHash','evaluatorHash','now'].every(key => typeof metadata[key] === 'string' && metadata[key]), 'Explicit run/revision/source/evaluator/clock metadata is required');
  safeId(metadata.runId);
  requireValue(['run_fixed','evidence_transaction_timestamp'].includes(metadata.clockMode), 'An explicit audit clock mode is required');
  requireValue(/T.*(?:Z|[+-]\d\d:\d\d)$/.test(metadata.now) && Number.isFinite(new Date(metadata.now).getTime()), 'A fixed explicit timezone-bearing audit clock is required');
  requireValue([execute,persist,read].every(value => typeof value === 'function'), 'Caller execution and durable persistence functions are required');
  requireValue(Number.isSafeInteger(failedToolRetries) && failedToolRetries >= 0 && failedToolRetries <= 3, 'Failed-tool retries must be explicitly bounded to 0..3');
  requireValue(!failedToolRetries || (plain(replayImplementation) && /^[0-9a-f]{40}$/.test(replayImplementation.revision ?? '') &&
    /^[0-9a-f]{64}$/.test(replayImplementation.sha256 ?? '')), 'Explicit reviewed replay implementation revision and SHA256 are required for retries');
  const prefix = metadata.runId + '/';
  let manifestChecked = false;
  async function manifest() {
    if (manifestChecked) return;
    const existing = await read(prefix + 'manifest.json');
    if (existing !== null && existing !== undefined) requireValue(serialize(existing) === serialize(metadata), 'Checkpoint metadata does not match this run');
    else await persist(prefix + 'manifest.json', metadata);
    if (failedToolRetries) {
      const key=prefix+'replay-implementations/'+replayImplementation.sha256+'.retries-'+failedToolRetries+'.json';
      const implementation={revision:replayImplementation.revision,sha256:replayImplementation.sha256,
        originalReplayHash:metadata.replayHash ?? null,sourceHash:metadata.sourceHash,evaluatorHash:metadata.evaluatorHash,
        failedToolRetries,checkpointHashVersion:CHECKPOINT_HASH_VERSION,
        scope:'explicit_failed_envelope_retries_and_verified_canonical_recovery',requiredSourceQueryPolicy:'byte_identical_saved_request'};
      const previous=await read(key);
      if(previous != null) requireValue(serialize(previous) === serialize(implementation), 'Replay implementation checkpoint mismatch');
      else await persist(key,implementation);
    }
    manifestChecked = true;
  }
  const failedToolEnvelope = value => plain(value) && value.success === false && Number.isSafeInteger(value.exitCode) && value.exitCode !== 0 &&
    (value.exitReason === null || typeof value.exitReason === 'string') && typeof value.output === 'string' &&
    value.truncated !== true && value.isTruncated !== true;
  const transportFields=['method','protocol','sourceSqlMd5','validated','totalRows','payloadMd5','payloadCharacters','chunkCount','characterUnit','rowOrder'];
  function verifySavedCapture(prior, captured) {
    requireValue(prior.payloadMd5===captured.payloadMd5 && prior.payloadCharacters===captured.payloadCharacters &&
      prior.transportProof?.validated===true && transportFields.every(key=>prior.transportProof[key]===captured.transportProof[key]),
      'Saved checkpoint full-source proof mismatch');
    if(prior.transportProof.rawAttempts)requireValue(serialize(prior.transportProof.rawAttempts)===serialize(captured.transportProof.rawAttempts),'Saved checkpoint raw attempt proof mismatch');
    const expected=prior.normalizedRowsHashVersion===CHECKPOINT_HASH_VERSION ? checkpointMd5(captured.rows) : md5Utf8(JSON.stringify(captured.rows));
    requireValue(prior.normalizedRowsHashVersion===undefined || prior.normalizedRowsHashVersion===CHECKPOINT_HASH_VERSION,'Unknown checkpoint hash version');
    requireValue(expected===prior.normalizedRowsMd5,'Original raw rows do not reproduce the saved normalized checksum');
    requireValue(serialize(prior.rows)===serialize(captured.rows),'Decoded checkpoint differs substantively from original raw rows');
  }
  async function captureRows({ id, sql, expectedRows, chunked = false, canonicalRowOrder = false }, existingOnly = false) {
    await manifest(); safeId(id);
    requireValue(Number.isSafeInteger(expectedRows) && expectedRows >= 0, 'An independently established expected row count is required');
    const decodedKey = prefix + 'decoded/' + id + '.json';
    const prior = await read(decodedKey);
    if (prior != null) {
      requireValue(prior.sql === sql && prior.expectedRows === expectedRows &&
        (prior.canonicalRowOrder ?? false) === canonicalRowOrder && (prior.captureMode ?? 'whole') === (chunked ? 'chunks' : 'whole') &&
        Array.isArray(prior.rows) && prior.rows.length === expectedRows, 'Decoded checkpoint request mismatch');
      if(prior.normalizedRowsHashVersion===CHECKPOINT_HASH_VERSION){
        requireValue(checkpointMd5(prior.rows) === prior.normalizedRowsMd5, 'Decoded checkpoint checksum mismatch');
        return prior.rows;
      }
      requireValue(prior.normalizedRowsHashVersion===undefined,'Unknown checkpoint hash version');
      const canonicalKey=prefix+'canonical-checkpoints/'+CHECKPOINT_HASH_VERSION+'/decoded/'+id+'.json';
      const recovered=await read(canonicalKey);
      if(recovered!=null){
        const {recoveryProofMd5,...body}=recovered;
        requireValue(checkpointMd5(body)===recoveryProofMd5 && recovered.legacyRecovery?.sourceArtifact===decodedKey &&
          recovered.legacyRecovery?.sourceCheckpointMd5===checkpointMd5(prior) &&
          recovered.normalizedRowsHashVersion===CHECKPOINT_HASH_VERSION && checkpointMd5(recovered.rows)===recovered.normalizedRowsMd5 &&
          serialize(recovered.rows)===serialize(prior.rows),'Canonical recovery checkpoint mismatch');
        return recovered.rows;
      }
      const captured=await captureRawRows({id,sql,expectedRows,chunked,canonicalRowOrder},prior);
      verifySavedCapture(prior,captured);
      const body={...captured,legacyRecovery:{sourceArtifact:decodedKey,sourceCheckpointMd5:checkpointMd5(prior),
        originalNormalizedRowsMd5:prior.normalizedRowsMd5,originalHashMethod:'json_stringify_insertion_order',rawVerification:'complete_original_frames'}};
      await persist(canonicalKey,{...body,recoveryProofMd5:checkpointMd5(body)});
      return captured.rows;
    }
    requireValue(!existingOnly,'Legacy recovery requires the saved decoded source checkpoint');
    const captured=await captureRawRows({id,sql,expectedRows,chunked,canonicalRowOrder});
    await persist(decodedKey,captured);
    return captured.rows;
  }
  async function captureRawRows({id,sql,expectedRows,chunked,canonicalRowOrder}, recovery=null) {
    const pieces = [], rawAttempts = []; let start = 1, identity = null;
    while (true) {
      const requestSql = buildJsonChunkSql(sql, start, chunked ? chunkSize : null, {canonicalRowOrder});
      const rawBase = prefix + 'raw/' + id + '/' + (chunked ? start : 'full');
      let saved;
      const attemptLimit=recovery ? Math.max(0,...(recovery.transportProof?.rawAttempts??[]).filter(value=>value.chunkStart===start).map(value=>value.attempt)) : failedToolRetries;
      requireValue(Number.isSafeInteger(attemptLimit)&&attemptLimit>=0&&attemptLimit<=3,'Invalid saved raw retry proof');
      for(let attempt=0;attempt<=attemptLimit;attempt++) {
        const rawKey=rawBase+(attempt?'.retry-'+attempt:'')+'.json';
        saved=await read(rawKey);
        if(saved == null) {
          requireValue(recovery===null,'Legacy checkpoint recovery requires complete saved raw frames; no SQL is permitted');
          const rawResult = await execute(requestSql, { id, chunkStart:start, chunkSize:chunked ? chunkSize : null, attempt });
          saved = { id, sql:requestSql, rawResult, ...(attempt ? {retryOf:rawBase+'.json',attempt} : {}) };
          await persist(rawKey, saved); // Each attempt is durable before status checks, decoding or evaluation.
        }
        requireValue(saved.id === id && saved.sql === requestSql && (!attempt || (saved.retryOf === rawBase+'.json' && saved.attempt === attempt)), 'Raw checkpoint request mismatch');
        const failed=failedToolEnvelope(saved.rawResult);
        rawAttempts.push({artifact:rawKey,chunkStart:start,attempt,outcome:failed?'failed_tool_envelope':'returned_envelope'});
        if(!failed || attempt===attemptLimit)break;
      }
      const [frame] = decodeReplitCsv(saved.rawResult, { expectedColumns:COLUMNS, expectedRows:1 });
      requireValue(frame.protocol === PROTOCOL && /^[0-9a-f]{32}$/.test(frame.payload_md5), 'Invalid SQL transport frame');
      const totalRows = integer(frame.total_rows, 'total_rows'), chars = integer(frame.payload_chars, 'payload_chars');
      const chunkStart = integer(frame.chunk_start, 'chunk_start'), chunkChars = integer(frame.chunk_chars, 'chunk_chars');
      requireValue(totalRows === expectedRows && chars >= 2, 'SQL frame row count mismatch');
      requireValue(chunkStart === start && chunkChars === Array.from(frame.chunk).length && chunkChars === (chunked ? Math.min(chunkSize, chars - start + 1) : chars), 'Truncated, overlapping, or missing payload chunk');
      const nextIdentity = serialize([totalRows, chars, frame.payload_md5]);
      if (identity !== null) requireValue(identity === nextIdentity, 'Evidence changed between chunks; retain raw artifacts and retry using a new query ID');
      identity = nextIdentity; pieces.push(frame.chunk); start += chunkChars;
      if (start > chars) {
        const payload = pieces.join('');
        requireValue(Array.from(payload).length === chars && md5Utf8(payload) === frame.payload_md5, 'Payload checksum mismatch');
        let rows; try { rows = JSON.parse(payload); } catch { throw new Error('Invalid or truncated framed JSON payload'); }
        requireValue(Array.isArray(rows) && rows.length === expectedRows && rows.every(plain), 'Framed payload must contain the exact expected object rows');
        const transportProof = { method:chunked ? 'full_source_content_digest_chunks' : 'single_full_source_frame',
          protocol:PROTOCOL, sourceSqlMd5:md5Utf8(sql), validated:true, totalRows, payloadMd5:frame.payload_md5, payloadCharacters:chars, chunkCount:pieces.length,
          characterUnit:'postgresql_unicode_characters', rowOrder:canonicalRowOrder ? 'jsonb_text_C' : 'source_query',
          rawAttempts,attemptCount:rawAttempts.length,failedAttemptCount:rawAttempts.filter(attempt=>attempt.outcome==='failed_tool_envelope').length,
          replayImplementation:recovery ? recovery.transportProof?.replayImplementation??null : failedToolRetries ? replayImplementation : null };
        return { sql, expectedRows, rows, canonicalRowOrder, captureMode:chunked ? 'chunks' : 'whole',
          normalizedRowsHashVersion:CHECKPOINT_HASH_VERSION,normalizedRowsMd5:checkpointMd5(rows),payloadMd5:frame.payload_md5,payloadCharacters:chars,transportProof };
      }
    }
  }
  async function collectPopulation({ sources, missingSchemaTables = [] }) {
    requireValue(Array.isArray(sources) && sources.length > 0 && new Set(sources.map(source => source.id)).size === sources.length, 'Unique complete population source plans are required');
    const priorPopulation=await read(prefix+'population.json');
    const rows = [], pages = [];
    for (const source of sources) {
      safeId(source.id);
      requireValue(Number.isSafeInteger(source.totalRows) && source.totalRows >= 0 &&
        (['whole','digest_chunks'].includes(source.capture) ? typeof source.selectAll === 'function' : typeof source.selectPage === 'function'), 'Each source needs its verified total and reviewed SELECT');
      if (['whole','digest_chunks'].includes(source.capture)) {
        const chunked=source.capture==='digest_chunks', id=source.id+(chunked?'_digest_chunks':'_whole');
        const values=await captureRows({id,sql:source.selectAll(),expectedRows:source.totalRows,chunked,canonicalRowOrder:chunked});
        const decoded=await read(prefix+'decoded/'+id+'.json');
        requireValue(decoded?.transportProof?.validated === true && decoded.transportProof.totalRows === values.length &&
          (!chunked || decoded.transportProof.rowOrder === 'jsonb_text_C'), 'Population requires validated full-source content proof');
        rows.push(...values);pages.push({id,source:source.id,offset:0,rows:values.length,immutableSourceFrame:!chunked,consistentSourceContent:true,contentProof:decoded.transportProof});
        continue;
      }
      const size = source.pageSize ?? 250;
      requireValue(Number.isSafeInteger(size) && size >= 1 && size <= 1000, 'Population page size must be 1..1000');
      for (let offset = 0; offset < source.totalRows || offset === 0; offset += size) {
        const expectedRows = Math.min(size, source.totalRows - offset);
        const id = source.id + '_' + offset;
        const values = await captureRows({id,sql:source.selectPage({offset,limit:size}),expectedRows});
        rows.push(...values); pages.push({id,source:source.id,offset,rows:values.length});
        if (!source.totalRows) break;
      }
    }
    const candidates = evaluator.groupMonitoringCandidateIdentities(rows);
    requireValue(new Set(candidates.map(value => value.artistKey)).size === candidates.length, 'Grouped candidate keys are not unique');
    const population = { metadata, sourcePlans:sources.map(({id,totalRows,pageSize,capture}) => ({id,totalRows,pageSize:pageSize ?? 250,capture:capture ?? 'paged'})), rawRows:rows.length,
      missingSchemaTables, sourceSnapshotScope:'independent_source_contents', populationComplete:missingSchemaTables.length === 0 && sources.every(source=>['whole','digest_chunks'].includes(source.capture)),
      populationLimitations:sources.some(source=>!['whole','digest_chunks'].includes(source.capture))?['paged_selects_without_shared_snapshot']:[], pages, candidates };
    if(priorPopulation!=null){
      requireValue(serialize(priorPopulation)===serialize(population),'Existing population checkpoint differs from reconstructed source contents; use a new run');
      return priorPopulation;
    }
    await persist(prefix + 'population.json', population);
    return population;
  }
  async function legacyPopulationProof(population) {
    const sourceCheckpointMd5=checkpointMd5(population);
    const key=prefix+'canonical-checkpoints/'+CHECKPOINT_HASH_VERSION+'/population/'+sourceCheckpointMd5+'.json';
    const prior=await read(key);
    if(prior!=null){
      const {recoveryProofMd5,...body}=prior;
      requireValue(checkpointMd5(body)===recoveryProofMd5 && prior.sourceCheckpointMd5===sourceCheckpointMd5 &&
        prior.hashVersion===CHECKPOINT_HASH_VERSION && prior.candidatesCanonicalMd5===checkpointMd5(population.candidates) &&
        prior.candidateLegacyMd5s?.length===population.candidates.length,'Legacy population recovery proof mismatch');
      return prior;
    }
    requireValue(Array.isArray(population.pages)&&population.pages.length>0,'Legacy candidate/report recovery requires original population source frames');
    const rows=[],sources=[],ids=new Set();
    for(const page of population.pages){
      safeId(page.id);requireValue(!ids.has(page.id),'Duplicate legacy population source checkpoint');ids.add(page.id);
      const artifact=prefix+'decoded/'+page.id+'.json',saved=await read(artifact);
      requireValue(saved!=null&&Array.isArray(saved.rows)&&saved.expectedRows===page.rows&&saved.rows.length===page.rows,'Missing or mismatched legacy population source checkpoint');
      const captured=await captureRawRows({id:page.id,sql:saved.sql,expectedRows:saved.expectedRows,
        chunked:saved.captureMode==='chunks',canonicalRowOrder:saved.canonicalRowOrder??false},saved);
      verifySavedCapture(saved,captured);
      if(page.contentProof)requireValue(transportFields.every(field=>page.contentProof[field]===captured.transportProof[field]),'Legacy population source proof mismatch');
      rows.push(...captured.rows);sources.push({artifact,rawProof:captured.transportProof});
    }
    requireValue(rows.length===population.rawRows,'Legacy population raw source count mismatch');
    const candidates=evaluator.groupMonitoringCandidateIdentities(rows);
    requireValue(serialize(candidates)===serialize(population.candidates),'Legacy population differs substantively from verified raw sources');
    const body={hashVersion:CHECKPOINT_HASH_VERSION,sourceArtifact:prefix+'population.json',sourceCheckpointMd5,
      candidatesCanonicalMd5:checkpointMd5(candidates),populationLegacyMd5:md5Utf8(JSON.stringify(candidates)),
      candidateLegacyMd5s:candidates.map(value=>md5Utf8(JSON.stringify(value))),sources};
    const proof={...body,recoveryProofMd5:checkpointMd5(body)};await persist(key,proof);return proof;
  }
  async function auditNext({ population, evidenceSql, maximumArtists = 1, chunkedArtistKeys = [] }) {
    await manifest();
    requireValue(plain(population) && serialize(population.metadata) === serialize(metadata) && Array.isArray(population.candidates), 'This run requires its durable complete population checkpoint');
    requireValue(typeof evidenceSql === 'function' && Number.isSafeInteger(maximumArtists) && maximumArtists >= 1 && maximumArtists <= 25, 'Bounded sequential evidence plan required');
    requireValue(metadata.clockMode !== 'evidence_transaction_timestamp' || chunkedArtistKeys.length === 0, 'Transaction-clock captures require one full response; repeated chunks would change the capture timestamp');
    const populationMd5 = checkpointMd5(population.candidates);
    let legacyProof;
    const getLegacyProof=()=>legacyProof??=(legacyPopulationProof(population));
    const summaryRow=(saved,key)=>({artistKey:saved.result.artistKey,artistName:saved.result.artistName,classification:saved.result.classification,auditStatus:saved.result.auditStatus,
      publicEligible:saved.result.publicEligible,readinessReasons:saved.result.readinessReasons,resultArtifact:key});
    const decisionFor=(candidate,row)=>{
      requireValue(row.artist_key===candidate.artistKey,'Evidence returned a different artist key');
      const decisionClock=metadata.clockMode==='evidence_transaction_timestamp'?row.audit_captured_at:metadata.now;
      requireValue(typeof decisionClock==='string'&&/T.*(?:Z|[+-]\d\d:\d\d)$/.test(decisionClock)&&Number.isFinite(new Date(decisionClock).getTime()),'Missing or invalid explicit evidence capture clock');
      const result=evaluator.evaluateMonitoringCandidate(candidate,{...row,missing_schema_tables:population.missingSchemaTables},new Date(decisionClock));
      requireValue(result.artistKey===candidate.artistKey&&result.auditedAt===new Date(decisionClock).toISOString(),'Evaluator returned inconsistent identity or clock');return result;
    };
    const checkedResult=async(index,candidate)=>{
      const key=prefix+'results/'+index+'.json',saved=await read(key);
      if(saved==null)return null;
      requireValue(saved.artistKey===candidate.artistKey,'Result checkpoint candidate mismatch');
      if(saved.candidateHashVersion===CHECKPOINT_HASH_VERSION){
        requireValue(saved.candidateMd5===checkpointMd5(candidate)&&saved.resultMd5===checkpointMd5(saved.result),'Result checkpoint candidate or result checksum mismatch');return saved;
      }
      requireValue(saved.candidateHashVersion===undefined,'Unknown result checkpoint hash version');
      requireValue(saved.candidateMd5===(await getLegacyProof()).candidateLegacyMd5s[index],'Legacy result candidate checksum mismatch');
      const canonicalKey=prefix+'canonical-checkpoints/'+CHECKPOINT_HASH_VERSION+'/results/'+index+'.json';
      const cached=await read(canonicalKey);
      if(cached!=null){
        const {recoveryProofMd5,...body}=cached;
        requireValue(checkpointMd5(body)===recoveryProofMd5&&cached.legacyRecovery?.sourceCheckpointMd5===checkpointMd5(saved)&&
          cached.candidateMd5===checkpointMd5(candidate)&&cached.resultMd5===checkpointMd5(saved.result),'Canonical result recovery mismatch');return cached;
      }
      const id='evidence_'+index+(saved.evidenceArtifact===prefix+'decoded/evidence_'+index+'_chunks.json'?'_chunks':'');
      requireValue(saved.evidenceArtifact===prefix+'decoded/'+id+'.json','Legacy result evidence artifact mismatch');
      const chunked=id.endsWith('_chunks');requireValue(metadata.clockMode!=='evidence_transaction_timestamp'||!chunked,'Transaction-clock captures require one full response');
      const rows=await captureRows({id,sql:evidenceSql(candidate),expectedRows:1,chunked},true);
      const result=decisionFor(candidate,rows[0]);requireValue(serialize(result)===serialize(saved.result),'Legacy result differs from verified original evidence evaluation');
      const body={...saved,candidateHashVersion:CHECKPOINT_HASH_VERSION,candidateMd5:checkpointMd5(candidate),resultMd5:checkpointMd5(result),
        legacyRecovery:{sourceArtifact:key,sourceCheckpointMd5:checkpointMd5(saved),rawVerification:'complete_original_evidence_and_population'}};
      const recovered={...body,recoveryProofMd5:checkpointMd5(body)};await persist(canonicalKey,recovered);return recovered;
    };
    const migratedReportKey=prefix+'canonical-checkpoints/'+CHECKPOINT_HASH_VERSION+'/report.json';
    const migratedReport=await read(migratedReportKey);
    const priorReport = migratedReport??await read(prefix+'report.json');
    const legacyReport=priorReport!=null&&priorReport.populationHashVersion===undefined;
    const reportKey=migratedReport!=null||legacyReport?migratedReportKey:prefix+'report.json';
    if (priorReport != null) {
      requireValue(serialize(priorReport.metadata)===serialize(metadata)&&Array.isArray(priorReport.artists),'Report checkpoint population or metadata mismatch');
      requireValue(priorReport.artists.every((row,index) => row.artistKey === population.candidates[index]?.artistKey), 'Report checkpoint is not a contiguous unique candidate prefix');
      if(legacyReport){
        requireValue(priorReport.populationMd5===(await getLegacyProof()).populationLegacyMd5,'Legacy report population checksum mismatch');
        for(let index=0;index<priorReport.artists.length;index++){
          const saved=await checkedResult(index,population.candidates[index]);
          requireValue(saved!=null&&serialize(priorReport.artists[index])===serialize(summaryRow(saved,prefix+'results/'+index+'.json')),'Legacy report differs from verified saved results');
        }
      }else requireValue(priorReport.populationHashVersion===CHECKPOINT_HASH_VERSION&&priorReport.populationMd5===populationMd5&&
        priorReport.artistsMd5===checkpointMd5(priorReport.artists),'Report checkpoint population or artist checksum mismatch');
    }
    const report = { metadata, populationHashVersion:CHECKPOINT_HASH_VERSION,populationMd5,checkpointArtifact:reportKey,
      ...(legacyReport?{legacyRecovery:{sourceArtifact:prefix+'report.json',sourceCheckpointMd5:checkpointMd5(priorReport)}}:migratedReport?.legacyRecovery?{legacyRecovery:migratedReport.legacyRecovery}:{}),
      totalCandidates:population.candidates.length, populationComplete:population.populationComplete,
      counts:{A:0,B:0,C:0,unclassified:0,incompleteEvidence:0}, candidatesAudited:0, auditComplete:false, status:'in_progress', artists:priorReport?.artists.slice() ?? [] };
    const previousCount = report.artists.length;
    for (let index = previousCount; index < population.candidates.length && index < previousCount + maximumArtists; index++) {
      const candidate = population.candidates[index], key = prefix + 'results/' + index + '.json';
      let saved = await checkedResult(index,candidate);
      if (saved == null) {
        const chunked = chunkedArtistKeys.includes(candidate.artistKey);
        const id = 'evidence_' + index + (chunked ? '_chunks' : '');
        const rows = await captureRows({id,sql:evidenceSql(candidate),expectedRows:1,chunked});
        const result=decisionFor(candidate,rows[0]);
        saved = {artistKey:candidate.artistKey,candidateHashVersion:CHECKPOINT_HASH_VERSION,candidateMd5:checkpointMd5(candidate),
          evidenceArtifact:prefix+'decoded/'+id+'.json',resultMd5:checkpointMd5(result),result};
        await persist(key,saved);
      }
      if (saved == null) continue;
      const result = saved.result;
      requireValue([null,'A','B','C'].includes(result.classification) && ['complete','incomplete'].includes(result.auditStatus), 'Invalid persisted evaluation result');
      report.artists.push(summaryRow(saved,key));
    }
    for (const result of report.artists) {
      requireValue([null,'A','B','C'].includes(result.classification) && ['complete','incomplete'].includes(result.auditStatus), 'Invalid persisted report result');
      report.counts[result.classification ?? 'unclassified']++;
      if (result.auditStatus !== 'complete') report.counts.incompleteEvidence++;
    }
    report.candidatesAudited = report.artists.length;
    report.auditComplete = report.populationComplete && report.candidatesAudited === report.totalCandidates && report.counts.incompleteEvidence === 0;
    report.status = report.candidatesAudited !== report.totalCandidates ? 'in_progress' : report.auditComplete ? 'complete' : 'requires_further_investigation';
    report.artistsMd5=checkpointMd5(report.artists);
    await persist(reportKey,report);
    await persist(reportKey.replace(/\.json$/,'.csv'),reportCsv(report));
    return report;
  }
  return { captureRows, collectPopulation, auditNext };
}
