/** Private read-only orchestration helpers. No database, filesystem, network, or wall-clock initialization. */
const PROTOCOL = 'monitor-audit-json-v1';
const COLUMNS = ['protocol', 'total_rows', 'payload_chars', 'payload_md5', 'chunk_start', 'chunk_chars', 'chunk'];
function requireValue(condition, message) { if (!condition) throw new Error(message); }
const plain = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const serialize = value => JSON.stringify(value);

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

export function buildJsonChunkSql(reviewedSelect, start = 1, size = null) {
  requireValue(typeof reviewedSelect === 'string' && /^\s*(SELECT|WITH)\b/i.test(reviewedSelect), 'A reviewed read-only SELECT is required');
  requireValue(Number.isSafeInteger(start) && start >= 1 && (size === null ? start === 1 : Number.isSafeInteger(size) && size >= 1 && size <= 100000), 'Invalid bounded chunk range');
  const sql = reviewedSelect.trim().replace(/;\s*$/, '');
  const part = size === null ? 'payload' : `substring(payload FROM ${start} FOR ${size})`;
  // The caller supplies trusted, reviewed SQL. This wrapper is not a SQL parser or authorization boundary.
  return `WITH monitor_replay_rows AS MATERIALIZED (${sql}), monitor_replay_payload AS (
    SELECT count(*) AS total_rows, COALESCE(jsonb_agg(to_jsonb(monitor_replay_rows)), '[]'::jsonb)::text AS payload FROM monitor_replay_rows
  ) SELECT '${PROTOCOL}' AS protocol, total_rows, length(payload) AS payload_chars, md5(payload) AS payload_md5,
    ${start} AS chunk_start, length(${part}) AS chunk_chars,
    ${part} AS chunk FROM monitor_replay_payload`;
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
export function createAuditReplay({ evaluator, metadata, execute, persist, read, chunkSize = 24000 }) {
  requireValue(plain(evaluator) && typeof evaluator.groupMonitoringCandidateIdentities === 'function' && typeof evaluator.evaluateMonitoringCandidate === 'function', 'Pure evaluator is required');
  requireValue(plain(metadata) && ['runId','revision','sourceHash','evaluatorHash','now'].every(key => typeof metadata[key] === 'string' && metadata[key]), 'Explicit run/revision/source/evaluator/clock metadata is required');
  safeId(metadata.runId);
  requireValue(['run_fixed','evidence_transaction_timestamp'].includes(metadata.clockMode), 'An explicit audit clock mode is required');
  requireValue(/T.*(?:Z|[+-]\d\d:\d\d)$/.test(metadata.now) && Number.isFinite(new Date(metadata.now).getTime()), 'A fixed explicit timezone-bearing audit clock is required');
  requireValue([execute,persist,read].every(value => typeof value === 'function'), 'Caller execution and durable persistence functions are required');
  const prefix = metadata.runId + '/';
  let manifestChecked = false;
  async function manifest() {
    if (manifestChecked) return;
    const existing = await read(prefix + 'manifest.json');
    if (existing !== null && existing !== undefined) requireValue(serialize(existing) === serialize(metadata), 'Checkpoint metadata does not match this run');
    else await persist(prefix + 'manifest.json', metadata);
    manifestChecked = true;
  }
  async function captureRows({ id, sql, expectedRows, chunked = false }) {
    await manifest(); safeId(id);
    requireValue(Number.isSafeInteger(expectedRows) && expectedRows >= 0, 'An independently established expected row count is required');
    const decodedKey = prefix + 'decoded/' + id + '.json';
    const prior = await read(decodedKey);
    if (prior != null) {
      requireValue(prior.sql === sql && prior.expectedRows === expectedRows && Array.isArray(prior.rows) && prior.rows.length === expectedRows, 'Decoded checkpoint request mismatch');
      requireValue(md5Utf8(serialize(prior.rows)) === prior.normalizedRowsMd5, 'Decoded checkpoint checksum mismatch');
      return prior.rows;
    }
    const pieces = []; let start = 1, identity = null;
    while (true) {
      const requestSql = buildJsonChunkSql(sql, start, chunked ? chunkSize : null);
      const rawKey = prefix + 'raw/' + id + '/' + (chunked ? start : 'full') + '.json';
      let saved = await read(rawKey);
      if (saved == null) {
        const rawResult = await execute(requestSql, { id, chunkStart:start, chunkSize:chunked ? chunkSize : null });
        saved = { id, sql:requestSql, rawResult };
        await persist(rawKey, saved); // Always checkpoint exact raw output before decoding or evaluation.
      }
      requireValue(saved.id === id && saved.sql === requestSql, 'Raw checkpoint request mismatch');
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
        await persist(decodedKey, { sql, expectedRows, rows, normalizedRowsMd5:md5Utf8(serialize(rows)), payloadMd5:frame.payload_md5, payloadCharacters:chars });
        return rows;
      }
    }
  }
  async function collectPopulation({ sources, missingSchemaTables = [] }) {
    requireValue(Array.isArray(sources) && sources.length > 0 && new Set(sources.map(source => source.id)).size === sources.length, 'Unique complete population source plans are required');
    const rows = [], pages = [];
    for (const source of sources) {
      safeId(source.id);
      requireValue(Number.isSafeInteger(source.totalRows) && source.totalRows >= 0 &&
        (source.capture === 'whole' ? typeof source.selectAll === 'function' : typeof source.selectPage === 'function'), 'Each source needs its verified total and reviewed SELECT');
      if (source.capture === 'whole') {
        const id=source.id+'_whole';
        const values=await captureRows({id,sql:source.selectAll(),expectedRows:source.totalRows});
        rows.push(...values);pages.push({id,source:source.id,offset:0,rows:values.length,immutableSourceFrame:true});
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
      missingSchemaTables, populationComplete:missingSchemaTables.length === 0 && sources.every(source=>source.capture==='whole'),
      populationLimitations:sources.some(source=>source.capture!=='whole')?['paged_selects_without_shared_snapshot']:[], pages, candidates };
    await persist(prefix + 'population.json', population);
    return population;
  }
  async function auditNext({ population, evidenceSql, maximumArtists = 1, chunkedArtistKeys = [] }) {
    await manifest();
    requireValue(plain(population) && serialize(population.metadata) === serialize(metadata) && Array.isArray(population.candidates), 'This run requires its durable complete population checkpoint');
    requireValue(typeof evidenceSql === 'function' && Number.isSafeInteger(maximumArtists) && maximumArtists >= 1 && maximumArtists <= 25, 'Bounded sequential evidence plan required');
    requireValue(metadata.clockMode !== 'evidence_transaction_timestamp' || chunkedArtistKeys.length === 0, 'Transaction-clock captures require one full response; repeated chunks would change the capture timestamp');
    const populationMd5 = md5Utf8(serialize(population.candidates));
    const priorReport = await read(prefix+'report.json');
    if (priorReport != null) {
      requireValue(serialize(priorReport.metadata) === serialize(metadata) && priorReport.populationMd5 === populationMd5 && Array.isArray(priorReport.artists), 'Report checkpoint population or metadata mismatch');
      requireValue(priorReport.artists.every((row,index) => row.artistKey === population.candidates[index]?.artistKey), 'Report checkpoint is not a contiguous unique candidate prefix');
    }
    const report = { metadata, populationMd5, totalCandidates:population.candidates.length, populationComplete:population.populationComplete,
      counts:{A:0,B:0,C:0,unclassified:0,incompleteEvidence:0}, candidatesAudited:0, auditComplete:false, status:'in_progress', artists:priorReport?.artists.slice() ?? [] };
    const previousCount = report.artists.length;
    for (let index = previousCount; index < population.candidates.length && index < previousCount + maximumArtists; index++) {
      const candidate = population.candidates[index], key = prefix + 'results/' + index + '.json';
      let saved = await read(key);
      if (saved != null) requireValue(saved.artistKey === candidate.artistKey && saved.candidateMd5 === md5Utf8(serialize(candidate)), 'Result checkpoint candidate mismatch');
      else {
        const chunked = chunkedArtistKeys.includes(candidate.artistKey);
        const id = 'evidence_' + index + (chunked ? '_chunks' : '');
        const rows = await captureRows({id,sql:evidenceSql(candidate),expectedRows:1,chunked});
        requireValue(rows[0].artist_key === candidate.artistKey, 'Evidence returned a different artist key');
        const decisionClock = metadata.clockMode === 'evidence_transaction_timestamp' ? rows[0].audit_captured_at : metadata.now;
        requireValue(typeof decisionClock === 'string' && /T.*(?:Z|[+-]\d\d:\d\d)$/.test(decisionClock) && Number.isFinite(new Date(decisionClock).getTime()), 'Missing or invalid explicit evidence capture clock');
        const result = evaluator.evaluateMonitoringCandidate(candidate, {...rows[0],missing_schema_tables:population.missingSchemaTables}, new Date(decisionClock));
        requireValue(result.artistKey === candidate.artistKey && result.auditedAt === new Date(decisionClock).toISOString(), 'Evaluator returned inconsistent identity or clock');
        saved = {artistKey:candidate.artistKey,candidateMd5:md5Utf8(serialize(candidate)),evidenceArtifact:prefix+'decoded/'+id+'.json',result};
        await persist(key,saved);
      }
      if (saved == null) continue;
      const result = saved.result;
      requireValue([null,'A','B','C'].includes(result.classification) && ['complete','incomplete'].includes(result.auditStatus), 'Invalid persisted evaluation result');
      report.artists.push({artistKey:result.artistKey,artistName:result.artistName,classification:result.classification,auditStatus:result.auditStatus,
        publicEligible:result.publicEligible,readinessReasons:result.readinessReasons,resultArtifact:key});
    }
    for (const result of report.artists) {
      requireValue([null,'A','B','C'].includes(result.classification) && ['complete','incomplete'].includes(result.auditStatus), 'Invalid persisted report result');
      report.counts[result.classification ?? 'unclassified']++;
      if (result.auditStatus !== 'complete') report.counts.incompleteEvidence++;
    }
    report.candidatesAudited = report.artists.length;
    report.auditComplete = report.populationComplete && report.candidatesAudited === report.totalCandidates && report.counts.incompleteEvidence === 0;
    report.status = report.candidatesAudited !== report.totalCandidates ? 'in_progress' : report.auditComplete ? 'complete' : 'requires_further_investigation';
    await persist(prefix+'report.json',report);
    await persist(prefix+'report.csv',reportCsv(report));
    return report;
  }
  return { captureRows, collectPopulation, auditNext };
}
