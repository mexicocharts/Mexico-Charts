import { useState, useEffect } from "react";

export interface YoutubeChannelResult {
  channelId:       string;
  title:           string | null;
  thumbnailUrl:    string | null;
  subscriberCount: number | null;
  viewCount:       number | null;
  videoCount:      number | null;
  customUrl:       string | null;
  subscribersFmt:  string | null;
  viewsFmt:        string | null;
  dailyViews:      number | null;
  dailyViewsFmt:   string | null;
  snapshotDate:    string | null;
  history: Array<{
    date: string;
    views: number | null;
    subscribers: number | null;
    videos: number | null;
    dailyViews: number | null;
  }>;
  channelUrl:      string;
}

export function useYoutubeChannel(artistKey: string): YoutubeChannelResult | null {
  const [result, setResult] = useState<YoutubeChannelResult | null>(null);

  useEffect(() => {
    if (!artistKey) return;
    let cancelled = false;

    fetch(`/api/providers/youtube/channel?artistKey=${encodeURIComponent(artistKey)}`)
      .then(r => (r.ok ? r.json() : null))
      .then((data: YoutubeChannelResult | null) => {
        if (cancelled || !data?.channelId) return;
        setResult(data);
      })
      .catch(() => {});

    return () => { cancelled = true; };
  }, [artistKey]);

  return result;
}
