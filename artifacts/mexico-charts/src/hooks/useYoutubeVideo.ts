import { useState, useEffect } from "react";

export interface YoutubeVideoResult {
  videoId:      string;
  title:        string | null;
  thumbnailUrl: string | null;
  viewCount:    number | null;
  likeCount:    number | null;
  commentCount: number | null;
  duration:     string | null;
  publishedAt:  string | null;
  channelId:    string | null;
  videoUrl:     string;
  viewsFmt:     string | null;
  likesFmt:     string | null;
  commentsFmt:  string | null;
  durationFmt:  string | null;
}

export function useYoutubeVideo(videoId: string): YoutubeVideoResult | null {
  const [result, setResult] = useState<YoutubeVideoResult | null>(null);

  useEffect(() => {
    if (!videoId) return;
    let cancelled = false;

    fetch(`/api/providers/youtube/video?videoId=${encodeURIComponent(videoId)}`)
      .then(r => (r.ok ? r.json() : null))
      .then((data: YoutubeVideoResult | null) => {
        if (cancelled || !data?.videoId) return;
        setResult(data);
      })
      .catch(() => {});

    return () => { cancelled = true; };
  }, [videoId]);

  return result;
}
