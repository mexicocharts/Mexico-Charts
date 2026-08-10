import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Bell, Bookmark, ChevronRight, LogOut, Sparkles, UserRound } from "lucide-react";
import SiteNav from "@/components/SiteNav";
import PageSEO from "@/components/PageSEO";
import { authenticatedFetch, useMexicoAuth } from "@/auth/AuthProvider";
import { useLanguage } from "@/i18n/LanguageContext";
import { canonicalArtistHref } from "@/lib/artistRoutes.mjs";

type AccountPayload = {
  savedArtists: Array<{ artistKey: string; artistName: string; alertsEnabled: boolean }>;
};

export default function Cuenta() {
  const auth = useMexicoAuth();
  const { pick } = useLanguage();
  const { data, isLoading } = useQuery<AccountPayload>({
    queryKey: ["account", auth.userId],
    enabled: auth.configured && auth.isSignedIn,
    queryFn: async () => {
      const response = await authenticatedFetch(auth.getToken, "/api/account/me");
      if (!response.ok) throw new Error("Account unavailable");
      return response.json() as Promise<AccountPayload>;
    },
  });

  return (
    <div className="min-h-screen bg-[#050505] text-white">
      <PageSEO title={pick("Mi cuenta — Mexico Charts", "My account — Mexico Charts")} description={pick("Tu cuenta y artistas guardados en Mexico Charts", "Your Mexico Charts account and saved artists")} path="/cuenta" noindex />
      <SiteNav />
      <main className="mx-auto max-w-6xl px-6 py-16 lg:px-10 lg:py-24">
        {!auth.configured ? (
          <section className="rounded-3xl border border-white/10 bg-white/[0.025] p-8 text-center sm:p-12">
            <UserRound className="mx-auto h-10 w-10 text-[#39FF14]" />
            <h1 className="mt-6 text-3xl font-semibold tracking-[-0.04em]">{pick("Cuentas en preparación", "Accounts are being prepared")}</h1>
            <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-white/45">{pick("Estamos terminando el acceso seguro. El sitio público continúa disponible sin registro", "We are finishing secure access. The public site remains available without registration")}</p>
          </section>
        ) : !auth.isSignedIn ? (
          <section className="rounded-3xl border border-[#39FF14]/20 bg-[radial-gradient(circle_at_top,rgba(57,255,20,0.10),transparent_48%)] p-8 text-center sm:p-14">
            <Sparkles className="mx-auto h-9 w-9 text-[#39FF14]" />
            <h1 className="mt-6 text-4xl font-semibold tracking-[-0.05em]">{pick("Tu Mexico Charts", "Your Mexico Charts")}</h1>
            <p className="mx-auto mt-4 max-w-xl text-sm leading-6 text-white/50">{pick("Guarda artistas, recibe alertas y conserva tus preferencias. Los perfiles y listas públicas siguen abiertos para todos", "Save artists, receive alerts and keep your preferences. Public profiles and charts remain open to everyone")}</p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <button onClick={auth.openSignUp} className="rounded-full bg-[#39FF14] px-6 py-3 text-[10px] font-black uppercase tracking-[0.16em] text-black">{pick("Crear cuenta gratis", "Create free account")}</button>
              <button onClick={auth.openSignIn} className="rounded-full border border-white/12 px-6 py-3 text-[10px] font-black uppercase tracking-[0.16em] text-white/70">{pick("Ingresar", "Sign in")}</button>
            </div>
          </section>
        ) : (
          <>
            <header className="flex flex-col justify-between gap-6 border-b border-white/[0.07] pb-10 sm:flex-row sm:items-end">
              <div>
                <p className="text-[9px] font-black uppercase tracking-[0.24em] text-[#39FF14]">Mexico Charts</p>
                <h1 className="mt-3 text-4xl font-semibold tracking-[-0.05em] sm:text-5xl">{pick("Mi cuenta", "My account")}</h1>
                <p className="mt-3 text-sm text-white/45">{auth.displayName}</p>
              </div>
              <button onClick={() => void auth.signOut()} className="inline-flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.16em] text-white/40 hover:text-white"><LogOut className="h-4 w-4" />{pick("Cerrar sesión", "Sign out")}</button>
            </header>

            <section className="mt-10 grid gap-4 sm:grid-cols-2">
              <article className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-6"><Bookmark className="h-5 w-5 text-[#39FF14]" /><p className="mt-5 text-3xl font-semibold">{data?.savedArtists.length ?? 0}</p><p className="mt-1 text-[9px] font-black uppercase tracking-[0.18em] text-white/35">{pick("Artistas guardados", "Saved artists")}</p></article>
              <article className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-6"><Bell className="h-5 w-5 text-[#39FF14]" /><p className="mt-5 text-3xl font-semibold">{data?.savedArtists.filter(a => a.alertsEnabled).length ?? 0}</p><p className="mt-1 text-[9px] font-black uppercase tracking-[0.18em] text-white/35">{pick("Alertas activas", "Active alerts")}</p></article>
            </section>

            <section className="mt-12">
              <div className="flex items-end justify-between gap-4"><div><p className="text-[9px] font-black uppercase tracking-[0.22em] text-[#39FF14]">{pick("Tu colección", "Your collection")}</p><h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em]">{pick("Artistas que sigues", "Artists you follow")}</h2></div><Link href="/artists" className="text-[9px] font-black uppercase tracking-[0.14em] text-white/40 hover:text-[#39FF14]">{pick("Explorar", "Explore")}</Link></div>
              <div className="mt-5 overflow-hidden rounded-2xl border border-white/[0.07]">
                {isLoading ? <p className="p-6 text-sm text-white/35">{pick("Cargando…", "Loading…")}</p> : data?.savedArtists.length ? data.savedArtists.map(artist => (
                  <Link key={artist.artistKey} href={canonicalArtistHref(artist.artistKey) ?? "/artists"} className="flex items-center justify-between border-b border-white/[0.06] px-5 py-4 last:border-0 hover:bg-white/[0.025]"><span className="font-semibold">{artist.artistName}</span><ChevronRight className="h-4 w-4 text-white/25" /></Link>
                )) : <p className="p-6 text-sm leading-6 text-white/35">{pick("Aún no sigues artistas. Abre cualquier perfil y toca “Seguir artista”", "You are not following any artists yet. Open a profile and select “Follow artist”")}</p>}
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
