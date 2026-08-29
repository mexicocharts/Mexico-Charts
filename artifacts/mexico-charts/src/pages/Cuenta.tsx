import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { Bell, Bookmark, CheckCircle2, ChevronRight, LogOut, ShieldCheck, Sparkles, UserRound } from "lucide-react";
import SiteNav from "@/components/SiteNav";
import PageSEO from "@/components/PageSEO";
import { authenticatedFetch, useMexicoAuth } from "@/auth/AuthProvider";
import { useLanguage } from "@/i18n/LanguageContext";
import { canonicalArtistHref } from "@/lib/artistRoutes.mjs";

type AccountPayload = {
  plan: string;
  subscriptionStatus: string | null;
  savedArtists: Array<{ artistKey: string; artistName: string; alertsEnabled: boolean }>;
  monitoringSubscriptions: Array<{ stripeSubscriptionId: string; artistKey: string; artistName: string; status: string }>;
  profile: null | {
    username: string;
    displayName: string | null;
    bio: string | null;
    accountType: "personal" | "artist_team" | "industry" | "media" | "research";
    isPublic: boolean;
    showRecentListening: boolean;
    showBadges: boolean;
  };
};

export default function Cuenta() {
  const auth = useMexicoAuth();
  const { pick } = useLanguage();
  const queryClient = useQueryClient();
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
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
          accountType: "personal",
          isPublic: false,
          showRecentListening: false,
          showBadges: false,
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
                <h1 className="mt-3 text-4xl font-semibold tracking-[-0.05em] sm:text-5xl">{pick("Mi cuenta fan", "My fan account")}</h1>
                <p className="mt-3 text-sm text-white/45">{auth.displayName}</p>
              </div>
              <button onClick={() => void auth.signOut()} className="inline-flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.16em] text-white/40 hover:text-white"><LogOut className="h-4 w-4" />{pick("Cerrar sesión", "Sign out")}</button>
            </header>

            <section className="mt-10 grid gap-4 sm:grid-cols-3">
              <article className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-6"><Bookmark className="h-5 w-5 text-[#39FF14]" /><p className="mt-5 text-3xl font-semibold">{data?.savedArtists.length ?? 0}</p><p className="mt-1 text-[9px] font-black uppercase tracking-[0.18em] text-white/35">{pick("Artistas guardados", "Saved artists")}</p></article>
              <article className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-6"><Bell className="h-5 w-5 text-[#39FF14]" /><p className="mt-5 text-3xl font-semibold">{data?.savedArtists.filter(a => a.alertsEnabled).length ?? 0}</p><p className="mt-1 text-[9px] font-black uppercase tracking-[0.18em] text-white/35">{pick("Alertas activas", "Active alerts")}</p></article>
              <article className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-6"><Sparkles className="h-5 w-5 text-[#39FF14]" /><p className="mt-5 text-3xl font-semibold">{data?.monitoringSubscriptions.filter(item => item.status === "active" || item.status === "trialing").length ?? 0}</p><p className="mt-1 text-[9px] font-black uppercase tracking-[0.18em] text-white/35">{pick("Monitoreos activos", "Active monitoring")}</p></article>
            </section>

            {!!data?.monitoringSubscriptions.length && (
              <section className="mt-8 overflow-hidden rounded-2xl border border-[#39FF14]/15 bg-[#39FF14]/[0.035]">
                <div className="border-b border-white/[0.06] px-5 py-4"><p className="text-[9px] font-black uppercase tracking-[0.2em] text-[#39FF14]">Mexico Charts Monitor</p></div>
                {data.monitoringSubscriptions.map(item => (
                  <Link key={item.stripeSubscriptionId} href={canonicalArtistHref(item.artistKey) ?? "/artists"} className="flex items-center justify-between border-b border-white/[0.06] px-5 py-4 last:border-0 hover:bg-white/[0.025]"><span><strong className="block text-sm">{item.artistName}</strong><span className="mt-1 block text-[9px] font-black uppercase tracking-[0.14em] text-white/35">{item.status}</span></span><ChevronRight className="h-4 w-4 text-[#39FF14]" /></Link>
                ))}
              </section>
            )}

            {formMessage && (
              <div className="mt-6 flex items-center gap-3 rounded-xl border border-[#39FF14]/20 bg-[#39FF14]/[0.06] px-4 py-3 text-xs text-white/65">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-[#39FF14]" />{formMessage}
              </div>
            )}

            <section className="mt-12">
              <article className="rounded-3xl border border-white/[0.08] bg-white/[0.025] p-6 sm:p-8">
                <div className="flex items-start gap-4">
                  <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#39FF14]/10 text-[#39FF14]"><UserRound className="h-5 w-5" /></div>
                  <div><p className="text-[9px] font-black uppercase tracking-[0.2em] text-[#39FF14]">{pick("Cuenta fan", "Fan account")}</p><h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em]">{pick("Hazla tuya", "Make it yours")}</h2><p className="mt-2 text-sm leading-6 text-white/42">{pick("Tu espacio privado para guardar artistas, administrar alertas y conservar tus preferencias en Mexico Charts", "Your private space to save artists, manage alerts, and keep your Mexico Charts preferences")}</p></div>
                </div>
                <div className="mt-7 grid gap-4 sm:grid-cols-2">
                  <label className="text-[9px] font-black uppercase tracking-[0.15em] text-white/35">{pick("Usuario", "Username")}<input value={username} onChange={event => setUsername(event.target.value)} placeholder="regis" maxLength={30} className="mt-2 w-full rounded-xl border border-white/10 bg-black/35 px-4 py-3 text-sm font-medium normal-case tracking-normal text-white outline-none focus:border-[#39FF14]/50" /></label>
                  <label className="text-[9px] font-black uppercase tracking-[0.15em] text-white/35">{pick("Nombre visible", "Display name")}<input value={displayName} onChange={event => setDisplayName(event.target.value)} placeholder={auth.displayName ?? ""} maxLength={80} className="mt-2 w-full rounded-xl border border-white/10 bg-black/35 px-4 py-3 text-sm font-medium normal-case tracking-normal text-white outline-none focus:border-[#39FF14]/50" /></label>
                  <label className="text-[9px] font-black uppercase tracking-[0.15em] text-white/35 sm:col-span-2">Bio<textarea value={bio} onChange={event => setBio(event.target.value)} placeholder={pick("Cuéntanos sobre tu relación con la música", "Tell us about your connection to music")} maxLength={280} rows={3} className="mt-2 w-full resize-none rounded-xl border border-white/10 bg-black/35 px-4 py-3 text-sm font-medium normal-case tracking-normal text-white outline-none focus:border-[#39FF14]/50" /></label>
                </div>
                <div className="mt-5 flex flex-wrap items-center justify-between gap-4"><p className="flex items-center gap-2 text-[9px] text-white/32"><ShieldCheck className="h-4 w-4 text-[#39FF14]" />{pick("Privado por defecto", "Private by default")}</p><button type="button" disabled={saveProfile.isPending || username.length < 3} onClick={() => saveProfile.mutate()} className="rounded-full bg-[#39FF14] px-6 py-3 text-[9px] font-black uppercase tracking-[0.16em] text-black disabled:cursor-not-allowed disabled:opacity-35">{saveProfile.isPending ? pick("Guardando…", "Saving…") : pick("Guardar perfil", "Save profile")}</button></div>
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
