import { useState, useEffect } from "react";

export interface WikiBioResult {
  bio: string;
  pageTitle: string | null;
  pageUrl: string | null;
  thumbnailUrl: string | null;
}

export function useWikiBio(name: string): WikiBioResult | null {
  const [result, setResult] = useState<WikiBioResult | null>(null);

  useEffect(() => {
    if (!name) return;
    let cancelled = false;

    fetch(`/api/providers/wiki/artist?name=${encodeURIComponent(name)}`)
      .then(r => (r.ok ? r.json() : null))
      .then((data: { bio?: string | null; pageTitle?: string | null; pageUrl?: string | null; thumbnailUrl?: string | null } | null) => {
        if (cancelled || !data?.bio) return;
        setResult({
          bio: data.bio,
          pageTitle: data.pageTitle ?? null,
          pageUrl: data.pageUrl ?? null,
          thumbnailUrl: data.thumbnailUrl ?? null,
        });
      })
      .catch(() => {});

    return () => { cancelled = true; };
  }, [name]);

  return result;
}
