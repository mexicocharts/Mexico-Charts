import { useEffect } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import { renderArtistIndex } from "@/lib/artistIndex.mjs";

export default function ArtistIndex() {
  const { language } = useLanguage();
  // Keep static navigation until its equivalent client content has mounted.
  useEffect(() => { document.getElementById("prerender-artist-index")?.remove(); }, []);
  return <aside dangerouslySetInnerHTML={{ __html: renderArtistIndex(language) }} />;
}
