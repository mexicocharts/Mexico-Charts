import { createRequire } from "node:module";
import { resolveDatabaseUrl } from "@workspace/db/database-url";

const require=createRequire(import.meta.url);
const { Client }=require("../../lib/db/node_modules/pg") as {
  Client:new(config:{connectionString:string})=>{
    connect:()=>Promise<void>;
    query:<T=Record<string,unknown>>(sql:string,params?:unknown[])=>Promise<{rows:T[]}>;
    end:()=>Promise<void>;
  };
};

type YoutubeVideo = {
  id: string;
  snippet?: { title?: string; channelId?: string; publishedAt?: string; thumbnails?: Record<string,{url?:string}> };
  contentDetails?: { duration?: string };
  statistics?: { viewCount?: string; likeCount?: string; commentCount?: string };
};

const apiKey=process.env["YOUTUBE_API_KEY"];
if (!apiKey) throw new Error("YOUTUBE_API_KEY is required.");
const databaseUrl=resolveDatabaseUrl();

const client=new Client({connectionString:databaseUrl});
await client.connect();
try {
  await client.query(`CREATE TABLE IF NOT EXISTS youtube_official_revalidation_runs (
    id bigserial PRIMARY KEY, started_at timestamptz NOT NULL DEFAULT now(), finished_at timestamptz,
    requested integer NOT NULL DEFAULT 0, returned integer NOT NULL DEFAULT 0,
    unavailable integer NOT NULL DEFAULT 0, transient_failures integer NOT NULL DEFAULT 0,
    status text NOT NULL DEFAULT 'running', summary jsonb NOT NULL DEFAULT '{}'::jsonb
  ); CREATE TABLE IF NOT EXISTS youtube_official_revalidation_results (
    run_id bigint NOT NULL REFERENCES youtube_official_revalidation_runs(id) ON DELETE RESTRICT,
    video_id text NOT NULL, result text NOT NULL, http_status integer, observed_at timestamptz NOT NULL DEFAULT now(),
    detail jsonb NOT NULL DEFAULT '{}'::jsonb, PRIMARY KEY(run_id,video_id)
  )`);
  const pending=await client.query<{video_id:string}>(`
    SELECT video_id FROM youtube_tracked_videos
    WHERE metadata->>'youtubeMusicShadowCandidate'='true'
      AND (published_at IS NULL OR duration IS NULL OR channel_id IS NULL OR view_count IS NULL)
    ORDER BY video_id
  `);
  const run=await client.query<{id:string}>("INSERT INTO youtube_official_revalidation_runs(requested) VALUES($1) RETURNING id::text",[pending.rows.length]);
  const runId=run.rows[0]!.id;
  let returned=0;
  let unavailable=0;
  let transientFailures=0;
  for(let offset=0;offset<pending.rows.length;offset+=50){
    const ids=pending.rows.slice(offset,offset+50).map(row=>row.video_id);
    const url=new URL("https://www.googleapis.com/youtube/v3/videos");
    Object.entries({key:apiKey,part:"snippet,contentDetails,statistics",id:ids.join(","),maxResults:String(ids.length)})
      .forEach(([key,value])=>url.searchParams.set(key,value));
    let response:Response;
    try { response=await fetch(url,{signal:AbortSignal.timeout(20_000)}); }
    catch(error){
      transientFailures+=ids.length;
      for(const id of ids) await client.query("INSERT INTO youtube_official_revalidation_results(run_id,video_id,result,detail) VALUES($1,$2,'transient_failure',$3::jsonb)",[runId,id,JSON.stringify({error:String(error).slice(0,300)})]);
      continue;
    }
    const text=await response.text();
    if(!response.ok){
      transientFailures+=ids.length;
      for(const id of ids) await client.query("INSERT INTO youtube_official_revalidation_results(run_id,video_id,result,http_status,detail) VALUES($1,$2,'transient_failure',$3,$4::jsonb)",[runId,id,response.status,JSON.stringify({error:text.slice(0,300)})]);
      continue;
    }
    const payload=JSON.parse(text) as {items?:YoutubeVideo[]};
    const found=new Map((payload.items??[]).map(item=>[item.id,item]));
    for(const id of ids){
      const video=found.get(id);
      if(!video){
        unavailable+=1;
        await client.query("INSERT INTO youtube_official_revalidation_results(run_id,video_id,result,http_status) VALUES($1,$2,'unavailable_or_private',200)",[runId,id]);
        continue;
      }
      returned+=1;
      const thumbnails=video.snippet?.thumbnails??{};
      const thumbnail=thumbnails["maxres"]?.url??thumbnails["high"]?.url??thumbnails["medium"]?.url??thumbnails["default"]?.url??null;
      await client.query(`UPDATE youtube_tracked_videos SET
        channel_id=COALESCE($2,channel_id), title=COALESCE(NULLIF($3,''),title), thumbnail_url=COALESCE($4,thumbnail_url),
        published_at=COALESCE($5::timestamptz,published_at), duration=COALESCE($6,duration),
        view_count=COALESCE($7::bigint,view_count),like_count=COALESCE($8::bigint,like_count),comment_count=COALESCE($9::bigint,comment_count),
        metadata=metadata||jsonb_build_object('latestMaintenanceSource','youtube_data_api_v3_videos_list','officiallyRevalidatedAt',now()),
        last_seen_at=now(),updated_at=now() WHERE video_id=$1`,[
        id,video.snippet?.channelId??null,video.snippet?.title??null,thumbnail,video.snippet?.publishedAt??null,video.contentDetails?.duration??null,
        video.statistics?.viewCount??null,video.statistics?.likeCount??null,video.statistics?.commentCount??null,
      ]);
      await client.query("UPDATE youtube_music_catalog_candidates SET last_observed_at=now(),last_checked_at=now(),updated_at=now() WHERE video_id=$1",[id]);
      await client.query("INSERT INTO youtube_official_revalidation_results(run_id,video_id,result,http_status,detail) VALUES($1,$2,'revalidated',200,$3::jsonb)",[
        runId,id,JSON.stringify({endpoint:"videos.list",parts:["snippet","contentDetails","statistics"]}),
      ]);
    }
  }
  await client.query(`UPDATE youtube_official_revalidation_runs SET finished_at=now(),returned=$2,unavailable=$3,transient_failures=$4,
    status=CASE WHEN $4=0 THEN 'complete' ELSE 'partial' END,
    summary=jsonb_build_object('endpoint','videos.list','parts',jsonb_build_array('snippet','contentDetails','statistics'),'originalProvenancePreserved',true,'deletions',0)
    WHERE id=$1`,[runId,returned,unavailable,transientFailures]);
  console.log(JSON.stringify({runId,requested:pending.rows.length,revalidated:returned,unavailableOrPrivate:unavailable,transientFailures,unresolved:transientFailures}));
} finally { await client.end(); }
