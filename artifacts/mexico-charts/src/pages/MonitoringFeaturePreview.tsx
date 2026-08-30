import { useMemo, useState } from "react";
import {
  Activity,
  BarChart3,
  BellRing,
  CheckCircle2,
  ChevronRight,
  Download,
  Disc3,
  FileText,
  Flag,
  Headphones,
  Instagram,
  LayoutDashboard,
  MapPin,
  Music2,
  Radar,
  Settings2,
  TrendingDown,
  TrendingUp,
  Users,
  Video,
  Youtube,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import SiteNav from "@/components/SiteNav";
import PageSEO from "@/components/PageSEO";

const G = "#39FF14";
const REPORT_URL = ["", "reports", "peso-pluma-monitor-agosto-2026.pdf"].join(
  "/",
);
const peso = {
  avatar: "https://i.scdn.co/image/ab67616100005174e5283f5b671cf618b82a2696",
  spotifyListeners: 44_948_653,
  spotifyFollowers: 30_018_680,
  youtubeViews: 13_125_619_666,
  instagramFollowers: 16_453_239,
};

const trendData = {
  spotify: [
    ["30 may", 47_137_843],
    ["08 jun", 46_835_086],
    ["18 jun", 46_404_479],
    ["30 jun", 46_221_969],
    ["09 jul", 45_581_642],
    ["19 jul", 45_598_515],
    ["31 jul", 45_101_438],
    ["09 ago", 45_056_684],
    ["19 ago", 45_252_609],
    ["28 ago", 44_948_653],
  ],
  instagram: [
    ["30 may", 16_531_761],
    ["08 jun", 16_658_942],
    ["18 jun", 16_684_548],
    ["30 jun", 16_643_748],
    ["09 jul", 16_613_758],
    ["19 jul", 16_576_392],
    ["31 jul", 16_526_092],
    ["09 ago", 16_496_442],
    ["19 ago", 16_476_183],
    ["28 ago", 16_455_691],
  ],
  tiktok: [
    ["30 may", 9_267_705],
    ["08 jun", 9_394_744],
    ["18 jun", 9_527_418],
    ["30 jun", 9_535_996],
    ["09 jul", 9_510_804],
    ["19 jul", 9_488_290],
    ["31 jul", 9_463_874],
    ["09 ago", 9_447_354],
    ["19 ago", 9_429_890],
    ["28 ago", 9_417_158],
  ],
} as const;

const benchmarks = [
  {
    name: "Peso Pluma",
    image: peso.avatar,
    listeners: 44_948_653,
    spotify30: -192_445,
    youtube30: 815_716_080,
    instagram: 16_453_239,
  },
  {
    name: "Natanael Cano",
    image: "https://i.scdn.co/image/ab676161000051740d4838ef7ef6c0f889266f60",
    listeners: 25_334_693,
    spotify30: 476_327,
    youtube30: 313_000_517,
    instagram: 11_061_958,
  },
  {
    name: "Luis Miguel",
    image: "https://i.scdn.co/image/ab676161000051746481401e529e475116702a29",
    listeners: 22_041_391,
    spotify30: 629_267,
    youtube30: 310_769_062,
    instagram: 6_481_478,
  },
];

const videos = [
  {
    id: "fOT0BUpITw8",
    title: "BELLAKEO",
    image: "https://i.ytimg.com/vi/fOT0BUpITw8/hqdefault.jpg",
    views: 755_225_298,
    delta: 14_623,
    interval: "67 min",
    progress: 94.4,
  },
  {
    id: "qkXIRZKSQ3k",
    title: "NUEVA VIDA",
    image: "https://i.ytimg.com/vi/qkXIRZKSQ3k/hqdefault.jpg",
    views: 656_329_575,
    delta: 25_773,
    interval: "62 min",
    progress: 93.8,
  },
  {
    id: "rCL8-CiGSmc",
    title: "HOLLYWOOD",
    image: "https://i.ytimg.com/vi/rCL8-CiGSmc/hqdefault.jpg",
    views: 481_069_561,
    delta: 2_259_086,
    interval: "111 h",
    progress: 96.2,
  },
];

const spotifyTracks = [
  { title: "daño", total: 378_556_800, daily: 1_090_598 },
  { title: "HOLLYWOOD", total: 675_604_922, daily: 760_832 },
  { title: "LAGUNAS", total: 625_950_153, daily: 581_909 },
  { title: "dopamina", total: 345_249_437, daily: 561_707 },
  { title: "La Bebe - Remix", total: 1_426_786_807, daily: 527_186 },
];

const spotifyAlbums = [
  { title: "DINASTÍA (DELUXE)", total: 2_509_056_715, daily: 4_864_657 },
  { title: "DINASTÍA", total: 2_163_712_472, daily: 4_013_386 },
  { title: "GÉNESIS", total: 7_426_261_146, daily: 3_160_326 },
  { title: "ÉXODO", total: 5_357_897_851, daily: 2_953_424 },
  { title: "INCÓMODO", total: 1_172_822_531, daily: 636_934 },
];

const spotifyCatalog = {
  trackCount: 187,
  albumCount: 18,
  trackDaily: 18_877_891,
  albumDaily: 20_819_581,
  trackTotal: 34_112_292_683,
  albumTotal: 29_850_046_770,
};

const cities = [
  ["Ciudad de México", "CDMX", 3_997_897, 5_566_817],
  ["Guadalajara", "Jalisco", 1_435_286, 1_958_210],
  ["Puebla", "Puebla", 1_344_685, 1_643_004],
  ["Monterrey", "Nuevo León", 1_014_895, 1_340_069],
  ["Zapopan", "Jalisco", 985_815, 1_224_283],
] as const;

type View =
  | "resumen"
  | "tendencias"
  | "spotify"
  | "videos"
  | "mercados"
  | "comparar"
  | "alertas"
  | "reportes";
type TrendKey = keyof typeof trendData;
const navItems: Array<{
  key: View;
  label: string;
  icon: typeof Activity;
  note?: string;
}> = [
  { key: "resumen", label: "Panel", icon: LayoutDashboard },
  { key: "tendencias", label: "Tendencias", icon: BarChart3 },
  { key: "spotify", label: "Spotify", icon: Music2, note: "205" },
  { key: "videos", label: "YouTube", icon: Video, note: "Todos" },
  { key: "mercados", label: "Mercados", icon: MapPin },
  { key: "comparar", label: "Comparar", icon: Radar },
  { key: "alertas", label: "Alertas", icon: BellRing, note: "2" },
  { key: "reportes", label: "Reportes", icon: FileText, note: "Nuevo" },
];

const compact = (value: number) =>
  new Intl.NumberFormat("es-MX", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
const exact = (value: number) => new Intl.NumberFormat("es-MX").format(value);
const signed = (value: number) =>
  `${value >= 0 ? "+" : "−"}${exact(Math.abs(value))}`;

function Kicker({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[9px] font-black uppercase tracking-[.2em] text-[#39FF14]">
      {children}
    </p>
  );
}
function Panel({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <article
      className={`rounded-3xl border border-white/[.08] bg-white/[.025] ${className}`}
    >
      {children}
    </article>
  );
}
function Metric({
  icon: Icon,
  label,
  value,
  change,
  color = G,
}: {
  icon: typeof Activity;
  label: string;
  value: string;
  change: string;
  color?: string;
}) {
  const down = change.startsWith("−");
  return (
    <Panel className="relative overflow-hidden p-5">
      <div
        className="absolute -right-8 -top-8 h-28 w-28 rounded-full opacity-10 blur-3xl"
        style={{ background: color }}
      />
      <Icon className="h-5 w-5" style={{ color }} />
      <p className="mt-5 text-[8px] font-black uppercase tracking-[.16em] text-white/35">
        {label}
      </p>
      <p className="mt-2 text-3xl font-black tracking-[-.045em]">{value}</p>
      <p
        className={`mt-2 flex items-center gap-1 text-[10px] font-black ${down ? "text-red-400" : "text-[#39FF14]"}`}
      >
        {down ? (
          <TrendingDown className="h-3 w-3" />
        ) : (
          <TrendingUp className="h-3 w-3" />
        )}
        {change}
      </p>
    </Panel>
  );
}

function TrendChart({
  metric,
  setMetric,
}: {
  metric: TrendKey;
  setMetric: (metric: TrendKey) => void;
}) {
  const chart = useMemo(
    () => trendData[metric].map(([date, value]) => ({ date, value })),
    [metric],
  );
  const meta = {
    spotify: {
      label: "Oyentes mensuales Spotify",
      change: "−192,445 · −0.43% en 30 días",
      color: "#1ed760",
    },
    instagram: {
      label: "Seguidores Instagram",
      change: "−80,056 · −0.48% en 30 días",
      color: "#f05aa6",
    },
    tiktok: {
      label: "Seguidores TikTok",
      change: "−50,650 · −0.53% en 30 días",
      color: "#ffffff",
    },
  }[metric];
  const values = chart.map((point) => point.value);
  const padding = metric === "spotify" ? 300_000 : 45_000;
  const domain: [number, number] = [
    Math.min(...values) - padding,
    Math.max(...values) + padding,
  ];
  return (
    <Panel className="p-5 sm:p-7">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Kicker>Historial premium · 90 días</Kicker>
          <h2 className="mt-2 text-2xl font-black">{meta.label}</h2>
          <p className="mt-2 text-xs font-black text-red-400">{meta.change}</p>
        </div>
        <div className="flex gap-2">
          {(["spotify", "instagram", "tiktok"] as const).map((key) => (
            <button
              key={key}
              onClick={() => setMetric(key)}
              className={`rounded-full px-4 py-2 text-[8px] font-black uppercase tracking-[.13em] ${metric === key ? "bg-white text-black" : "border border-white/10 text-white/35 hover:text-white"}`}
            >
              {key}
            </button>
          ))}
        </div>
      </div>
      <div className="mt-6 h-72">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chart}>
            <defs>
              <linearGradient
                id={`monitor-${metric}`}
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <stop offset="0%" stopColor={meta.color} stopOpacity={0.32} />
                <stop offset="100%" stopColor={meta.color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="rgba(255,255,255,.06)" vertical={false} />
            <XAxis
              dataKey="date"
              tick={{ fill: "rgba(255,255,255,.3)", fontSize: 9 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              domain={domain}
              tick={{ fill: "rgba(255,255,255,.3)", fontSize: 9 }}
              tickFormatter={compact}
              width={50}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              contentStyle={{
                background: "#111",
                border: "1px solid rgba(255,255,255,.12)",
                borderRadius: 12,
              }}
              formatter={(v) => exact(Number(v))}
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke={meta.color}
              strokeWidth={3}
              fill={`url(#monitor-${metric})`}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </Panel>
  );
}

function SummaryView({ open }: { open: (view: View) => void }) {
  return (
    <div className="space-y-4">
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric
          icon={Headphones}
          label="Oyentes Spotify"
          value={compact(peso.spotifyListeners)}
          change="−192,445 · 30d"
          color="#1ed760"
        />
        <Metric
          icon={Users}
          label="Seguidores Spotify"
          value={compact(peso.spotifyFollowers)}
          change="+586,808 · 30d"
          color="#1ed760"
        />
        <Metric
          icon={Youtube}
          label="Vistas YouTube"
          value={compact(peso.youtubeViews)}
          change="+815,716,080 · 30d"
          color="#ff3b30"
        />
        <Metric
          icon={Instagram}
          label="Seguidores Instagram"
          value={compact(peso.instagramFollowers)}
          change="−80,056 · 30d"
          color="#f05aa6"
        />
      </section>
      <section className="grid gap-4 xl:grid-cols-[1.45fr_.8fr]">
        <Panel className="overflow-hidden border-[#39FF14]/20 bg-[radial-gradient(circle_at_top_right,rgba(57,255,20,.1),transparent_45%)] p-6 sm:p-8">
          <Kicker>Actividad semanal</Kicker>
          <h2 className="mt-3 max-w-2xl text-3xl font-black tracking-[-.04em]">
            YouTube lidera el crecimiento
          </h2>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-white/45">
            YouTube registra{" "}
            <strong className="text-white">815.7M vistas en 30 días</strong>.
            Spotify ganó{" "}
            <strong className="text-white">586.8K seguidores</strong> y perdió
            192.4K oyentes mensuales.
          </p>
          <div className="mt-6 grid gap-2 sm:grid-cols-3">
            {[
              ["Mayor crecimiento", "YouTube +3.72%"],
              ["En seguimiento", "Oyentes −0.43%"],
              ["Mercado principal", "CDMX · 4.0M"],
            ].map(([a, b]) => (
              <div
                key={a}
                className="rounded-xl border border-white/[.07] bg-black/25 p-4"
              >
                <p className="text-[8px] font-black uppercase tracking-[.14em] text-white/25">
                  {a}
                </p>
                <p className="mt-2 text-sm font-black">{b}</p>
              </div>
            ))}
          </div>
        </Panel>
        <Panel className="p-6">
          <Kicker>Rendimiento digital</Kicker>
          <div className="mt-5 flex items-end justify-between">
            <div>
              <p className="text-6xl font-black tracking-[-.06em]">78</p>
              <p className="text-[9px] font-black uppercase tracking-[.15em] text-[#39FF14]">
                Fuerte · catálogo
              </p>
            </div>
            <div className="grid h-20 w-20 place-items-center rounded-full border-[7px] border-[#39FF14]/80 text-xs font-black">
              Top 12%
            </div>
          </div>
          <div className="mt-6 space-y-3">
            {[
              ["YouTube", "94"],
              ["Seguidores", "82"],
              ["Oyentes", "54"],
            ].map(([label, value]) => (
              <div key={label}>
                <div className="flex justify-between text-[9px] font-black">
                  <span>{label}</span>
                  <span className="text-white/30">{value}/100</span>
                </div>
                <div className="mt-2 h-1.5 rounded-full bg-white/[.07]">
                  <div
                    className="h-full rounded-full bg-[#39FF14]"
                    style={{ width: `${value}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </section>
      <section className="grid gap-4 lg:grid-cols-[1fr_1fr_auto]">
        <Panel className="p-6">
          <Kicker>Spotify · canciones</Kicker>
          <p className="mt-3 text-3xl font-black">
            {compact(spotifyCatalog.trackDaily)}
          </p>
          <p className="mt-1 text-[9px] text-white/30">
            streams diarios · {spotifyCatalog.trackCount} canciones
          </p>
        </Panel>
        <Panel className="p-6">
          <Kicker>Spotify · álbumes</Kicker>
          <p className="mt-3 text-3xl font-black">
            {compact(spotifyCatalog.albumDaily)}
          </p>
          <p className="mt-1 text-[9px] text-white/30">
            streams diarios · {spotifyCatalog.albumCount} álbumes
          </p>
        </Panel>
        <button
          onClick={() => open("spotify")}
          className="flex min-h-32 items-center justify-center gap-2 rounded-3xl border border-[#1ed760]/20 bg-[#1ed760]/[.06] px-7 text-[9px] font-black uppercase tracking-[.15em] text-[#39FF14]"
        >
          Abrir Spotify <ChevronRight className="h-4 w-4" />
        </button>
      </section>
      <section className="grid gap-4 lg:grid-cols-3">
        <Panel className="p-6">
          <Kicker>Cambios</Kicker>
          <div className="mt-5 space-y-4">
            {[
              ["YouTube", "+815.7M", "Mayor crecimiento del grupo"],
              ["Spotify", "−192.4K", "Oyentes mensuales a la baja"],
              ["Instagram", "−80.1K", "Seguidores a la baja"],
            ].map(([a, b, c]) => (
              <div
                key={a}
                className="border-b border-white/[.07] pb-4 last:border-0 last:pb-0"
              >
                <div className="flex justify-between">
                  <p className="text-xs font-black">{a}</p>
                  <p
                    className={
                      b.startsWith("+")
                        ? "text-xs font-black text-[#39FF14]"
                        : "text-xs font-black text-red-400"
                    }
                  >
                    {b}
                  </p>
                </div>
                <p className="mt-1 text-[9px] text-white/30">{c}</p>
              </div>
            ))}
          </div>
        </Panel>
        <Panel className="p-6">
          <Kicker>Análisis</Kicker>
          <p className="mt-4 text-lg font-black">
            El catálogo mantiene un consumo alto
          </p>
          <p className="mt-3 text-xs leading-6 text-white/40">
            El crecimiento de YouTube y seguidores continúa, pero los oyentes
            mensuales de Spotify llevan una tendencia negativa.
          </p>
          <button
            onClick={() => open("tendencias")}
            className="mt-5 flex items-center gap-2 text-[9px] font-black uppercase tracking-[.15em] text-[#39FF14]"
          >
            Ver tendencias <ChevronRight className="h-3 w-3" />
          </button>
        </Panel>
        <Panel className="border-[#39FF14]/20 bg-[#39FF14]/[.035] p-6">
          <Kicker>Oportunidad</Kicker>
          <p className="mt-4 text-lg font-black">
            BELLAKEO y NUEVA VIDA se acercan a nuevos hitos
          </p>
          <p className="mt-3 text-xs leading-6 text-white/40">
            BELLAKEO está en 755.2M vistas y NUEVA VIDA en 656.3M.
          </p>
          <button
            onClick={() => open("videos")}
            className="mt-5 rounded-xl bg-[#39FF14] px-4 py-3 text-[9px] font-black uppercase tracking-[.15em] text-black"
          >
            Abrir YouTube
          </button>
        </Panel>
      </section>
    </div>
  );
}

function TrendsView({
  metric,
  setMetric,
}: {
  metric: TrendKey;
  setMetric: (metric: TrendKey) => void;
}) {
  return (
    <div className="space-y-4">
      <TrendChart metric={metric} setMetric={setMetric} />
      <section className="grid gap-4 lg:grid-cols-3">
        {[
          [
            "Oyentes",
            "Tendencia negativa",
            "Los oyentes mensuales bajaron 4.64% en 90 días y 0.43% en los últimos 30 días",
          ],
          [
            "Seguidores",
            "Spotify sigue creciendo",
            "La cuenta sumó 586.8K seguidores en 30 días mientras bajaban los oyentes mensuales",
          ],
          [
            "YouTube",
            "YouTube sostiene el crecimiento",
            "YouTube sumó 815.7M vistas en 30 días, la cifra más alta del grupo comparado",
          ],
        ].map(([k, title, body]) => (
          <Panel key={k} className="p-6">
            <Kicker>{k}</Kicker>
            <h3 className="mt-3 text-xl font-black">{title}</h3>
            <p className="mt-3 text-xs leading-6 text-white/40">{body}</p>
          </Panel>
        ))}
      </section>
      <Panel className="p-6 sm:p-7">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Kicker>Historial</Kicker>
            <h3 className="mt-2 text-xl font-black">
              15 días en el perfil público · 30 y 90 días en Monitor
            </h3>
          </div>
          <span className="w-fit rounded-full border border-[#39FF14]/25 bg-[#39FF14]/10 px-3 py-1.5 text-[8px] font-black uppercase tracking-[.14em] text-[#39FF14]">
            Incluido en $6
          </span>
        </div>
      </Panel>
    </div>
  );
}

function SpotifyView() {
  const lists = [
    {
      title: "Canciones con más streams diarios",
      icon: Music2,
      items: spotifyTracks,
    },
    {
      title: "Álbumes con más streams diarios",
      icon: Disc3,
      items: spotifyAlbums,
    },
  ];
  return (
    <div className="space-y-4">
      <Panel className="border-[#1ed760]/20 bg-[radial-gradient(circle_at_top_right,rgba(30,215,96,.11),transparent_45%)] p-6 sm:p-8">
        <Kicker>Spotify</Kicker>
        <h2 className="mt-3 text-3xl font-black tracking-[-.04em]">
          Canciones y álbumes
        </h2>
        <p className="mt-3 text-xs text-white/35">
          Streams acumulados y diarios · corte del 29 ago 2026
        </p>
        <div className="mt-7 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[
            [
              "Canciones · diario",
              compact(spotifyCatalog.trackDaily),
              `${spotifyCatalog.trackCount} canciones`,
            ],
            [
              "Canciones · acumulado",
              compact(spotifyCatalog.trackTotal),
              "catálogo registrado",
            ],
            [
              "Álbumes · diario",
              compact(spotifyCatalog.albumDaily),
              `${spotifyCatalog.albumCount} álbumes`,
            ],
            [
              "Álbumes · acumulado",
              compact(spotifyCatalog.albumTotal),
              "álbumes registrados",
            ],
          ].map(([label, value, detail]) => (
            <div
              key={label}
              className="rounded-2xl border border-white/[.07] bg-black/25 p-5"
            >
              <p className="text-[8px] font-black uppercase tracking-[.15em] text-white/30">
                {label}
              </p>
              <p className="mt-3 text-3xl font-black">{value}</p>
              <p className="mt-1 text-[9px] text-white/25">{detail}</p>
            </div>
          ))}
        </div>
      </Panel>
      <section className="grid gap-4 xl:grid-cols-2">
        {lists.map(({ title, icon: Icon, items }) => (
          <Panel key={title} className="overflow-hidden">
            <div className="flex items-center gap-3 border-b border-white/[.07] p-6">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#1ed760]/10">
                <Icon className="h-5 w-5 text-[#1ed760]" />
              </span>
              <h3 className="text-lg font-black">{title}</h3>
            </div>
            <div>
              {items.map((item, index) => (
                <div
                  key={`${title}-${item.title}`}
                  className="grid grid-cols-[28px_minmax(0,1fr)_auto] items-center gap-3 border-b border-white/[.06] px-6 py-4 last:border-0"
                >
                  <span className="text-[9px] font-black text-[#39FF14]">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-black">{item.title}</p>
                    <p className="mt-1 text-[9px] text-white/25">
                      {compact(item.total)} acumulados
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-black text-[#39FF14]">
                      +{compact(item.daily)}
                    </p>
                    <p className="text-[8px] text-white/25">diarios</p>
                  </div>
                </div>
              ))}
            </div>
          </Panel>
        ))}
      </section>
    </div>
  );
}

function VideosView() {
  return (
    <div className="space-y-4">
      <Panel className="overflow-hidden border-red-500/15 bg-[radial-gradient(circle_at_top_right,rgba(255,40,40,.08),transparent_45%)]">
        <div className="p-6 sm:p-7">
          <Kicker>YouTube en vivo</Kicker>
          <h2 className="mt-2 text-3xl font-black">
            Videos de YouTube con mayor actividad
          </h2>
          <p className="mt-2 text-xs text-white/35">
            Cambios exactos entre las últimas lecturas guardadas
          </p>
        </div>
        <div className="grid border-t border-white/[.07] lg:grid-cols-3">
          {videos.map((video, index) => (
            <article
              key={video.id}
              className="border-b border-white/[.07] p-5 last:border-0 lg:border-b-0 lg:border-r lg:last:border-r-0"
            >
              <div className="relative overflow-hidden rounded-2xl">
                <img
                  src={video.image}
                  alt={`Miniatura de ${video.title}`}
                  className="aspect-video w-full object-cover"
                />
                <span className="absolute left-3 top-3 rounded-full bg-black/80 px-2.5 py-1 text-[8px] font-black">
                  #{index + 1}
                </span>
              </div>
              <p className="mt-4 text-sm font-black">{video.title}</p>
              <p className="mt-2 text-2xl font-black">{exact(video.views)}</p>
              <p className="text-[9px] text-white/30">vistas totales</p>
              <div className="mt-4 flex justify-between border-t border-white/[.06] pt-3">
                <span className="text-[9px] text-white/30">
                  últimos {video.interval}
                </span>
                <span className="text-xs font-black text-[#39FF14]">
                  +{exact(video.delta)}
                </span>
              </div>
              <div className="mt-4 h-1.5 rounded-full bg-white/[.07]">
                <div
                  className="h-full rounded-full bg-red-500"
                  style={{ width: `${video.progress}%` }}
                />
              </div>
              <p className="mt-2 text-[8px] text-white/25">
                {video.progress}% del próximo hito
              </p>
            </article>
          ))}
        </div>
      </Panel>
      <section className="grid gap-4 lg:grid-cols-2">
        <Panel className="p-6">
          <Kicker>Rendimiento reciente</Kicker>
          <h3 className="mt-3 text-2xl font-black">
            NUEVA VIDA lidera la última lectura
          </h3>
          <p className="mt-3 text-sm leading-7 text-white/40">
            Sumó 25,773 vistas en 62 minutos frente a 14,623 de BELLAKEO en 67
            minutos
          </p>
          <div className="mt-5 rounded-xl border border-[#39FF14]/20 bg-[#39FF14]/[.04] p-4 text-xs font-bold">
            Próximo hito · NUEVA VIDA 700M
          </div>
        </Panel>
        <Panel className="p-6">
          <Kicker>Datos incluidos</Kicker>
          <div className="mt-5 grid grid-cols-2 gap-3">
            {[
              ["10", "videos de YouTube en perfil público"],
              ["Todos", "videos oficiales de YouTube en Monitor"],
              ["Cada hora", "actualización objetivo"],
              ["24 h ET", "total diario"],
            ].map(([value, label]) => (
              <div
                key={label}
                className="rounded-xl border border-white/[.07] bg-black/25 p-4"
              >
                <p className="text-2xl font-black">{value}</p>
                <p className="mt-1 text-[8px] font-black uppercase tracking-[.12em] text-white/25">
                  {label}
                </p>
              </div>
            ))}
          </div>
        </Panel>
      </section>
    </div>
  );
}

function MarketsView() {
  return (
    <div className="grid gap-4 xl:grid-cols-[1.2fr_.8fr]">
      <Panel className="p-6 sm:p-7">
        <Kicker>Audiencia de Spotify en México</Kicker>
        <h2 className="mt-2 text-3xl font-black">Mercados principales</h2>
        <div className="mt-7 space-y-5">
          {cities.map(([city, region, current, peak], index) => {
            const gap = Math.round((1 - current / peak) * 100);
            return (
              <div key={city}>
                <div className="flex items-end justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <span className="text-[9px] font-black text-[#39FF14]">
                      0{index + 1}
                    </span>
                    <div>
                      <p className="text-sm font-black">{city}</p>
                      <p className="text-[8px] uppercase tracking-[.12em] text-white/25">
                        {region}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-black">{exact(current)}</p>
                    <p className="text-[8px] text-red-400">
                      {gap}% bajo su pico
                    </p>
                  </div>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/[.06]">
                  <div
                    className="h-full rounded-full bg-[#39FF14]"
                    style={{
                      width: `${Math.max(12, (current / cities[0][2]) * 100)}%`,
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </Panel>
      <div className="space-y-4">
        <Panel className="p-6">
          <Kicker>Mercado con menor caída</Kicker>
          <h3 className="mt-3 text-2xl font-black">
            Puebla se mantiene más cerca de su pico
          </h3>
          <p className="mt-3 text-xs leading-6 text-white/40">
            Registra 1.34M oyentes y está 18% por debajo de su máximo histórico
          </p>
        </Panel>
        <Panel className="p-6">
          <Kicker>Top 5 México</Kicker>
          <p className="mt-4 text-5xl font-black">8.8M</p>
          <p className="mt-2 text-xs text-white/35">
            oyentes mensuales combinados
          </p>
          <div className="mt-5 rounded-xl border border-white/[.07] p-4">
            <p className="text-[8px] uppercase tracking-[.14em] text-white/25">
              Concentración
            </p>
            <p className="mt-2 text-sm font-black">
              CDMX representa 45.5% del Top 5
            </p>
          </div>
        </Panel>
      </div>
    </div>
  );
}

function CompareView() {
  return (
    <div className="space-y-4">
      <Panel className="overflow-hidden">
        <div className="p-6 sm:p-7">
          <Kicker>Comparación de artistas</Kicker>
          <h2 className="mt-2 text-3xl font-black">
            Peso Pluma vs referentes mexicanos
          </h2>
          <p className="mt-2 text-xs text-white/35">Datos del 29 ago 2026</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left">
            <thead className="border-y border-white/[.07] text-[8px] font-black uppercase tracking-[.14em] text-white/25">
              <tr>
                <th className="px-6 py-3">Artista</th>
                <th className="px-4 py-3">Oyentes</th>
                <th className="px-4 py-3">Spotify 30d</th>
                <th className="px-4 py-3">YouTube 30d</th>
                <th className="px-4 py-3">Instagram</th>
              </tr>
            </thead>
            <tbody>
              {benchmarks.map((row, index) => (
                <tr
                  key={row.name}
                  className="border-b border-white/[.06] last:border-0"
                >
                  <td className="px-6 py-5">
                    <div className="flex items-center gap-3">
                      <img
                        src={row.image}
                        alt={row.name}
                        className="h-11 w-11 rounded-xl object-cover"
                      />
                      <div>
                        <p className="text-sm font-black">{row.name}</p>
                        <p className="text-[8px] text-white/25">
                          #{index + 1} por oyentes
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-5 text-sm font-black">
                    {compact(row.listeners)}
                  </td>
                  <td
                    className={`px-4 py-5 text-sm font-black ${row.spotify30 >= 0 ? "text-[#39FF14]" : "text-red-400"}`}
                  >
                    {signed(row.spotify30)}
                  </td>
                  <td className="px-4 py-5 text-sm font-black text-[#39FF14]">
                    +{compact(row.youtube30)}
                  </td>
                  <td className="px-4 py-5 text-sm font-black">
                    {compact(row.instagram)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
      <section className="grid gap-4 lg:grid-cols-3">
        {[
          ["Oyentes", "#1", "77% más oyentes que Natanael Cano"],
          ["YouTube 30d", "2.6×", "502.7M más vistas que el segundo lugar"],
          [
            "Spotify 30d",
            "−192K",
            "Único artista del grupo con oyentes a la baja",
          ],
        ].map(([label, value, body]) => (
          <Panel key={label} className="p-6">
            <Kicker>{label}</Kicker>
            <p className="mt-3 text-4xl font-black">{value}</p>
            <p className="mt-3 text-xs leading-6 text-white/40">{body}</p>
          </Panel>
        ))}
      </section>
    </div>
  );
}

function AlertsView() {
  const [email, setEmail] = useState(true);
  const [weekly, setWeekly] = useState(true);
  return (
    <div className="grid gap-4 xl:grid-cols-[1.1fr_.9fr]">
      <Panel className="p-6 sm:p-7">
        <div className="flex items-center justify-between">
          <div>
            <Kicker>Reglas del artista</Kicker>
            <h2 className="mt-2 text-3xl font-black">Alertas configurables</h2>
          </div>
          <Settings2 className="h-5 w-5 text-white/25" />
        </div>
        <div className="mt-6 space-y-3">
          {[
            ["YouTube suma +100M en 30 días", "Activada hoy", true],
            ["Oyentes Spotify bajan de 45M", "Activada hoy", true],
            ["Instagram cambia ±1% en 7 días", "Sin cambios", false],
            [
              "Un video de YouTube alcanza un nuevo hito",
              "En seguimiento",
              false,
            ],
          ].map(([label, status, on]) => (
            <div
              key={String(label)}
              className="flex items-center justify-between gap-3 rounded-xl border border-white/[.07] bg-black/20 p-4"
            >
              <div>
                <p className="text-xs font-black">{label}</p>
                <p
                  className={`mt-1 text-[8px] font-black uppercase tracking-[.12em] ${on ? "text-[#39FF14]" : "text-white/25"}`}
                >
                  {status}
                </p>
              </div>
              <BellRing
                className={`h-4 w-4 ${on ? "text-[#39FF14]" : "text-white/20"}`}
              />
            </div>
          ))}
        </div>
        <button className="mt-5 rounded-xl border border-white/10 px-4 py-3 text-[9px] font-black uppercase tracking-[.15em] text-white/50">
          + Crear alerta
        </button>
      </Panel>
      <div className="space-y-4">
        <Panel className="p-6">
          <Kicker>Notificaciones</Kicker>
          {[
            ["Alertas por email", email, setEmail],
            ["Reporte semanal", weekly, setWeekly],
          ].map(([label, on, setter]) => (
            <button
              key={String(label)}
              onClick={() => typeof setter === "function" && setter(!on)}
              className="mt-4 flex w-full items-center justify-between rounded-xl border border-white/[.07] p-4 text-left"
            >
              <span className="text-xs font-black">{String(label)}</span>
              <span
                className={`h-5 w-9 rounded-full p-0.5 ${on ? "bg-[#39FF14]" : "bg-white/10"}`}
              >
                <span
                  className={`block h-4 w-4 rounded-full bg-black transition ${on ? "translate-x-4" : ""}`}
                />
              </span>
            </button>
          ))}
        </Panel>
        <Panel className="p-6">
          <Kicker>Actividad reciente</Kicker>
          <div className="mt-4 space-y-4">
            {[
              ["Hoy · 8:02 a.m.", "YouTube superó +800M en 30d"],
              ["Hoy · 8:02 a.m.", "Oyentes bajaron de 45M"],
              ["25 ago · 1:16 p.m.", "BELLAKEO sumó +14,623"],
            ].map(([time, event]) => (
              <div key={event} className="border-l border-[#39FF14]/30 pl-4">
                <p className="text-[8px] text-white/25">{time}</p>
                <p className="mt-1 text-xs font-black">{event}</p>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}

function ReportsView() {
  return (
    <div className="space-y-4">
      <Panel className="overflow-hidden border-[#39FF14]/20 bg-[radial-gradient(circle_at_80%_20%,rgba(57,255,20,.13),transparent_36%)] p-6 sm:p-9">
        <div className="grid gap-8 lg:grid-cols-[1fr_auto] lg:items-end">
          <div>
            <Kicker>Reporte semanal · 23 al 29 agosto 2026</Kicker>
            <h2 className="mt-3 max-w-2xl text-4xl font-black tracking-[-.045em]">
              Reporte semanal de rendimiento
            </h2>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-white/45">
              Cambios de la semana, tendencias de 30 y 90 días, YouTube,
              mercados, comparaciones y recomendaciones
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              <a
                href={REPORT_URL}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2 rounded-xl bg-[#39FF14] px-5 py-3.5 text-[9px] font-black uppercase tracking-[.15em] text-black"
              >
                <FileText className="h-4 w-4" />
                Abrir reporte
              </a>
              <a
                href={REPORT_URL}
                download="peso-pluma-reporte-semanal-23-29-agosto-2026.pdf"
                className="flex items-center gap-2 rounded-xl border border-white/10 px-5 py-3.5 text-[9px] font-black uppercase tracking-[.15em] text-white/55"
              >
                <Download className="h-4 w-4" />
                Descargar PDF
              </a>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {[
              ["7", "páginas"],
              ["8", "análisis"],
              ["3", "artistas"],
              ["5", "mercados"],
            ].map(([value, label]) => (
              <div
                key={label}
                className="min-w-28 rounded-xl border border-white/[.07] bg-black/30 p-4"
              >
                <p className="text-2xl font-black">{value}</p>
                <p className="text-[8px] uppercase tracking-[.12em] text-white/25">
                  {label}
                </p>
              </div>
            ))}
          </div>
        </div>
      </Panel>
      <section className="grid gap-4 lg:grid-cols-3">
        {[
          ["Cambios", "YouTube +815.7M en 30 días · Spotify −192.4K oyentes"],
          [
            "Análisis",
            "El catálogo mantiene crecimiento en YouTube y seguidores mientras bajan los oyentes mensuales",
          ],
          [
            "Recomendaciones",
            "Preparar contenidos para BELLAKEO 800M y NUEVA VIDA 700M",
          ],
        ].map(([title, body], index) => (
          <Panel key={title} className="p-6">
            <span className="text-[9px] font-black text-[#39FF14]">
              0{index + 1}
            </span>
            <h3 className="mt-3 text-xl font-black">{title}</h3>
            <p className="mt-3 text-xs leading-6 text-white/40">{body}</p>
          </Panel>
        ))}
      </section>
      <Panel className="p-6 sm:p-7">
        <div className="flex items-center justify-between">
          <div>
            <Kicker>Reportes anteriores</Kicker>
            <h3 className="mt-2 text-2xl font-black">Historial semanal</h3>
          </div>
          <span className="rounded-full border border-white/10 px-3 py-1.5 text-[8px] font-black uppercase tracking-[.13em] text-white/30">
            1 disponible
          </span>
        </div>
        <div className="mt-6 overflow-hidden rounded-xl border border-white/[.07]">
          <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <span className="grid h-12 w-12 place-items-center rounded-xl bg-[#39FF14]/10">
                <FileText className="h-5 w-5 text-[#39FF14]" />
              </span>
              <div>
                <p className="text-sm font-black">
                  Semana 35 · 23 al 29 agosto
                </p>
                <p className="mt-1 text-[9px] text-white/30">PDF · 8 páginas</p>
              </div>
            </div>
            <a
              href={REPORT_URL}
              target="_blank"
              rel="noreferrer"
              className="text-[9px] font-black uppercase tracking-[.15em] text-[#39FF14]"
            >
              Abrir <ChevronRight className="ml-1 inline h-3 w-3" />
            </a>
          </div>
        </div>
      </Panel>
    </div>
  );
}

export default function MonitoringFeaturePreview() {
  const [view, setView] = useState<View>("resumen");
  const [metric, setMetric] = useState<TrendKey>("spotify");
  const label = navItems.find((item) => item.key === view)?.label ?? "Panel";
  return (
    <div className="min-h-screen bg-[#050505] text-white">
      <PageSEO
        title="Monitor Pro de Peso Pluma — Mexico Charts"
        description="Recorrido completo del producto premium de Mexico Charts."
        path="/monitoreo/demo/peso-pluma"
        noindex
      />
      <SiteNav />
      <div className="border-b border-white/[.07] bg-[#080808]">
        <div className="mx-auto flex max-w-[1500px] items-center justify-between gap-4 px-5 py-3 sm:px-8">
          <div className="flex items-center gap-3">
            <span className="rounded-full bg-[#39FF14] px-2.5 py-1 text-[8px] font-black uppercase tracking-[.14em] text-black">
              Monitor Pro
            </span>
            <span className="hidden text-[9px] font-bold text-white/30 sm:inline">
              Vista previa privada
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[8px] font-black uppercase tracking-[.14em] text-white/25">
              Plan individual · $6 USD/mes
            </span>
            <span className="grid h-8 w-8 place-items-center rounded-full border border-white/10 text-[9px] font-black">
              RR
            </span>
          </div>
        </div>
      </div>
      <div className="mx-auto grid min-w-0 max-w-[1500px] lg:grid-cols-[230px_minmax(0,1fr)]">
        <aside className="min-w-0 border-r border-white/[.07] bg-[#070707] p-4 lg:min-h-[calc(100vh-112px)] lg:p-5">
          <div className="flex items-center gap-3 rounded-2xl border border-white/[.07] bg-white/[.025] p-3">
            <img
              src={peso.avatar}
              alt="Peso Pluma"
              className="h-11 w-11 rounded-xl object-cover"
            />
            <div className="min-w-0">
              <p className="truncate text-sm font-black">Peso Pluma</p>
              <p className="mt-1 flex items-center gap-1 text-[8px] font-black uppercase tracking-[.12em] text-[#39FF14]">
                <CheckCircle2 className="h-3 w-3" />
                Monitor activo
              </p>
            </div>
          </div>
          <nav className="mt-4 flex max-w-full gap-2 overflow-x-auto pb-2 lg:block lg:space-y-1 lg:overflow-visible">
            {navItems.map(({ key, label: navLabel, icon: Icon, note }) => (
              <button
                key={key}
                onClick={() => setView(key)}
                className={`flex shrink-0 items-center gap-3 rounded-xl px-3 py-3 text-left text-[10px] font-black transition lg:w-full ${view === key ? "bg-[#39FF14] text-black" : "text-white/35 hover:bg-white/[.04] hover:text-white"}`}
              >
                <Icon className="h-4 w-4" />
                <span className="flex-1">{navLabel}</span>
                {note && (
                  <span
                    className={`rounded-full px-2 py-0.5 text-[7px] ${view === key ? "bg-black/15" : "bg-white/[.06] text-white/30"}`}
                  >
                    {note}
                  </span>
                )}
              </button>
            ))}
          </nav>
          <div className="mt-5 hidden rounded-2xl border border-white/[.07] bg-black/30 p-4 lg:block">
            <p className="text-[8px] font-black uppercase tracking-[.14em] text-white/25">
              Próximo reporte
            </p>
            <p className="mt-2 text-xs font-black">5 sep 2026</p>
            <p className="mt-1 text-[8px] text-white/25">Reporte semanal</p>
          </div>
        </aside>
        <main className="min-w-0 px-5 py-8 sm:px-8 lg:px-10 lg:py-10">
          <header className="mb-7 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-[8px] font-black uppercase tracking-[.18em] text-white/25">
                Peso Pluma / {label}
              </p>
              <h1 className="mt-2 text-3xl font-black tracking-[-.045em] sm:text-4xl">
                {label}
              </h1>
              <p className="mt-2 text-xs text-white/30">
                Datos guardados · 29 ago 2026 · fuentes directas y cálculos
                etiquetados
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="rounded-full border border-[#39FF14]/20 bg-[#39FF14]/[.06] px-3 py-2 text-[8px] font-black uppercase tracking-[.13em] text-[#39FF14]">
                Lectura completa
              </span>
              {view !== "reportes" && (
                <button
                  onClick={() => setView("reportes")}
                  className="rounded-full border border-white/10 px-3 py-2 text-[8px] font-black uppercase tracking-[.13em] text-white/45 hover:text-white"
                >
                  Ver reporte
                </button>
              )}
            </div>
          </header>
          {view === "resumen" && <SummaryView open={setView} />}{" "}
          {view === "tendencias" && (
            <TrendsView metric={metric} setMetric={setMetric} />
          )}{" "}
          {view === "spotify" && <SpotifyView />}{" "}
          {view === "videos" && <VideosView />}{" "}
          {view === "mercados" && <MarketsView />}{" "}
          {view === "comparar" && <CompareView />}{" "}
          {view === "alertas" && <AlertsView />}{" "}
          {view === "reportes" && <ReportsView />}
          <footer className="mt-6 flex flex-col gap-2 border-t border-white/[.07] pt-5 text-[8px] leading-5 text-white/25 sm:flex-row sm:justify-between">
            <span>Datos de Songstats y YouTube · 29 ago 2026</span>
            <span>Análisis y comparaciones de Mexico Charts</span>
          </footer>
        </main>
      </div>
    </div>
  );
}
