import { motion } from "framer-motion";
import { Link } from "wouter";
import { ArrowUpRight, ArrowDownRight, Play, TrendingUp, BarChart3, Disc, ChevronRight, Clock } from "lucide-react";

const logoUrl = `${import.meta.env.BASE_URL}mexico-charts-logo.png`;

const HOT_100 = [
  { rank: 1, title: "La Bebé (Remix)", artist: "Yng Lvcas & Peso Pluma", genre: "Corridos Tumbados", streams: "48.2M", trend: "up" },
  { rank: 2, title: "Ella Baila Sola", artist: "Eslabon Armado & Peso Pluma", genre: "Regional Mexicano", streams: "45.1M", trend: "down" },
  { rank: 3, title: "La Bebe", artist: "Yng Lvcas", genre: "Pop Urbano", streams: "38.7M", trend: "up" },
  { rank: 4, title: "Por Las Noches", artist: "Peso Pluma", genre: "Corridos Tumbados", streams: "36.4M", trend: "new" },
  { rank: 5, title: "El Punto", artist: "Natanael Cano", genre: "Corridos Tumbados", streams: "34.8M", trend: "up" },
  { rank: 6, title: "Tití Me Preguntó", artist: "Bad Bunny", genre: "Urbano Latino", streams: "32.5M", trend: "down" },
  { rank: 7, title: "Quevedo: Bzrp Music Sessions #52", artist: "Bizarrap & Quevedo", genre: "Pop", streams: "30.1M", trend: "up" },
  { rank: 8, title: "AMG", artist: "Peso Pluma, Gabito Ballesteros & Junior H", genre: "Corridos Tumbados", streams: "28.9M", trend: "down" },
  { rank: 9, title: "Igual Que Un Ángel", artist: "Kali Uchis & Peso Pluma", genre: "Pop", streams: "27.2M", trend: "new" },
  { rank: 10, title: "Mundo de Caramelo", artist: "Grupo Frontera", genre: "Norteño", streams: "25.6M", trend: "up" },
  { rank: 11, title: "No Te Enamores", artist: "Marca MP", genre: "Regional Mexicano", streams: "24.3M", trend: "down" },
  { rank: 12, title: "El Azul", artist: "Junior H & Natanael Cano", genre: "Corridos Tumbados", streams: "23.8M", trend: "up" },
  { rank: 13, title: "Primera Cita", artist: "Edén Muñoz", genre: "Regional Mexicano", streams: "22.4M", trend: "down" },
  { rank: 14, title: "Cayó La Noche", artist: "Grupo Firme", genre: "Banda", streams: "21.9M", trend: "up" },
  { rank: 15, title: "Por Siempre", artist: "Remmy Valenzuela", genre: "Banda", streams: "20.5M", trend: "new" },
  { rank: 16, title: "La Tóxica", artist: "Farruko", genre: "Urbano Latino", streams: "19.8M", trend: "down" },
  { rank: 17, title: "Llamadas", artist: "Natanael Cano", genre: "Corridos Tumbados", streams: "18.7M", trend: "up" },
  { rank: 18, title: "Amor Tumbado", artist: "Natanael Cano & Adán Cruz", genre: "Corridos Tumbados", streams: "17.6M", trend: "down" },
  { rank: 19, title: "Fuerte", artist: "Feid", genre: "Urbano Latino", streams: "16.9M", trend: "new" },
  { rank: 20, title: "Volví", artist: "Aventura & Bad Bunny", genre: "Bachata", streams: "15.4M", trend: "down" },
];

const TRENDING_ARTISTS = [
  { name: "Peso Pluma", genre: "Corridos Tumbados", streams: "120.5M streams esta semana", growth: "+18%", color: "from-green-500 to-emerald-900" },
  { name: "Natanael Cano", genre: "Corridos Tumbados", streams: "89.2M streams esta semana", growth: "+12%", color: "from-zinc-400 to-zinc-800" },
  { name: "Eslabon Armado", genre: "Regional Mexicano", streams: "78.4M streams esta semana", growth: "+9%", color: "from-primary to-green-900" },
  { name: "Grupo Frontera", genre: "Norteño", streams: "65.1M streams esta semana", growth: "+22%", color: "from-neutral-300 to-neutral-700" },
  { name: "Feid", genre: "Urbano Latino", streams: "58.3M streams esta semana", growth: "+15%", color: "from-green-400 to-green-800" },
  { name: "Grupo Firme", genre: "Banda", streams: "52.7M streams esta semana", growth: "+7%", color: "from-zinc-500 to-zinc-900" },
  { name: "Junior H", genre: "Corridos Tumbados", streams: "48.9M streams esta semana", growth: "+11%", color: "from-primary/80 to-green-950" },
  { name: "Marca MP", genre: "Regional Mexicano", streams: "41.2M streams esta semana", growth: "+5%", color: "from-gray-400 to-gray-800" },
];

const GENRES = [
  { name: "Corridos Tumbados", song: "La Bebé (Remix)", streams: "187.4M" },
  { name: "Regional Mexicano", song: "Ella Baila Sola", streams: "142.8M" },
  { name: "Banda", song: "Cayó La Noche", streams: "98.3M" },
  { name: "Pop Urbano", song: "La Bebe", streams: "86.7M" },
  { name: "Norteño", song: "Mundo de Caramelo", streams: "74.1M" },
];

const CHART_HISTORY = [
  {
    week: "Semana 18",
    date: "29 abr – 5 may",
    number1: "Ella Baila Sola",
    artist: "Eslabon Armado & Peso Pluma",
    totalStreams: "2.1B",
    bigMover: { title: "Por Las Noches", movement: "+14", trend: "up" },
  },
  {
    week: "Semana 17",
    date: "22 abr – 28 abr",
    number1: "Ella Baila Sola",
    artist: "Eslabon Armado & Peso Pluma",
    totalStreams: "1.98B",
    bigMover: { title: "El Punto", movement: "+9", trend: "up" },
  },
  {
    week: "Semana 16",
    date: "15 abr – 21 abr",
    number1: "AMG",
    artist: "Peso Pluma, Gabito Ballesteros & Junior H",
    totalStreams: "1.87B",
    bigMover: { title: "Igual Que Un Ángel", movement: "+22", trend: "up" },
  },
  {
    week: "Semana 15",
    date: "8 abr – 14 abr",
    number1: "AMG",
    artist: "Peso Pluma, Gabito Ballesteros & Junior H",
    totalStreams: "1.79B",
    bigMover: { title: "Mundo de Caramelo", movement: "+18", trend: "up" },
  },
];

export default function Home() {
  return (
    <div className="min-h-[100dvh] bg-background text-foreground overflow-x-hidden selection:bg-primary selection:text-black">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/80 backdrop-blur-xl" data-testid="navigation">
        <div className="container mx-auto px-4 h-20 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 group" data-testid="link-logo">
            <img src={logoUrl} alt="Mexico Charts Logo" className="h-12 object-contain group-hover:scale-105 transition-transform duration-300" />
          </Link>
          <div className="hidden md:flex items-center gap-8 font-display font-semibold tracking-wide uppercase text-sm">
            <Link href="/" className="text-primary hover:text-primary/80 transition-colors" data-testid="link-nav-inicio">Inicio</Link>
            <Link href="#charts" className="text-zinc-400 hover:text-white transition-colors" data-testid="link-nav-charts">Charts</Link>
            <Link href="#artistas" className="text-zinc-400 hover:text-white transition-colors" data-testid="link-nav-artistas">Artistas</Link>
            <Link href="#generos" className="text-zinc-400 hover:text-white transition-colors" data-testid="link-nav-generos">Géneros</Link>
            <Link href="#historial" className="text-zinc-400 hover:text-white transition-colors" data-testid="link-nav-historial">Historial</Link>
          </div>
          <button className="md:hidden text-white" data-testid="button-mobile-menu">
            <BarChart3 className="w-6 h-6" />
          </button>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-24 pb-32 border-b border-border overflow-hidden" data-testid="section-hero">
        <div className="absolute inset-0 pointer-events-none opacity-20">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary rounded-full mix-blend-screen filter blur-[128px]" />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-zinc-600 rounded-full mix-blend-screen filter blur-[128px]" />
        </div>

        <div className="container mx-auto px-4 relative z-10">
          <div className="max-w-4xl">
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, ease: "easeOut" }}
              className="text-6xl md:text-8xl font-display font-bold uppercase leading-none tracking-tighter"
            >
              <span className="text-transparent bg-clip-text bg-gradient-to-b from-white via-gray-300 to-gray-500">La Referencia</span><br />
              <span className="text-transparent bg-clip-text bg-gradient-to-b from-white via-gray-300 to-gray-500">De La </span>
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-green-300 drop-shadow-[0_0_15px_rgba(57,255,20,0.3)]">Música</span><br />
              <span className="text-transparent bg-clip-text bg-gradient-to-b from-white via-gray-300 to-gray-500">Mexicana</span>
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.2, ease: "easeOut" }}
              className="mt-6 text-xl md:text-2xl text-zinc-400 max-w-2xl font-light"
            >
              Charts semanales, datos de la industria y tendencias en tiempo real. El epicentro del poder musical en México.
            </motion.p>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.4, ease: "easeOut" }}
            className="mt-20 bg-card border border-border p-6 md:p-10 relative overflow-hidden group shadow-[0_0_30px_rgba(57,255,20,0.05)]"
            data-testid="card-hero-number-1"
          >
            <div className="absolute -right-10 -top-10 text-[200px] font-display font-black text-white/5 leading-none select-none pointer-events-none group-hover:text-primary/10 transition-colors duration-500">
              #1
            </div>

            <div className="flex flex-col md:flex-row gap-8 items-start md:items-center relative z-10">
              <div className="flex-shrink-0 w-32 h-32 md:w-48 md:h-48 bg-gradient-to-br from-zinc-800 to-black border border-primary/30 flex items-center justify-center group-hover:border-primary transition-colors duration-500">
                <Play className="w-12 h-12 text-primary ml-2 group-hover:scale-110 transition-transform duration-500" />
              </div>
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <span className="bg-primary text-black px-3 py-1 text-xs font-bold uppercase tracking-wider">Número 1 Semanal</span>
                  <span className="text-zinc-400 text-sm flex items-center gap-1">
                    <TrendingUp className="w-4 h-4 text-primary" /> subió
                  </span>
                </div>
                <h2 className="text-4xl md:text-5xl font-display font-bold text-transparent bg-clip-text bg-gradient-to-b from-white to-gray-400 mb-2">{HOT_100[0].title}</h2>
                <p className="text-xl md:text-2xl text-zinc-300 mb-4">{HOT_100[0].artist}</p>
                <div className="flex flex-wrap items-center gap-4 text-sm font-mono text-zinc-500">
                  <span className="px-2 py-1 border border-zinc-800 bg-zinc-900/50">{HOT_100[0].genre}</span>
                  <span className="text-primary font-bold">{HOT_100[0].streams} reproducciones</span>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Stats Bar */}
      <section className="border-b border-border bg-[#050505]" data-testid="section-stats">
        <div className="container mx-auto px-4 py-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 divide-x divide-border/50 text-center">
            <div className="px-4">
              <div className="text-3xl md:text-4xl font-display font-bold text-white mb-1" data-testid="text-stats-songs">1,240</div>
              <div className="text-xs text-zinc-500 uppercase tracking-wider font-semibold">Canciones Monitoreadas</div>
            </div>
            <div className="px-4">
              <div className="text-3xl md:text-4xl font-display font-bold text-primary mb-1 drop-shadow-[0_0_10px_rgba(57,255,20,0.5)]" data-testid="text-stats-artists">89</div>
              <div className="text-xs text-zinc-500 uppercase tracking-wider font-semibold">Artistas en el Chart</div>
            </div>
            <div className="px-4">
              <div className="text-3xl md:text-4xl font-display font-bold text-white mb-1" data-testid="text-stats-streams">2.4B</div>
              <div className="text-xs text-zinc-500 uppercase tracking-wider font-semibold">Reproducciones Totales</div>
            </div>
            <div className="px-4">
              <div className="text-3xl md:text-4xl font-display font-bold text-zinc-400 mb-1" data-testid="text-stats-week">19</div>
              <div className="text-xs text-zinc-500 uppercase tracking-wider font-semibold">Semana de 2026</div>
            </div>
          </div>
        </div>
      </section>

      {/* Main Charts Area */}
      <section id="charts" className="py-24" data-testid="section-charts">
        <div className="container mx-auto px-4 flex flex-col lg:flex-row gap-16">
          {/* Hot 100 */}
          <div className="flex-1">
            <div className="flex items-end justify-between mb-10 pb-4 border-b border-border">
              <div>
                <h2 className="text-4xl font-display font-bold text-white flex items-center gap-3">
                  HOT 100 <span className="text-primary drop-shadow-[0_0_10px_rgba(57,255,20,0.3)]">MÉXICO</span>
                </h2>
                <p className="text-zinc-500 mt-2 font-mono text-sm">Actualizado Semanalmente</p>
              </div>
              <button className="hidden sm:flex items-center gap-2 text-sm text-white hover:text-primary transition-colors uppercase font-bold tracking-wider" data-testid="button-view-all-charts">
                Ver Top Completo <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2">
              {HOT_100.map((track, i) => (
                <motion.div
                  key={track.rank}
                  initial={{ opacity: 0, y: 10 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-50px" }}
                  transition={{ delay: i * 0.05 }}
                  className="flex items-center gap-4 p-4 bg-card/50 hover:bg-card border border-transparent hover:border-primary/30 transition-all duration-300 group"
                  data-testid={`row-track-${track.rank}`}
                >
                  <div className="w-12 text-center">
                    <span className="text-3xl font-display font-bold text-zinc-600 group-hover:text-transparent group-hover:bg-clip-text group-hover:bg-gradient-to-b group-hover:from-white group-hover:to-gray-400 transition-colors">{track.rank}</span>
                  </div>

                  <div className="w-20 hidden sm:flex justify-center text-xs font-bold">
                    {track.trend === "up" && <span className="text-primary flex items-center gap-1"><ArrowUpRight className="w-4 h-4" /> subió</span>}
                    {track.trend === "down" && <span className="text-red-500 flex items-center gap-1"><ArrowDownRight className="w-4 h-4" /> bajó</span>}
                    {track.trend === "new" && <span className="text-blue-400">NUEVO</span>}
                  </div>

                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-bold text-white truncate group-hover:text-primary transition-colors">{track.title}</h3>
                    <p className="text-sm text-zinc-400 truncate">{track.artist}</p>
                  </div>

                  <div className="hidden md:block w-40">
                    <span className="inline-block px-2 py-1 text-xs border border-zinc-800 text-zinc-400 uppercase tracking-wider bg-black/50">{track.genre}</span>
                  </div>

                  <div className="w-32 text-right font-mono text-sm text-zinc-300">
                    {track.streams}
                  </div>
                </motion.div>
              ))}
            </div>

            <button className="w-full mt-6 py-4 border border-border text-white font-bold uppercase tracking-widest hover:bg-primary hover:text-black hover:border-primary transition-colors sm:hidden" data-testid="button-view-all-charts-mobile">
              Ver Top Completo
            </button>
          </div>

          {/* Sidebar */}
          <div className="w-full lg:w-[400px] flex flex-col gap-12">

            {/* Trending Artists */}
            <div id="artistas" data-testid="section-artistas">
              <h3 className="text-2xl font-display font-bold text-white mb-6 uppercase border-b border-border pb-4 flex items-center gap-2">
                <TrendingUp className="text-primary w-6 h-6" /> Artistas Tendencia
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-4">
                {TRENDING_ARTISTS.map((artist, i) => (
                  <motion.div
                    key={artist.name}
                    initial={{ opacity: 0, x: 20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.1 }}
                    className="flex items-center gap-4 bg-card border border-border p-4 hover:border-primary/50 transition-colors group"
                    data-testid={`card-artist-${i}`}
                  >
                    <div className={`w-12 h-12 rounded-full bg-gradient-to-br ${artist.color} flex items-center justify-center text-white font-display font-bold text-xl flex-shrink-0 group-hover:scale-110 transition-transform`}>
                      {artist.name.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start">
                        <h4 className="font-bold text-white truncate">{artist.name}</h4>
                        <span className="text-xs font-bold text-primary bg-primary/10 px-1 py-0.5 rounded border border-primary/20">{artist.growth}</span>
                      </div>
                      <p className="text-xs text-zinc-500 truncate">{artist.genre}</p>
                      <p className="text-[10px] uppercase tracking-wider text-zinc-400 mt-1">{artist.streams}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>

            {/* Genres Breakdown */}
            <div id="generos" data-testid="section-generos">
              <h3 className="text-2xl font-display font-bold text-white mb-6 uppercase border-b border-border pb-4 flex items-center gap-2">
                <Disc className="text-primary w-6 h-6" /> Por Género
              </h3>
              <div className="space-y-4">
                {GENRES.map((genre, i) => (
                  <motion.div
                    key={genre.name}
                    initial={{ opacity: 0, scale: 0.95 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.1 }}
                    className="relative p-5 border border-border bg-[#0c0c0c] overflow-hidden group cursor-pointer"
                    data-testid={`card-genre-${i}`}
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-primary/10 to-transparent w-0 group-hover:w-full transition-all duration-500 ease-out" />
                    <div className="relative z-10">
                      <h4 className="text-xl font-display font-bold text-white mb-1 group-hover:text-primary transition-colors">{genre.name}</h4>
                      <p className="text-sm text-zinc-400 mb-3">Top: <span className="text-zinc-200">{genre.song}</span></p>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-mono text-primary">{genre.streams} streams</span>
                        <ChevronRight className="w-4 h-4 text-zinc-600 group-hover:text-primary transition-colors" />
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* Chart History Teaser */}
      <section id="historial" className="py-24 border-t border-border bg-[#070707]" data-testid="section-historial">
        <div className="container mx-auto px-4">
          <div className="flex items-end justify-between mb-10 pb-4 border-b border-border">
            <div>
              <h2 className="text-4xl font-display font-bold text-white flex items-center gap-3">
                <Clock className="text-primary w-8 h-8" />
                HISTORIAL <span className="text-primary drop-shadow-[0_0_10px_rgba(57,255,20,0.3)]">DE CHARTS</span>
              </h2>
              <p className="text-zinc-500 mt-2 font-mono text-sm">Semanas anteriores — movimientos y tendencias</p>
            </div>
            <button className="hidden sm:flex items-center gap-2 text-sm text-white hover:text-primary transition-colors uppercase font-bold tracking-wider" data-testid="button-view-full-history">
              Ver Historial Completo <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            {CHART_HISTORY.map((week, i) => (
              <motion.div
                key={week.week}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="bg-card border border-border p-6 group hover:border-primary/40 transition-colors duration-300 cursor-pointer"
                data-testid={`card-history-week-${i}`}
              >
                <div className="flex items-center justify-between mb-4">
                  <span className="text-xs font-mono text-primary uppercase tracking-wider font-bold">{week.week}</span>
                  <span className="text-xs text-zinc-600 font-mono">{week.date}</span>
                </div>

                <div className="mb-4">
                  <div className="text-[10px] text-zinc-600 uppercase tracking-widest mb-1">Número 1</div>
                  <h4 className="text-lg font-display font-bold text-white leading-tight group-hover:text-primary transition-colors">{week.number1}</h4>
                  <p className="text-xs text-zinc-500 mt-0.5 truncate">{week.artist}</p>
                </div>

                <div className="border-t border-border/50 pt-4 mt-4 flex items-center justify-between">
                  <div>
                    <div className="text-[10px] text-zinc-600 uppercase tracking-widest mb-1">Mayor Movimiento</div>
                    <div className="flex items-center gap-1">
                      <ArrowUpRight className="w-3 h-3 text-primary flex-shrink-0" />
                      <span className="text-xs text-zinc-300 truncate">{week.bigMover.title}</span>
                    </div>
                    <span className="text-xs font-bold text-primary">{week.bigMover.movement} posiciones</span>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] text-zinc-600 uppercase tracking-widest mb-1">Total</div>
                    <span className="text-sm font-display font-bold text-zinc-300">{week.totalStreams}</span>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="mt-8 py-5 border border-dashed border-zinc-800 text-center text-zinc-600 font-mono text-sm hover:border-primary/40 hover:text-zinc-400 transition-colors cursor-pointer group"
            data-testid="button-load-more-history"
          >
            <span className="group-hover:text-primary transition-colors">Ver semanas anteriores</span>
            <ChevronRight className="inline w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border bg-[#050505] pt-16 pb-8" data-testid="footer">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row justify-between items-center md:items-start gap-8 mb-12">
            <div className="text-center md:text-left">
              <img src={logoUrl} alt="Mexico Charts" className="h-16 object-contain mb-4 mx-auto md:mx-0 grayscale hover:grayscale-0 transition-all duration-500" />
              <p className="text-zinc-400 font-display font-bold tracking-widest uppercase text-sm">La Referencia de la Música Mexicana</p>
            </div>

            <div className="flex flex-wrap justify-center gap-6 font-mono text-sm text-zinc-500 uppercase tracking-wider">
              <Link href="#charts" className="hover:text-primary transition-colors" data-testid="link-footer-charts">Charts</Link>
              <Link href="#artistas" className="hover:text-primary transition-colors" data-testid="link-footer-artistas">Artistas</Link>
              <Link href="#generos" className="hover:text-primary transition-colors" data-testid="link-footer-generos">Géneros</Link>
              <Link href="#historial" className="hover:text-primary transition-colors" data-testid="link-footer-historial">Historial</Link>
              <Link href="#acerca" className="hover:text-primary transition-colors" data-testid="link-footer-acerca">Acerca de</Link>
              <Link href="#contacto" className="hover:text-primary transition-colors" data-testid="link-footer-contacto">Contacto</Link>
            </div>
          </div>

          <div className="border-t border-border/50 pt-8 flex flex-col md:flex-row justify-between items-center gap-4 text-xs text-zinc-600">
            <p>© 2026 Mexico Charts. Todos los derechos reservados.</p>
            <div className="flex gap-4">
              <Link href="#" className="hover:text-white transition-colors" data-testid="link-footer-terms">Términos</Link>
              <Link href="#" className="hover:text-white transition-colors" data-testid="link-footer-privacy">Privacidad</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
