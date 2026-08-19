import { discoverYoutubeMusicArtist } from "./youtube-music-shadow-discovery";
import { writeFile } from "node:fs/promises";

function argument(name: string): string | null {
  const prefix = `--${name}=`;
  return process.argv.find(value => value.startsWith(prefix))?.slice(prefix.length) ?? null;
}

const artistKey = argument("artist-key");
const artistName = argument("artist-name");
const browseId = argument("browse-id");
const write = process.argv.includes("--write");
const includeCandidates = process.argv.includes("--include-candidates");
const out = argument("out");

if (!artistKey || !artistName) {
  console.error("Usage: --artist-key=<key> --artist-name=<name> [--browse-id=<id>] [--write]");
  process.exitCode = 1;
} else {
  const result = await discoverYoutubeMusicArtist({ artistKey, artistName, browseId, write, includeCandidates });
  const payload = JSON.stringify({ ...result, shadowMode: true, publicDataChanged: false }, null, 2);
  if (out) await writeFile(out, payload, "utf8");
  console.log(out ? JSON.stringify({ ...result, candidates: undefined, output: out }, null, 2) : payload);
  if (result.error) process.exitCode = 1;
}
