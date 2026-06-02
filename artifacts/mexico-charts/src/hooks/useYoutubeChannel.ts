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
  analytics: {
    views: {
      average7Day: number | null;
      average7DayFmt: string | null;
      average30Day: number | null;
      average30DayFmt: string | null;
      weeklyGrowth: number | null;
      weeklyGrowthFmt: string | null;
      monthlyGrowth: number | null;
      monthlyGrowthFmt: string | null;
      average7DayChangePct: number | null;
      average30DayChangePct: number | null;
      biggestSpike: {
        date: string;
        views: number | null;
        viewsFmt: string | null;
      } | null;
    };
    subscribers: {
      dailyChange: number | null;
      dailyChangeFmt: string | null;
      weeklyGrowth: number | null;
      weeklyGrowthFmt: string | null;
      monthlyGrowth: number | null;
      monthlyGrowthFmt: string | null;
    };
    momentum: {
      trend: "rising" | "steady" | "cooling" | "new" | null;
      score: number | null;
      scoreFmt: string | null;
    };
    availableDays: number;
  };
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
