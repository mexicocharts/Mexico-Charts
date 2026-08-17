export type SocialPlatform = "spotify" | "youtube" | "instagram" | "tiktok" | "facebook" | "twitter" | "soundcloud" | "deezer";
export type EvidenceSource = "spotify_verified_mapping" | "youtube_verified_channel" | "songstats_artist_info" | "musicbrainz_url_relation";
export type CandidateStatus = "verified" | "review" | "rejected";

export interface SocialEvidence {
  platform: SocialPlatform;
  canonicalUrl: string;
  source: EvidenceSource;
  exactProviderMapping?: boolean;
}

export interface SocialCandidate {
  platform: SocialPlatform;
  canonicalUrl: string;
  evidenceSources: EvidenceSource[];
  confidence: number;
  status: CandidateStatus;
}

const HOSTS: Record<string, SocialPlatform> = {
  "open.spotify.com": "spotify",
  "youtube.com": "youtube",
  "www.youtube.com": "youtube",
  "youtu.be": "youtube",
  "instagram.com": "instagram",
  "www.instagram.com": "instagram",
  "tiktok.com": "tiktok",
  "www.tiktok.com": "tiktok",
  "facebook.com": "facebook",
  "www.facebook.com": "facebook",
  "twitter.com": "twitter",
  "www.twitter.com": "twitter",
  "x.com": "twitter",
  "www.x.com": "twitter",
  "soundcloud.com": "soundcloud",
  "www.soundcloud.com": "soundcloud",
  "deezer.com": "deezer",
  "www.deezer.com": "deezer",
};

export function canonicalizeSocialUrl(raw: string): { platform: SocialPlatform; canonicalUrl: string } | null {
  try {
    const url = new URL(raw.trim());
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    const platform = HOSTS[url.hostname.toLowerCase()];
    if (!platform) return null;
    let path = url.pathname.replace(/\/+$/, "");
    if (!path || path === "/") return null;
    let host = url.hostname.toLowerCase().replace(/^www\./, "");
    if (platform === "twitter") host = "x.com";
    if (platform === "youtube" && host === "youtu.be") return null; // video links are not artist accounts
    if (platform === "spotify" && !/^\/artist\/[A-Za-z0-9]+$/.test(path)) return null;
    if (platform === "youtube" && !/^\/(channel\/UC[A-Za-z0-9_-]+|@[A-Za-z0-9._-]+|c\/[A-Za-z0-9._-]+|user\/[A-Za-z0-9._-]+)$/.test(path)) return null;
    if (platform === "facebook" && /^\/(profile\.php|share|watch|groups)(\/|$)/i.test(path)) return null;
    if ((platform === "instagram" || platform === "tiktok" || platform === "twitter") && !/^\/@?[A-Za-z0-9._-]+$/.test(path)) return null;
    path = path.split("/").map((part, index) => index === 0 ? part : encodeURIComponent(decodeURIComponent(part))).join("/");
    return { platform, canonicalUrl: `https://${host}${path}` };
  } catch {
    return null;
  }
}

export function mergeSocialEvidence(evidence: SocialEvidence[]): SocialCandidate[] {
  const grouped = new Map<string, SocialEvidence[]>();
  for (const item of evidence) {
    const key = `${item.platform}\n${item.canonicalUrl}`;
    grouped.set(key, [...(grouped.get(key) ?? []), item]);
  }
  return [...grouped.values()].map(items => {
    const sources = [...new Set(items.map(item => item.source))].sort() as EvidenceSource[];
    const exact = items.some(item => item.exactProviderMapping === true);
    const independentlyCorroborated = sources.length >= 2;
    const status: CandidateStatus = exact || independentlyCorroborated ? "verified" : "review";
    return {
      platform: items[0].platform,
      canonicalUrl: items[0].canonicalUrl,
      evidenceSources: sources,
      confidence: exact ? 100 : independentlyCorroborated ? 95 : 65,
      status,
    };
  }).sort((a, b) => a.platform.localeCompare(b.platform) || a.canonicalUrl.localeCompare(b.canonicalUrl));
}
