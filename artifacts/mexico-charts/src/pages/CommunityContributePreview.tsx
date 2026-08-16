import { type FormEvent, useMemo, useState } from "react";
import {
  ArrowRight,
  BadgeCheck,
  Check,
  ChevronDown,
  CircleHelp,
  ExternalLink,
  Flag,
  Link2,
  Music2,
  Plus,
  Search,
  ShieldCheck,
  Sparkles,
  UserRoundPlus,
} from "lucide-react";
import SiteNav from "@/components/SiteNav";
import PageSEO from "@/components/PageSEO";

const G = "#39FF14";

const platforms = [
  { name: "Spotify", handle: "open.spotify.com/artist/2nszmSgqreHSdJA3zWPyrW", status: "Verificado", color: "#1ed760" },
  { name: "YouTube", handle: "youtube.com/@luismiguel", status: "Verificado", color: "#ff3b30" },
  { name: "Apple Music", handle: "music.apple.com/mx/artist/luis-miguel/336904", status: "Verificado", color: "#fa596f" },
  { name: "Instagram", handle: "instagram.com/luismiguel", status: "Revisar", color: "#ff4f9a" },
] as const;

type Mode = "correct" | "request";

function PlatformMark({ color }: { color: string }) {
  return <span className="h-2.5 w-2.5 rounded-full shadow-[0_0_16px_currentColor]" style={{ background: color, color }} />;
}

export default function CommunityContributePreview() {
  const [mode, setMode] = useState<Mode>("correct");
  const [link, setLink] = useState("");
  const query = useMemo(() => new URLSearchParams(window.location.search), []);
  const artistKey = query.get("artist")?.trim() ?? "";
  const selectedArtistName = query.get("name")?.trim() || (artistKey ? artistKey.replace(/[-_]+/g, " ").replace(/\b\w/g, letter => letter.toUpperCase()) : "Luis Miguel");
  const [requestName, setRequestName] = useState("");
  const [requestPrimaryLink, setRequestPrimaryLink] = useState("");
  const [requestSecondaryLink, setRequestSecondaryLink] = useState("");
  const [requestConnection, setRequestConnection] = useState("Artista mexicano/a");
  const [requestContext, setRequestContext] = useState("");
  const [submitState, setSubmitState] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [submitMessage, setSubmitMessage] = useState("");
  const detected = useMemo(() => {
    const value = link.toLowerCase();
    if (value.includes("spotify")) return "Spotify";
    if (value.includes("youtube") || value.includes("youtu.be")) return "YouTube";
    if (value.includes("instagram")) return "Instagram";
    if (value.includes("tiktok")) return "TikTok";
    if (value.includes("music.apple")) return "Apple Music";
    return null;
  }, [link]);

  async function sendContribution(payload: Record<string, string>) {
    setSubmitState("loading");
    setSubmitMessage("");
    try {
      const response = await fetch("/api/community/contributions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "No pudimos guardar el aporte");
      setSubmitState("success");
      setSubmitMessage("Gracias. Tu aporte ya está en la cola de revisión");
    } catch (error) {
      setSubmitState("error");
      setSubmitMessage(error instanceof Error ? error.message : "No pudimos guardar el aporte");
    }
  }

  async function submitCorrection() {
    await sendContribution({ type: "correction", artistKey, artistName: selectedArtistName, link });
    setLink("");
  }

  async function submitArtistRequest(event: FormEvent) {
    event.preventDefault();
    await sendContribution({
      type: "artist_request",
      artistName: requestName,
      link: requestPrimaryLink,
      secondaryLink: requestSecondaryLink,
      mexicoConnection: requestConnection,
      context: requestContext,
    });
  }

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#050505] text-white">
      <PageSEO title="Contribuye — Corrige perfiles y solicita artistas | Mexico Charts" description="Ayuda a Mexico Charts a verificar enlaces oficiales, corregir perfiles y priorizar nuevos artistas relacionados con la música mexicana." path="/contribuir" />
      <SiteNav />

      <main className="relative isolate">
        <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[540px] bg-[radial-gradient(circle_at_18%_10%,rgba(57,255,20,.16),transparent_34%),radial-gradient(circle_at_86%_16%,rgba(35,92,255,.10),transparent_30%)]" />
        <div className="pointer-events-none absolute inset-0 -z-20 opacity-[.035] [background-image:linear-gradient(rgba(255,255,255,.12)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.12)_1px,transparent_1px)] [background-size:48px_48px]" />

        <section className="mx-auto max-w-7xl px-5 pb-10 pt-10 sm:px-8 lg:px-10 lg:pb-16 lg:pt-16">
          <div className="grid gap-10 lg:grid-cols-[1.05fr_.95fr] lg:items-end">
            <div>
              <div className="mb-5 flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-[#39FF14]/25 bg-[#39FF14]/10 px-2.5 py-1.5 text-[8px] font-black uppercase tracking-[.17em] text-[#39FF14] sm:px-3 sm:text-[9px] sm:tracking-[.2em]">Comunidad Mexico Charts</span>
                <span className="rounded-full border border-white/10 bg-white/[.035] px-2.5 py-1.5 text-[8px] font-black uppercase tracking-[.15em] text-white/45 sm:px-3 sm:text-[9px] sm:tracking-[.18em]">Aportes de la comunidad</span>
              </div>
              <h1 className="max-w-3xl font-black uppercase leading-[.9] tracking-[-.05em] text-white text-[clamp(2.55rem,6vw,5.8rem)]">
                Ayúdanos a<br /><span className="text-[#39FF14]">hacerlo mejor</span>
              </h1>
              <p className="mt-6 max-w-2xl text-base font-medium leading-7 text-white/52 sm:text-lg">
                Los fans conocen a sus artistas mejor que nadie. Comparte enlaces oficiales, corrige datos o solicita un perfil nuevo. Cada aporte pasa por revisión editorial.
              </p>
            </div>

            <div className="grid grid-cols-3 overflow-hidden rounded-3xl border border-white/[.08] bg-black/45 backdrop-blur-xl">
              {[
                ["529", "artistas activos"],
                ["100%", "revisión humana"],
                ["0", "cambios automáticos"],
              ].map(([number, label], index) => (
                <div key={label} className={`p-5 sm:p-7 ${index ? "border-l border-white/[.07]" : ""}`}>
                  <div className="text-2xl font-black tracking-tight text-white sm:text-3xl">{number}</div>
                  <div className="mt-2 text-[8px] font-black uppercase leading-4 tracking-[.16em] text-white/32">{label}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto grid max-w-7xl gap-6 px-5 pb-24 sm:px-8 lg:grid-cols-[minmax(0,1.45fr)_minmax(320px,.55fr)] lg:px-10">
          <div className="overflow-hidden rounded-[28px] border border-white/[.09] bg-[#090909]/95 shadow-[0_40px_120px_rgba(0,0,0,.55)]">
            <div className="grid grid-cols-2 border-b border-white/[.08] bg-white/[.018] p-2">
              <button type="button" onClick={() => setMode("correct")} className={`flex items-center justify-center gap-2 rounded-2xl px-4 py-4 text-[10px] font-black uppercase tracking-[.15em] transition ${mode === "correct" ? "bg-[#39FF14] text-black" : "text-white/38 hover:bg-white/[.04] hover:text-white"}`}>
                <Flag className="h-4 w-4" /> Corregir un perfil
              </button>
              <button type="button" onClick={() => setMode("request")} className={`flex items-center justify-center gap-2 rounded-2xl px-4 py-4 text-[10px] font-black uppercase tracking-[.15em] transition ${mode === "request" ? "bg-[#39FF14] text-black" : "text-white/38 hover:bg-white/[.04] hover:text-white"}`}>
                <UserRoundPlus className="h-4 w-4" /> Solicitar artista
              </button>
            </div>

            <div className="p-5 sm:p-8 lg:p-10">
              {mode === "correct" ? (
                <>
                  <div className="flex flex-col gap-5 border-b border-white/[.07] pb-8 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-4">
                      {selectedArtistName === "Luis Miguel" ? <img src="https://i.scdn.co/image/ab676161000051746481401e529e475116702a29" alt={selectedArtistName} className="h-16 w-16 rounded-2xl object-cover ring-1 ring-white/10" /> : <div className="grid h-16 w-16 place-items-center rounded-2xl bg-[#39FF14]/10 text-xl font-black text-[#39FF14] ring-1 ring-[#39FF14]/20">{selectedArtistName.charAt(0)}</div>}
                      <div>
                        <div className="flex items-center gap-2 text-xl font-black uppercase tracking-tight">{selectedArtistName} <BadgeCheck className="h-5 w-5 text-[#39FF14]" /></div>
                        <div className="mt-1 text-[9px] font-black uppercase tracking-[.16em] text-white/32">Perfil seleccionado · Mexico Charts</div>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <span className="flex items-center gap-2 rounded-xl border border-[#39FF14]/25 bg-[#39FF14]/[.07] px-4 py-3 text-[9px] font-black uppercase tracking-[.14em] text-[#39FF14]">
                        <Flag className="h-3.5 w-3.5" /> Editar perfil
                      </span>
                      <button type="button" className="flex items-center gap-2 self-start rounded-xl border border-white/10 px-4 py-3 text-[9px] font-black uppercase tracking-[.14em] text-white/45 transition hover:border-[#39FF14]/35 hover:text-[#39FF14]">
                        Cambiar artista <Search className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="pt-8">
                    <div className="flex items-start justify-between gap-5">
                      <div>
                        <h2 className="text-xl font-black uppercase tracking-tight sm:text-2xl">Envía cualquier enlace oficial</h2>
                        <p className="mt-2 text-sm leading-6 text-white/42">Detectamos la plataforma automáticamente y la comparamos con el perfil actual.</p>
                      </div>
                      <Sparkles className="mt-1 h-5 w-5 shrink-0 text-[#39FF14]" />
                    </div>

                    <div className="mt-6 rounded-2xl border border-white/[.09] bg-black/55 p-2 focus-within:border-[#39FF14]/45 focus-within:shadow-[0_0_0_3px_rgba(57,255,20,.06)]">
                      <div className="flex flex-col gap-2 sm:flex-row">
                        <div className="flex min-w-0 flex-1 items-center gap-3 px-3">
                          <Link2 className="h-4 w-4 shrink-0 text-white/25" />
                          <input value={link} onChange={(event) => setLink(event.target.value)} placeholder="Pega Spotify, YouTube, Instagram, TikTok…" className="h-12 min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-white/22" />
                          {detected && <span className="hidden rounded-lg bg-[#39FF14]/10 px-2 py-1 text-[8px] font-black uppercase tracking-[.14em] text-[#39FF14] sm:block">{detected}</span>}
                        </div>
                        <button type="button" onClick={submitCorrection} disabled={!link.trim() || submitState === "loading"} className="flex h-12 items-center justify-center gap-2 rounded-xl bg-[#39FF14] px-5 text-[9px] font-black uppercase tracking-[.15em] text-black transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-40">
                          Revisar enlace <ArrowRight className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>

                    {submitMessage && <p className={`mt-4 text-xs font-bold ${submitState === "success" ? "text-[#39FF14]" : "text-red-400"}`}>{submitMessage}</p>}
                    {selectedArtistName === "Luis Miguel" && <><div className="mt-8 flex items-center justify-between">
                      <h3 className="text-[10px] font-black uppercase tracking-[.18em] text-white/55">Enlaces del perfil</h3>
                      <button type="button" className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-[.14em] text-[#39FF14]">Todos <ChevronDown className="h-3.5 w-3.5" /></button>
                    </div>
                    <div className="mt-3 divide-y divide-white/[.06] overflow-hidden rounded-2xl border border-white/[.07]">
                      {platforms.map((platform) => (
                        <button type="button" key={platform.name} className="group grid w-full gap-3 bg-white/[.012] p-4 text-left transition hover:bg-white/[.035] sm:grid-cols-[150px_minmax(0,1fr)_auto] sm:items-center">
                          <div className="flex items-center gap-3"><PlatformMark color={platform.color} /><span className="text-xs font-black uppercase tracking-[.08em]">{platform.name}</span></div>
                          <span className="truncate text-xs text-white/35">{platform.handle}</span>
                          <span className={`flex items-center gap-1.5 text-[8px] font-black uppercase tracking-[.13em] ${platform.status === "Verificado" ? "text-[#39FF14]" : "text-amber-300"}`}>{platform.status === "Verificado" && <Check className="h-3 w-3" />}{platform.status}<ExternalLink className="ml-1 h-3 w-3 opacity-0 transition group-hover:opacity-70" /></span>
                        </button>
                      ))}
                    </div>
                    </>}
                  </div>
                </>
              ) : (
                <div>
                  <div className="mb-8 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#39FF14]/10 text-[#39FF14] ring-1 ring-[#39FF14]/20"><Music2 className="h-6 w-6" /></div>
                  <h2 className="text-3xl font-black uppercase tracking-[-.03em] sm:text-4xl">¿A quién nos falta?</h2>
                  <p className="mt-3 max-w-xl text-sm leading-6 text-white/45">Tu solicitud nos ayuda a priorizar qué artistas revisar y cuáles agregar al próximo lote de datos.</p>
                  <form onSubmit={submitArtistRequest}>
                    <div className="mt-8 grid gap-4 sm:grid-cols-2">
                      <label className="sm:col-span-2"><span className="mb-2 block text-[9px] font-black uppercase tracking-[.16em] text-white/38">Nombre del artista *</span><input required value={requestName} onChange={event => setRequestName(event.target.value)} placeholder="Ej. Gera MX" className="h-14 w-full rounded-xl border border-white/[.09] bg-white/[.025] px-4 text-sm outline-none transition placeholder:text-white/20 focus:border-[#39FF14]/45" /></label>
                      <label><span className="mb-2 block text-[9px] font-black uppercase tracking-[.16em] text-white/38">Spotify o Apple Music</span><input type="url" value={requestPrimaryLink} onChange={event => setRequestPrimaryLink(event.target.value)} placeholder="Enlace oficial" className="h-14 w-full rounded-xl border border-white/[.09] bg-white/[.025] px-4 text-sm outline-none transition placeholder:text-white/20 focus:border-[#39FF14]/45" /></label>
                      <label><span className="mb-2 block text-[9px] font-black uppercase tracking-[.16em] text-white/38">YouTube o red social</span><input type="url" value={requestSecondaryLink} onChange={event => setRequestSecondaryLink(event.target.value)} placeholder="Enlace oficial" className="h-14 w-full rounded-xl border border-white/[.09] bg-white/[.025] px-4 text-sm outline-none transition placeholder:text-white/20 focus:border-[#39FF14]/45" /></label>
                      <label className="sm:col-span-2"><span className="mb-2 block text-[9px] font-black uppercase tracking-[.16em] text-white/38">Conexión con la música mexicana *</span><select value={requestConnection} onChange={event => setRequestConnection(event.target.value)} className="h-14 w-full rounded-xl border border-white/[.09] bg-[#0c0c0c] px-4 text-sm text-white/65 outline-none focus:border-[#39FF14]/45"><option>Artista mexicano/a</option><option>Herencia mexicana</option><option>Interpreta música mexicana</option><option>Colaboración o vínculo relevante</option></select></label>
                      <label className="sm:col-span-2"><span className="mb-2 block text-[9px] font-black uppercase tracking-[.16em] text-white/38">Cuéntanos por qué debería estar</span><textarea rows={4} value={requestContext} onChange={event => setRequestContext(event.target.value)} placeholder="Contexto, logros recientes o fuentes…" className="w-full resize-none rounded-xl border border-white/[.09] bg-white/[.025] p-4 text-sm outline-none transition placeholder:text-white/20 focus:border-[#39FF14]/45" /></label>
                    </div>
                    {submitMessage && <p className={`mt-4 text-xs font-bold ${submitState === "success" ? "text-[#39FF14]" : "text-red-400"}`}>{submitMessage}</p>}
                    <button type="submit" disabled={!requestName.trim() || submitState === "loading"} className="mt-6 flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-[#39FF14] text-[10px] font-black uppercase tracking-[.16em] text-black transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-40">Enviar solicitud <ArrowRight className="h-4 w-4" /></button>
                  </form>
                </div>
              )}
            </div>
          </div>

          <aside className="space-y-5">
            <div className="rounded-[28px] border border-[#39FF14]/20 bg-[linear-gradient(145deg,rgba(57,255,20,.10),rgba(8,8,8,.96)_48%)] p-6 sm:p-8">
              <ShieldCheck className="h-7 w-7 text-[#39FF14]" />
              <h2 className="mt-7 text-2xl font-black uppercase leading-none tracking-tight">Tú propones<br />Nosotros verificamos</h2>
              <div className="mt-7 space-y-5">
                {[
                  ["01", "Recibimos el aporte", "Guardamos el enlace o la corrección enviada"],
                  ["02", "Comprobamos la fuente", "Confirmamos que la información sea oficial y corresponda al artista"],
                  ["03", "Actualizamos si es correcto", "El cambio aprobado se incorpora al perfil"],
                ].map(([number, title, description]) => <div key={number} className="flex gap-4"><span className="text-[9px] font-black tracking-[.15em] text-[#39FF14]">{number}</span><div><div className="text-xs font-black uppercase tracking-[.08em]">{title}</div><div className="mt-1 text-xs leading-5 text-white/34">{description}</div></div></div>)}
              </div>
              <div className="mt-7 border-t border-white/[.08] pt-5 text-[9px] font-black uppercase leading-5 tracking-[.14em] text-white/30">
                Cada aporte pasa por revisión editorial
              </div>
            </div>

            <div className="rounded-[28px] border border-white/[.08] bg-white/[.025] p-6 sm:p-8">
              <div className="flex items-center gap-3"><CircleHelp className="h-5 w-5 text-white/40" /><h3 className="text-xs font-black uppercase tracking-[.14em]">¿Qué ayuda más?</h3></div>
              <ul className="mt-5 space-y-3 text-xs leading-5 text-white/42">
                <li className="flex gap-3"><Plus className="mt-1 h-3 w-3 shrink-0 text-[#39FF14]" /> Enlaces a cuentas oficiales</li>
                <li className="flex gap-3"><Plus className="mt-1 h-3 w-3 shrink-0 text-[#39FF14]" /> Fuentes públicas que confirmen identidad</li>
                <li className="flex gap-3"><Plus className="mt-1 h-3 w-3 shrink-0 text-[#39FF14]" /> Contexto sobre su conexión con México</li>
              </ul>
            </div>
          </aside>
        </section>
      </main>
    </div>
  );
}
