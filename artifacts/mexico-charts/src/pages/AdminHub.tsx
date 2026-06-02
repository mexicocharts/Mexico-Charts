import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { ArrowLeft, BarChart3, CheckSquare, Download, ExternalLink, KeyRound, Mail, RadioTower, RefreshCw, Search } from "lucide-react";
import PageSEO from "@/components/PageSEO";

const logoUrl = `${import.meta.env.BASE_URL}mexico-charts-logo.png`;

const tools = [
  {
    title: "Cobertura API",
    description: "Estado de YouTube, Spotify, MusicBrainz, Deezer, Ticketmaster y Kworb.",
    href: "/admin/api-coverage",
    icon: <BarChart3 className="h-5 w-5" />,
    status: "Activo",
  },
  {
    title: "Cola de revisión",
    description: "Filtrar, copiar, aprobar o rechazar coincidencias de Spotify y MusicBrainz.",
    href: "/admin/enrichment-review",
    icon: <CheckSquare className="h-5 w-5" />,
    status: "Activo",
  },
  {
    title: "Descubrimiento",
    description: "Revisar artistas desconocidos detectados en snapshots de charts.",
    href: "/admin/discovery-review",
    icon: <Search className="h-5 w-5" />,
    status: "Activo",
  },
  {
    title: "Social Studio",
    description: "Crear templates sociales editables y exportarlos como PNG.",
    href: "/admin/social-templates",
    icon: <Download className="h-5 w-5" />,
    status: "Nuevo",
  },
  {
    title: "Touring desk",
    description: "Espacio reservado para alertas de giras y nuevos conciertos.",
    href: "/touring",
    icon: <RadioTower className="h-5 w-5" />,
    status: "Próximo",
  },
];

interface NewsletterSubscriber {
  email: string;
  source: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

interface NewsletterResponse {
  generatedAt: string;
  total: number;
  sources: Record<string, number>;
  subscribers: NewsletterSubscriber[];
}

function csvEscape(value: string | number | null | undefined) {
  const raw = String(value ?? "");
  return /[",\n]/.test(raw) ? `"${raw.replace(/"/g, '""')}"` : raw;
}

function sourceLabel(source: string) {
  if (source === "home") return "Home";
  if (source === "touring") return "Touring";
  return source || "Site";
}

export default function AdminHub() {
  const [adminKey, setAdminKey] = useState(() => localStorage.getItem("mexicocharts_admin_key") ?? "");
  const [draftKey, setDraftKey] = useState(adminKey);
  const [newsletter, setNewsletter] = useState<NewsletterResponse | null>(null);
  const [newsletterLoading, setNewsletterLoading] = useState(false);
  const [newsletterError, setNewsletterError] = useState("");
  const unlocked = Boolean(adminKey.trim());
  const sourceEntries = useMemo(() => Object.entries(newsletter?.sources ?? {}).sort((a, b) => b[1] - a[1]), [newsletter]);

  function saveKey() {
    const next = draftKey.trim();
    if (!next) {
      clearKey();
      return;
    }
    localStorage.setItem("mexicocharts_admin_key", next);
    setAdminKey(next);
  }

  function clearKey() {
    localStorage.removeItem("mexicocharts_admin_key");
    setAdminKey("");
    setDraftKey("");
    setNewsletter(null);
    setNewsletterError("");
  }

  async function loadNewsletter(key = adminKey) {
    if (!key.trim()) return;
    setNewsletterLoading(true);
    setNewsletterError("");
    try {
      const res = await fetch("/api/admin/newsletter/subscribers", {
        headers: { "X-Admin-Key": key.trim() },
      });
      if (!res.ok) throw new Error(res.status === 403 ? "Clave de admin inválida." : "No se pudo cargar newsletter.");
      setNewsletter(await res.json());
    } catch (error) {
      setNewsletterError(error instanceof Error ? error.message : "No se pudo cargar newsletter.");
    } finally {
      setNewsletterLoading(false);
    }
  }

  function exportNewsletterCsv() {
    const rows = newsletter?.subscribers ?? [];
    if (!rows.length) return;
    const csv = [
      ["email", "source", "status", "created_at", "updated_at"].join(","),
      ...rows.map(row => [
        csvEscape(row.email),
        csvEscape(row.source),
        csvEscape(row.status),
        csvEscape(row.createdAt),
        csvEscape(row.updatedAt),
      ].join(",")),
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `mexico-charts-newsletter-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  useEffect(() => {
    if (unlocked) void loadNewsletter(adminKey);
  }, [unlocked, adminKey]);

  return (
    <div className="min-h-[100dvh] bg-[#050505] text-zinc-200">
      <PageSEO
        title="Admin | Mexico Charts"
        description="Panel interno de herramientas para Mexico Charts."
        path="/admin"
        noindex
      />

      <nav className="sticky top-0 z-40 border-b border-white/[0.06] bg-[#050505]/95 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-[1200px] items-center gap-4 px-6">
          <Link href="/" className="shrink-0">
            <img src={logoUrl} alt="Mexico Charts" className="h-7 object-contain opacity-90" />
          </Link>
          <div className="h-5 w-px bg-white/10" />
          <Link href="/" className="inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-[0.18em] text-zinc-500 hover:text-zinc-200">
            <ArrowLeft className="h-3.5 w-3.5" />
            Volver
          </Link>
        </div>
      </nav>

      <main className="mx-auto flex max-w-[1200px] flex-col gap-8 px-6 py-10">
        <header>
          <p className="text-[10px] font-black uppercase tracking-[0.28em] text-[#39FF14]">Mexico Charts</p>
          <h1 className="mt-2 text-3xl font-black uppercase tracking-tight text-white md:text-5xl">Admin</h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-zinc-500">
            Herramientas internas para revisar cobertura, datos y flujos de enriquecimiento.
          </p>
          {unlocked && (
            <button
              type="button"
              onClick={clearKey}
              className="mt-4 inline-flex h-9 items-center gap-2 rounded-lg border border-white/10 px-3 text-[10px] font-black uppercase tracking-[0.16em] text-zinc-500 hover:text-white"
            >
              <KeyRound className="h-3.5 w-3.5" />
              Cambiar clave
            </button>
          )}
        </header>

        {!unlocked ? (
          <section className="max-w-xl rounded-lg border border-white/[0.07] bg-[#0b0b0b] p-5">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#39FF14]/10 text-[#39FF14]">
                <KeyRound className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-black uppercase tracking-[0.08em] text-white">Acceso admin</h2>
                <p className="text-xs font-bold text-zinc-600">Usa la misma clave de los paneles internos.</p>
              </div>
            </div>
            <div className="flex gap-2">
              <input
                value={draftKey}
                onChange={e => setDraftKey(e.target.value)}
                type="password"
                placeholder="Clave admin"
                className="h-11 min-w-0 flex-1 rounded-lg border border-white/10 bg-white/[0.03] px-3 text-sm font-bold text-white outline-none placeholder:text-zinc-700 focus:border-[#39FF14]/50"
              />
              <button
                type="button"
                onClick={saveKey}
                className="h-11 rounded-lg border border-[#39FF14]/35 bg-[#39FF14]/10 px-4 text-[11px] font-black uppercase tracking-[0.16em] text-[#39FF14] hover:bg-[#39FF14]/16"
              >
                Entrar
              </button>
            </div>
          </section>
        ) : (
          <>
            <section className="grid gap-4 md:grid-cols-3">
              {tools.map(tool => (
                <Link key={tool.href} href={tool.href}>
                  <article className="group flex h-full flex-col rounded-lg border border-white/[0.07] bg-[#0b0b0b] p-5 transition-colors hover:border-[#39FF14]/30">
                    <div className="mb-5 flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#39FF14]/10 text-[#39FF14]">
                        {tool.icon}
                      </div>
                      <span className="ml-auto rounded border border-white/10 px-2 py-1 text-[9px] font-black uppercase tracking-[0.14em] text-zinc-600">
                        {tool.status}
                      </span>
                    </div>
                    <h2 className="text-lg font-black uppercase tracking-[0.08em] text-white">{tool.title}</h2>
                    <p className="mt-2 flex-1 text-sm leading-relaxed text-zinc-500">{tool.description}</p>
                    <div className="mt-5 inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-[#39FF14]">
                      Abrir
                      <ExternalLink className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                    </div>
                  </article>
                </Link>
              ))}
            </section>

            <section className="rounded-lg border border-white/[0.07] bg-[#0b0b0b] p-5">
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div>
                  <div className="mb-3 flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#39FF14]/10 text-[#39FF14]">
                      <Mail className="h-5 w-5" />
                    </div>
                    <div>
                      <h2 className="text-lg font-black uppercase tracking-[0.08em] text-white">Newsletter</h2>
                      <p className="text-xs font-bold text-zinc-600">Suscriptores guardados desde Home y Touring.</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <span className="rounded border border-[#39FF14]/25 bg-[#39FF14]/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.16em] text-[#39FF14]">
                      {newsletter?.total ?? 0} total
                    </span>
                    {sourceEntries.map(([source, count]) => (
                      <span key={source} className="rounded border border-white/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.16em] text-zinc-500">
                        {sourceLabel(source)} · {count}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => void loadNewsletter()}
                    disabled={newsletterLoading}
                    className="inline-flex h-10 items-center gap-2 rounded-lg border border-white/10 px-3 text-[10px] font-black uppercase tracking-[0.16em] text-zinc-400 hover:text-white disabled:cursor-wait disabled:opacity-60"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${newsletterLoading ? "animate-spin" : ""}`} />
                    Refrescar
                  </button>
                  <button
                    type="button"
                    onClick={exportNewsletterCsv}
                    disabled={!newsletter?.subscribers.length}
                    className="inline-flex h-10 items-center gap-2 rounded-lg border border-[#39FF14]/30 bg-[#39FF14]/10 px-3 text-[10px] font-black uppercase tracking-[0.16em] text-[#39FF14] hover:bg-[#39FF14]/15 disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    <Download className="h-3.5 w-3.5" />
                    CSV
                  </button>
                </div>
              </div>

              {newsletterError && (
                <div className="mt-4 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs font-bold text-red-300">
                  {newsletterError}
                  <button
                    type="button"
                    onClick={clearKey}
                    className="ml-3 font-black uppercase tracking-[0.12em] text-red-200 underline decoration-red-300/40 underline-offset-4"
                  >
                    Cambiar clave
                  </button>
                </div>
              )}

              <div className="mt-5 overflow-hidden rounded-lg border border-white/[0.06]">
                <div className="grid grid-cols-[1fr_110px_150px] gap-3 border-b border-white/[0.06] bg-white/[0.025] px-3 py-2 text-[9px] font-black uppercase tracking-[0.16em] text-zinc-600">
                  <span>Email</span>
                  <span>Fuente</span>
                  <span>Alta</span>
                </div>
                <div className="max-h-72 overflow-auto">
                  {newsletterLoading && !newsletter ? (
                    <div className="px-3 py-6 text-center text-xs font-bold text-zinc-600">Cargando suscriptores...</div>
                  ) : newsletter?.subscribers.length ? (
                    newsletter.subscribers.map(row => (
                      <div key={row.email} className="grid grid-cols-[1fr_110px_150px] gap-3 border-b border-white/[0.035] px-3 py-2 text-xs last:border-b-0">
                        <span className="min-w-0 truncate font-bold text-zinc-300">{row.email}</span>
                        <span className="font-black uppercase tracking-[0.12em] text-zinc-600">{sourceLabel(row.source)}</span>
                        <span className="text-zinc-600">{new Date(row.createdAt).toLocaleDateString("es-MX")}</span>
                      </div>
                    ))
                  ) : (
                    <div className="px-3 py-6 text-center text-xs font-bold text-zinc-600">Todavía no hay suscriptores.</div>
                  )}
                </div>
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
