import { useEffect, useState } from "react";
import { Bell, Bookmark, BookmarkCheck } from "lucide-react";
import { authenticatedFetch, useMexicoAuth } from "@/auth/AuthProvider";
import { useLanguage } from "@/i18n/LanguageContext";

type Props = { artistKey: string; artistName: string };

export default function SaveArtistButton({ artistKey, artistName }: Props) {
  const auth = useMexicoAuth();
  const { pick } = useLanguage();
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!auth.isSignedIn) {
      setSaved(false);
      return;
    }
    void authenticatedFetch(auth.getToken, "/api/account/me")
      .then(response => response.ok ? response.json() : null)
      .then((payload: { savedArtists?: Array<{ artistKey: string }> } | null) => {
        setSaved(Boolean(payload?.savedArtists?.some(artist => artist.artistKey === artistKey)));
      })
      .catch(error => console.error("[Saved artist status]", error));
  }, [artistKey, auth.isSignedIn]);

  if (!auth.configured) return null;

  async function toggleSaved() {
    if (!auth.isSignedIn) {
      auth.openSignUp();
      return;
    }
    setBusy(true);
    try {
      const response = await authenticatedFetch(
        auth.getToken,
        saved ? `/api/account/saved-artists/${encodeURIComponent(artistKey)}` : "/api/account/saved-artists",
        saved ? { method: "DELETE" } : {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ artistKey, artistName }),
        },
      );
      if (!response.ok) throw new Error(`Save artist failed (${response.status})`);
      setSaved(current => !current);
    } catch (error) {
      console.error("[Save artist]", error);
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={toggleSaved}
      disabled={busy}
      className="inline-flex min-h-10 items-center gap-2 rounded-full border border-white/12 bg-white/[0.055] px-4 text-[9px] font-black uppercase tracking-[0.16em] text-white/70 transition-colors hover:border-[#39FF14]/35 hover:text-[#39FF14] disabled:opacity-50"
    >
      {saved ? <BookmarkCheck className="h-4 w-4 text-[#39FF14]" /> : <Bookmark className="h-4 w-4" />}
      {saved ? pick("Siguiendo", "Following") : pick("Seguir artista", "Follow artist")}
      {saved && <Bell className="h-3.5 w-3.5 text-[#39FF14]" />}
    </button>
  );
}
