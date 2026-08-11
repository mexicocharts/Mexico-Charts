import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { Activity, Bell, Bookmark, CheckCircle2, ChevronRight, ExternalLink, LogOut, Music2, Radio, ShieldCheck, Sparkles, UserRound } from "lucide-react";
import SiteNav from "@/components/SiteNav";
import PageSEO from "@/components/PageSEO";
import { authenticatedFetch, useMexicoAuth } from "@/auth/AuthProvider";
import { useLanguage } from "@/i18n/LanguageContext";
import { canonicalArtistHref } from "@/lib/artistRoutes.mjs";

type AccountPayload = {
  savedArtists: Array<{ artistKey: string; artistName: string; alertsEnabled: boolean }>;
  profile: null | {
    username: string;
    displayName: string | null;
    bio: string | null;
    accountType: "personal" | "artist_team" | "industry" | "media" | "research";
    isPublic: boolean;
    showRecentListening: boolean;
    showBadges: boolean;
  };
  connections: Array<{
    provider: "lastfm" | "spotify";
    externalUsername: string | null;
    connectedAt: string;
    lastSyncedAt: string | null;
  }>;
  connectionAvailability: { lastfm: boolean; spotify: boolean };
};

export default function Cuenta() {
  const auth = useMexicoAuth();
  const { pick } = useLanguage();
  const queryClient = useQueryClient();
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [accountType, setAccountType] = useState<AccountPayload["profile"] extends infer P ? P extends { accountType: infer T } ? T : never : never>("personal");
  const [lastfmUsername, setLastfmUsername] = useState("");
  const [formMessage, setFormMessage] = useState<string | null>(null);
  const { data, isLoading } = useQuery<AccountPayload>({
    queryKey: ["account", auth.userId],
    enabled: auth.configured && auth.isSignedIn,
    queryFn: async () => {
      const response = await authenticatedFetch(auth.getToken, "/api/account/me");
      if (!response.ok) throw new Error("Account unavailable");
      return response.json() as Promise<AccountPayload>;
    },
  });

  useEffect(() => {
    if (!data?.profile) return;
    setUsername(data.profile.username);
    setDisplayName(data.profile.displayName ?? "");
    setBio(data.profile.bio ?? "");
    setAccountType(data.profile.accountType ?? "personal");
  }, [data?.profile]);

  const saveProfile = useMutation({
    mutationFn: async () => {
      const response = await authenticatedFetch(auth.getToken, "/api/account/profile", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          username,
          displayName,
          bio,
          accountType,
          isPublic: data?.profile?.isPublic ?? false,
          showRecentListening: data?.profile?.showRecentListening ?? false,
          showBadges: data?.profile?.showBadges ?? true,
        }),
      });
      const payload = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(payload.error || "Unable to save profile");
    },
    onSuccess: async () => {
      setFormMessage(pick("Perfil guardado", "Profile saved"));
      await queryClient.invalidateQueries({ queryKey: ["account", auth.userId] });
    },
    onError: error => setFormMessage(error instanceof Error ? error.message : pick("No se pudo guardar", "Could not save")),
  });

  const connectLastfm = useMutation({
    mutationFn: async () => {
      const response = await authenticatedFetch(auth.getToken, "/api/account/connections/lastfm", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username: lastfmUsername }),
      });
      const payload = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(payload.error || "Unable to connect Last.fm");
    },
    onSuccess: async () => {
      setLastfmUsername("");
      setFormMessage(pick("Historial de Last.fm conectado", "Last.fm history connected"));
      await queryClient.invalidateQueries({ queryKey: ["account", auth.userId] });
    },
    onError: error => setFormMessage(error instanceof Error ? error.message : pick("No se pudo conectar Last.fm", "Could not connect Last.fm")),
  });

  const connectSpotify = useMutation({
    mutationFn: async () => {
      const response = await authenticatedFetch(auth.getToken, "/api/account/connections/spotify/start");
      const payload = await response.json().catch(() => ({})) as { authorizationUrl?: string; error?: string };
      if (!response.ok || !payload.authorizationUrl) throw new Error(payload.error || "Unable to connect Spotify");
      window.location.assign(payload.authorizationUrl);
    },
    onError: error => setFormMessage(error instanceof Error ? error.message : pick("No se pudo conectar Spotify", "Could not connect Spotify")),
  });

  const disconnect = useMutation({
    mutationFn: async (provider: string) => {
      const response = await authenticatedFetch(auth.getToken, `/api/account/connections/${provider}`, { method: "DELETE" });
      if (!response.ok) throw new Error("Unable to disconnect");
    },
    onSuccess: async () => {
      setFormMessage(pick("Conexión eliminada y acceso revocado en Mexico Charts", "Connection and Mexico Charts access removed"));
      await queryClient.invalidateQueries({ queryKey: ["account", auth.userId] });
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

            {formMessage && (
              <div className="mt-6 flex items-center gap-3 rounded-xl border border-[#39FF14]/20 bg-[#39FF14]/[0.06] px-4 py-3 text-xs text-white/65">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-[#39FF14]" />{formMessage}
              </div>
            )}

            <section className="mt-12 grid gap-5 lg:grid-cols-[1.05fr_.95fr]">
              <article className="rounded-3xl border border-white/[0.08] bg-white/[0.025] p-6 sm:p-8">
                <div className="flex items-start gap-4">
                  <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#39FF14]/10 text-[#39FF14]"><UserRound className="h-5 w-5" /></div>
                  <div><p className="text-[9px] font-black uppercase tracking-[0.2em] text-[#39FF14]">{pick("Perfil de cuenta", "Account profile")}</p><h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em]">{pick("Hazlo tuyo", "Make it yours")}</h2><p className="mt-2 text-sm leading-6 text-white/42">{pick("Una cuenta para fans, artistas, equipos y profesionales. Tu perfil permanece privado hasta que decidas publicarlo", "One account for fans, artists, teams and professionals. Your profile remains private until you choose to publish it")}</p></div>
                </div>
                <div className="mt-7 grid gap-4 sm:grid-cols-2">
                  <label className="text-[9px] font-black uppercase tracking-[0.15em] text-white/35">{pick("Usuario", "Username")}<input value={username} onChange={event => setUsername(event.target.value)} placeholder="regis" maxLength={30} className="mt-2 w-full rounded-xl border border-white/10 bg-black/35 px-4 py-3 text-sm font-medium normal-case tracking-normal text-white outline-none focus:border-[#39FF14]/50" /></label>
                  <label className="text-[9px] font-black uppercase tracking-[0.15em] text-white/35">{pick("Nombre visible", "Display name")}<input value={displayName} onChange={event => setDisplayName(event.target.value)} placeholder={auth.displayName ?? ""} maxLength={80} className="mt-2 w-full rounded-xl border border-white/10 bg-black/35 px-4 py-3 text-sm font-medium normal-case tracking-normal text-white outline-none focus:border-[#39FF14]/50" /></label>
                  <label className="text-[9px] font-black uppercase tracking-[0.15em] text-white/35 sm:col-span-2">{pick("¿Cómo usas Mexico Charts?", "How do you use Mexico Charts?")}<select value={accountType} onChange={event => setAccountType(event.target.value as typeof accountType)} className="mt-2 w-full rounded-xl border border-white/10 bg-[#090909] px-4 py-3 text-sm font-medium normal-case tracking-normal text-white outline-none focus:border-[#39FF14]/50"><option value="personal">{pick("Uso personal / fan", "Personal / fan")}</option><option value="artist_team">{pick("Artista o equipo de artista", "Artist or artist team")}</option><option value="industry">{pick("Industria musical", "Music industry")}</option><option value="media">{pick("Medios / prensa", "Media / press")}</option><option value="research">{pick("Investigación / educación", "Research / education")}</option></select><span className="mt-2 block text-[9px] font-medium normal-case tracking-normal text-white/25">{pick("Opcional y editable. No cambia tu acceso ni exige verificación", "Optional and editable. It does not change access or require verification")}</span></label>
                  <label className="text-[9px] font-black uppercase tracking-[0.15em] text-white/35 sm:col-span-2">Bio<textarea value={bio} onChange={event => setBio(event.target.value)} placeholder={pick("Cuéntanos sobre tu relación con la música", "Tell us about your connection to music")} maxLength={280} rows={3} className="mt-2 w-full resize-none rounded-xl border border-white/10 bg-black/35 px-4 py-3 text-sm font-medium normal-case tracking-normal text-white outline-none focus:border-[#39FF14]/50" /></label>
                </div>
                <div className="mt-5 flex flex-wrap items-center justify-between gap-4"><p className="flex items-center gap-2 text-[9px] text-white/32"><ShieldCheck className="h-4 w-4 text-[#39FF14]" />{pick("Privado por defecto", "Private by default")}</p><button type="button" disabled={saveProfile.isPending || username.length < 3} onClick={() => saveProfile.mutate()} className="rounded-full bg-[#39FF14] px-6 py-3 text-[9px] font-black uppercase tracking-[0.16em] text-black disabled:cursor-not-allowed disabled:opacity-35">{saveProfile.isPending ? pick("Guardando…", "Saving…") : pick("Guardar perfil", "Save profile")}</button></div>
              </article>

              <article className="rounded-3xl border border-white/[0.08] bg-[radial-gradient(circle_at_top_right,rgba(57,255,20,.08),transparent_42%)] p-6 sm:p-8">
                <div className="flex items-start gap-4"><div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-white/[0.05] text-[#39FF14]"><Activity className="h-5 w-5" /></div><div><p className="text-[9px] font-black uppercase tracking-[0.2em] text-[#39FF14]">{pick("Tu historial musical", "Your music history")}</p><h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em]">{pick("Conecta tus escuchas", "Connect your listening")}</h2><p className="mt-2 text-sm leading-6 text-white/42">{pick("Cada conexión es opcional y puede eliminarse cuando quieras", "Every connection is optional and can be removed whenever you want")}</p></div></div>
                <div className="mt-7 space-y-3">
                  {[{ provider: "lastfm" as const, name: "Last.fm", icon: Radio }, { provider: "spotify" as const, name: "Spotify", icon: Music2 }].map(item => {
                    const connection = data?.connections.find(current => current.provider === item.provider);
                    const available = data?.connectionAvailability?.[item.provider];
                    const Icon = item.icon;
                    return <div key={item.provider} className="rounded-2xl border border-white/[0.08] bg-black/30 p-4"><div className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-xl bg-white/[0.05]"><Icon className="h-4 w-4 text-[#39FF14]" /></div><div className="min-w-0 flex-1"><p className="font-semibold">{item.name}</p><p className="truncate text-[10px] text-white/35">{connection ? `${pick("Conectado como", "Connected as")} ${connection.externalUsername}` : available ? pick("Listo para conectar", "Ready to connect") : pick("Configuración final pendiente", "Final configuration pending")}</p></div>{connection && <span className="rounded-full bg-[#39FF14]/10 px-2.5 py-1 text-[8px] font-black uppercase tracking-[0.12em] text-[#39FF14]">{pick("Conectado", "Connected")}</span>}</div>
                      {connection ? <button type="button" onClick={() => disconnect.mutate(item.provider)} className="mt-4 text-[8px] font-black uppercase tracking-[0.14em] text-white/30 hover:text-white">{pick("Desconectar", "Disconnect")}</button> : item.provider === "lastfm" ? <div className="mt-4 flex gap-2"><input value={lastfmUsername} onChange={event => setLastfmUsername(event.target.value)} disabled={!available} placeholder={pick("Tu usuario de Last.fm", "Your Last.fm username")} className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black/40 px-3 py-2.5 text-xs text-white outline-none focus:border-[#39FF14]/40 disabled:opacity-35" /><button type="button" disabled={!available || !lastfmUsername || connectLastfm.isPending} onClick={() => connectLastfm.mutate()} className="rounded-xl border border-white/10 px-4 text-[8px] font-black uppercase tracking-[0.12em] text-white/60 disabled:opacity-30">{pick("Conectar", "Connect")}</button></div> : <button type="button" disabled={!available || connectSpotify.isPending} onClick={() => connectSpotify.mutate()} className="mt-4 inline-flex items-center gap-2 rounded-xl border border-white/10 px-4 py-2.5 text-[8px] font-black uppercase tracking-[0.12em] text-white/60 disabled:opacity-30">{pick("Conectar Spotify", "Connect Spotify")}<ExternalLink className="h-3 w-3" /></button>}
                    </div>;
                  })}
                </div>
                <p className="mt-5 text-[9px] leading-5 text-white/28">{pick("Spotify aporta actividad reciente y afinidad. Last.fm es la fuente recomendada para un historial de scrobbles más amplio. Mexico Charts no publica escuchas individuales sin tu permiso", "Spotify provides recent activity and affinity. Last.fm is recommended for broader scrobble history. Mexico Charts does not publish individual listens without your permission")}</p>
              </article>
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
