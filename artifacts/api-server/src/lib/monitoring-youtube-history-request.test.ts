import assert from "node:assert/strict";
import test from "node:test";
import type { Request, Response } from "express";
import { readFile } from "node:fs/promises";
import { createMonitoringYoutubeHistoryHandler } from "./monitoring-youtube-history-request";
import { MonitoringYoutubeVideoAccessError } from "./monitoring-youtube-native-history";
import { isMonitoringHistoryTimeout } from "./monitoring-history-request";
import { authorizeMonitoringArtist } from "./monitoring-authorization";
import { monitoringIdentityKeyCandidates } from "./monitoring-candidate-policy";

const access = { allowed: true, source: "internal" as const, outcome: "allowed" as const, publicReadinessEvaluated: false as const,
  grant: { artist_key: "canonical", artist_name: "Artist", status: "internal", created_at: null, match_keys: ["vetted alias"] } };
function harness(overrides: Partial<Parameters<typeof createMonitoringYoutubeHistoryHandler>[0]> = {}) {
  let status = 200, reads = 0, authorizations = 0;
  const bodies: any[] = [], diagnostics: any[] = [], inputs: any[] = [];
  const headers: Record<string,string> = {};
  const req = { headers: {}, params: { artistKey: "requested route alias", videoId: "approved001" }, query: {},
    originalUrl: "/api/monitoring/videos/canonical/approved001/history", log: { info() {}, warn() {} } } as unknown as Request;
  const res = { locals: {}, setHeader(key: string, value: string) { headers[key] = value; },
    status(value: number) { status = value; return this; }, json(value: unknown) { bodies.push(value); return this; } } as unknown as Response;
  const handler = createMonitoringYoutubeHistoryHandler({
    userId: () => "founder", aliases: monitoringIdentityKeyCandidates,
    authorize: async () => { authorizations++; return access; },
    read: async input => { reads++; inputs.push(input); return { kind: "native_intraday_cumulative", status: "empty", points: [] }; },
    failure: error => isMonitoringHistoryTimeout(error) ? { status: 504, code: "monitoring_timeout" } : { status: 500, code: "monitoring_backend_failure" },
    diagnostic: event => diagnostics.push(event), ...overrides,
  });
  return { req, res, handler, bodies, diagnostics, headers, inputs, status: () => status, reads: () => reads, authorizations: () => authorizations };
}
const deferred = <T>() => { let resolve!: (value:T)=>void, reject!: (value:unknown)=>void;
  const promise = new Promise<T>((accept,decline)=>{resolve=accept;reject=decline;});return {promise,resolve,reject}; };
async function flush() { for (let index=0;index<8;index++) await Promise.resolve(); }

test("video history uses only the authorized identity and never assembles a dashboard", async () => {
  for (const source of ["internal", "subscription"] as const) {
    const h = harness({ authorize: async () => ({ ...access, source }) });
    await h.handler(h.req,h.res,()=>{});
    assert.equal(h.status(),200);assert.equal(h.reads(),1);assert.equal(h.inputs[0].range,"30d");
    assert.equal(h.inputs[0].artistKey,"canonical");assert.equal(h.inputs[0].includeCandidateOnly,source==="internal");
    assert.ok(h.inputs[0].artistKeys.includes("vetted alias"));
    assert.ok(!h.inputs[0].artistKeys.includes("requested route alias"),"route text cannot expand the granted identity");
    assert.equal(h.headers["Cache-Control"],"private, no-store");
  }
  const source=await readFile(new URL("../routes/monitoring.ts",import.meta.url),"utf8");
  assert.match(source,/"\/monitoring\/videos\/:artistKey\/:videoId\/history",\s*requireMonitoringClerkUser,\s*createMonitoringYoutubeHistoryHandler/);
  const route=source.slice(source.indexOf('"/monitoring/videos/:artistKey/:videoId/history"'),source.indexOf('"/monitoring/history/:artistKey/:metricKey"'));
  assert.match(route,/authorize: resolveMonitoringAccess/);assert.match(route,/queryable: monitoringReadPool/);
  assert.doesNotMatch(route,/loadAuthorizedMonitoring|loadMonitoringYoutubeDailyHistory/);
});

test("paid and founder authorization preserve conflicts and exact non-Latin aliases", async () => {
  for (const conflict of [false,true]) {
    const h=harness({authorize:(userId,requestedArtistKey)=>authorizeMonitoringArtist({userId,requestedArtistKey,
      internalUserIds:"other-founder",findActiveSubscription:async()=>({artist_key:"X東京",artist_name:"X東京",status:"active",created_at:null}),
      findExistingArtist:async()=>({...access.grant,artist_key:"X東京",artist_name:"X東京",match_keys:["vetted exact alias"],identity_conflict:conflict})})});
    await h.handler(h.req,h.res,()=>{});assert.equal(h.status(),200);assert.equal(h.inputs[0].includeCandidateOnly,false);
    assert.ok(!h.inputs[0].artistKeys.includes("x"));assert.ok(!h.inputs[0].artistKeys.includes(""));
    if(conflict)assert.deepEqual(h.inputs[0].artistKeys,["X東京"]);
    else assert.ok(h.inputs[0].artistKeys.includes("vetted exact alias"));
  }
});

test("unauthorized artists, unknown founder artists and ineligible videos disclose no history or relation rows", async () => {
  for(const internal of [false,true]){
    const h=harness({authorize:async()=>({allowed:false,source:internal?"internal":null,grant:null,
      outcome:internal?"artist_not_found":"entitlement_denied",publicReadinessEvaluated:false})});
    await h.handler(h.req,h.res,()=>{});assert.equal(h.status(),internal?404:403);assert.equal(h.reads(),0);
    assert.equal(h.bodies[0].points,undefined);assert.equal(h.bodies[0].relationship,undefined);
  }
  const h=harness({read:async()=>{throw new MonitoringYoutubeVideoAccessError();}});
  await h.handler(h.req,h.res,()=>{});assert.equal(h.status(),403);assert.equal(h.bodies[0].code,"monitoring_video_access_denied");
  assert.equal(h.bodies[0].points,undefined);assert.equal(h.bodies[0].relationship,undefined);
});

test("invalid video history inputs are rejected before authorization or query", async () => {
  for(const [videoId,range] of [["../outside","7d"],["short","7d"],["approved001","all"],["approved001","90"],["approved001","custom"]]){
    const h=harness();h.req.params.videoId=videoId;h.req.query.range=range;
    await h.handler(h.req,h.res,()=>{});assert.equal(h.status(),400);assert.equal(h.bodies[0].code,"invalid_video_history_request");
    assert.equal(h.authorizations(),0);assert.equal(h.reads(),0);
  }
});

test("late artist authorization cannot start video history beyond the 12-second request budget", async context => {
  context.mock.timers.enable({apis:["setTimeout","Date"],now:100000});
  const authorization=deferred<typeof access>(),h=harness({authorize:()=>authorization.promise});
  const pending=h.handler(h.req,h.res,()=>{});context.mock.timers.tick(12000);await pending;
  assert.equal(h.status(),504);authorization.resolve(access);await flush();assert.equal(h.reads(),0);assert.equal(h.bodies.length,1);
});

test("late native query resolution or rejection never sends another response", async context => {
  context.mock.timers.enable({apis:["setTimeout","Date"],now:100000});
  for(const fails of [false,true]){
    const backend=deferred<unknown>();let deadlineAt=0;
    const h=harness({read:input=>{deadlineAt=input.deadlineAt;return backend.promise;}});
    const pending=h.handler(h.req,h.res,()=>{});await flush();assert.equal(deadlineAt,Date.now()+12000);
    context.mock.timers.tick(12000);await pending;assert.equal(h.status(),504);assert.equal(h.bodies[0].code,"monitoring_timeout");
    if(fails)backend.reject(new Error("private late query detail"));else backend.resolve({secret:"private late row"});
    await flush();assert.equal(h.bodies.length,1);assert.equal(h.diagnostics.length,1);
    assert.doesNotMatch(JSON.stringify([...h.bodies,...h.diagnostics]),/private late/);
  }
});

test("unknown backend failures are coded terminal failures without details or false empty history", async () => {
  const h=harness({read:async()=>{throw new Error("private db credential and source payload");}});
  await h.handler(h.req,h.res,()=>{});assert.equal(h.status(),500);assert.equal(h.bodies[0].code,"monitoring_backend_failure");
  assert.equal(h.bodies[0].points,undefined);assert.doesNotMatch(JSON.stringify([...h.bodies,...h.diagnostics]),/credential|payload/);
});

test("Clerk rejects signed-out access before video-history authorization", async () => {
  const {createRequireClerkUser,clerkUserId}=await import("./auth");
  const h=harness({userId:clerkUserId});
  createRequireClerkUser({configured:()=>true,resolveAuth:()=>({isAuthenticated:false,userId:null}) as never})(h.req,h.res,()=>{throw new Error("Unauthenticated continuation");});
  assert.equal(h.status(),401);assert.equal(h.bodies[0].code,"sign_in_required");assert.equal(h.authorizations(),0);assert.equal(h.reads(),0);
});
