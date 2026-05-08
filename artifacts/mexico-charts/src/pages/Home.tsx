import { useState } from "react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { Search, Menu, Users, FileText, Database, Globe, Users2, Diamond } from "lucide-react";
import { SiInstagram, SiX, SiTiktok, SiYoutube } from "react-icons/si";

const logoUrl = `${import.meta.env.BASE_URL}mexico-charts-logo.png`;

const COLORS = [
  "from-green-600 to-green-900",
  "from-zinc-500 to-zinc-800",
  "from-emerald-600 to-emerald-900",
  "from-lime-600 to-lime-900",
  "from-teal-600 to-teal-900",
  "from-cyan-700 to-cyan-950",
  "from-green-700 to-zinc-900",
  "from-zinc-400 to-zinc-700",
  "from-emerald-500 to-zinc-800",
  "from-lime-700 to-emerald-950"
];

const TOP_10 = [
  { rank: 1, name: "Peso Pluma", listeners: "32.4M oyentes mensuales" },
  { rank: 2, name: "Fuerza Regida", listeners: "12.4M oyentes mensuales" },
  { rank: 3, name: "Natanael Cano", listeners: "11.7M oyentes mensuales" },
  { rank: 4, name: "Junior H", listeners: "9.8M oyentes mensuales" },
  { rank: 5, name: "Luis R Conriquez", listeners: "7.6M oyentes mensuales" },
  { rank: 6, name: "Carin León", listeners: "7.1M oyentes mensuales" },
  { rank: 7, name: "Grupo Frontera", listeners: "6.2M oyentes mensuales" },
  { rank: 8, name: "Xavi", listeners: "5.4M oyentes mensuales" },
  { rank: 9, name: "Gabito Ballesteros", listeners: "4.7M oyentes mensuales" },
  { rank: 10, name: "Santa Fe Klan", listeners: "4.1M oyentes mensuales" }
];

const ASCENSO = [
  { rank: 1, name: "Tito Double P", growth: "+78%" },
  { rank: 2, name: "Oscar Maydon", growth: "+65%" },
  { rank: 3, name: "Marca Registrada", growth: "+56%" },
  { rank: 4, name: "Clave Especial", growth: "+49%" },
  { rank: 5, name: "Jasiel Nuñez", growth: "+47%" }
];

const TOURING = [
  { rank: 1, tour: "Luis Miguel Tour 2023-24", gross: "$318.2M" },
  { rank: 2, tour: "Peso Pluma Éxodo Tour", gross: "$60M+" },
  { rank: 3, tour: "RBD Soy Rebelde Tour", gross: "$54.4M" },
  { rank: 4, tour: "Grupo Firme Tour 2022", gross: "$45.7M" },
  { rank: 5, tour: "Bad Bunny World's Hottest Tour", gross: "$41.9M" }
];

const NOTICIAS = [
  { tag: "TOURING", title: "Peso Pluma anuncia nuevas fechas en Europa", date: "16 MAY 2024" },
  { tag: "STREAMING", title: "Fuerza Regida rompe récord en Spotify México", date: "15 MAY 2024" },
  { tag: "CHARTS", title: "Top 100 México: Lo más escuchado del momento", date: "14 MAY 2024" }
];

const REPORTES = [
  { tag: "TOURING", title: "Luis Miguel Tour 2023-24", desc: "Análisis completo del tour más exitoso del año." },
  { tag: "TOURING", title: "Peso Pluma Éxodo Tour", desc: "Datos completos, ciudades, gross, asistentes y más." },
  { tag: "STREAMING", title: "Artistas Mexicanos en Spotify 2024", desc: "Ranking completo de oyentes, streams y crecimiento." },
  { tag: "YOUTUBE", title: "Top Mexicanos en YouTube", desc: "Los artistas mexicanos más vistos del momento." }
];

export default function Home() {
  const [activeTab, setActiveTab] = useState("SPOTIFY");

  return (
    <div className="min-h-[100dvh] bg-[#050505] text-zinc-300 selection:bg-primary selection:text-black font-sans">
      
      {/* NAVIGATION */}
      <nav className="sticky top-0 z-50 w-full border-b border-white/10 bg-[#050505]/90 backdrop-blur-md" data-testid="navigation">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex-shrink-0" data-testid="link-logo">
            <img src={logoUrl} alt="Mexico Charts" className="h-8 object-contain" />
          </Link>

          <div className="hidden lg:flex items-center space-x-6 text-sm font-bold tracking-wider uppercase text-zinc-400">
            <Link href="/" className="text-primary transition-colors" data-testid="link-nav-inicio">INICIO</Link>
            <Link href="#" className="hover:text-white transition-colors" data-testid="link-nav-artistas">ARTISTAS</Link>
            <Link href="#" className="hover:text-white transition-colors" data-testid="link-nav-charts">CHARTS</Link>
            <Link href="#" className="hover:text-white transition-colors" data-testid="link-nav-touring">TOURING</Link>
            <Link href="#" className="hover:text-white transition-colors" data-testid="link-nav-streaming">STREAMING</Link>
            <Link href="#" className="hover:text-white transition-colors" data-testid="link-nav-noticias">NOTICIAS</Link>
            <Link href="#" className="hover:text-white transition-colors" data-testid="link-nav-acerca">ACERCA DE</Link>
          </div>

          <div className="hidden lg:flex items-center space-x-4">
            <button className="text-zinc-400 hover:text-white transition-colors" data-testid="btn-search">
              <Search className="w-5 h-5" />
            </button>
            <div className="h-4 w-px bg-white/20 mx-2"></div>
            <a href="#" className="text-zinc-400 hover:text-white transition-colors" data-testid="link-social-ig"><SiInstagram className="w-4 h-4" /></a>
            <a href="#" className="text-zinc-400 hover:text-white transition-colors" data-testid="link-social-x"><SiX className="w-4 h-4" /></a>
            <a href="#" className="text-zinc-400 hover:text-white transition-colors" data-testid="link-social-tk"><SiTiktok className="w-4 h-4" /></a>
            <a href="#" className="text-zinc-400 hover:text-white transition-colors" data-testid="link-social-yt"><SiYoutube className="w-4 h-4" /></a>
          </div>

          <button className="lg:hidden text-zinc-400" data-testid="btn-mobile-menu">
            <Menu className="w-6 h-6" />
          </button>
        </div>
      </nav>

      {/* HERO SECTION */}
      <section className="border-b border-white/10" data-testid="section-hero">
        <div className="container mx-auto flex flex-col lg:flex-row min-h-[500px]">
          
          <div className="lg:w-[60%] p-8 lg:p-16 flex flex-col justify-center border-b lg:border-b-0 lg:border-r border-white/10 relative">
            <div className="inline-block border border-primary text-primary text-xs font-bold px-2 py-1 mb-8 uppercase tracking-widest w-max">
              + INFORME ESPECIAL
            </div>
            
            <motion.h1 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-5xl md:text-7xl font-black uppercase italic leading-[0.9] tracking-tighter text-white mb-6"
            >
              LA FUENTE LÍDER DE<br/>
              ESTADÍSTICAS DE LA<br/>
              <span className="text-primary drop-shadow-[0_0_15px_rgba(57,255,20,0.5)]">MÚSICA MEXICANA.</span>
            </motion.h1>
            
            <p className="text-sm md:text-base text-zinc-400 tracking-[0.2em] font-bold uppercase mb-8">
              DATOS. ANÁLISIS. IMPACTO GLOBAL.
            </p>
            
            <p className="text-zinc-400 max-w-xl text-lg leading-relaxed mb-10 font-medium">
              Cubriendo el crecimiento de los artistas mexicanos y su impacto en el mundo con estadísticas reales y reportes exclusivos.
            </p>
            
            <button className="bg-primary text-black font-bold px-8 py-4 uppercase tracking-widest hover:bg-white transition-colors w-max" data-testid="btn-hero-cta">
              EXPLORAR REPORTES →
            </button>

            <div className="absolute bottom-8 left-8 lg:left-16 flex gap-2">
              <div className="w-2 h-2 rounded-full bg-primary shadow-[0_0_8px_rgba(57,255,20,0.8)]"></div>
              <div className="w-2 h-2 rounded-full bg-zinc-700"></div>
              <div className="w-2 h-2 rounded-full bg-zinc-700"></div>
              <div className="w-2 h-2 rounded-full bg-zinc-700"></div>
            </div>
          </div>

          <div className="lg:w-[40%] p-8 lg:p-16 flex flex-col relative bg-[#0a0a0a] overflow-hidden group">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(57,255,20,0.15)_0%,transparent_70%)] pointer-events-none"></div>
            <div className="absolute inset-0 flex items-center justify-center opacity-30">
               <div className="w-full h-full bg-gradient-to-br from-[#111] to-[#050505] border border-white/5 relative">
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(57,255,20,0.2)_0%,transparent_50%)]"></div>
               </div>
            </div>

            <div className="relative z-10 flex flex-col h-full justify-between">
              <div className="inline-block text-zinc-500 text-xs font-bold uppercase tracking-widest mb-12">
                + REPORTE DESTACADO
              </div>
              
              <div className="mt-auto">
                <h3 className="text-3xl font-bold text-white mb-2 uppercase tracking-wide">PESO PLUMA</h3>
                <h2 className="text-5xl lg:text-6xl font-black italic text-primary uppercase mb-6 drop-shadow-[0_0_10px_rgba(57,255,20,0.3)]">
                  ÉXODO TOUR
                </h2>
                <p className="text-zinc-400 font-bold uppercase tracking-wider text-sm mb-8 max-w-sm">
                  ANÁLISIS COMPLETO DEL TOUR MÁS IMPORTANTE DE 2024
                </p>
                <button className="border border-white/30 text-white font-bold px-6 py-3 uppercase tracking-widest hover:border-primary hover:text-primary transition-colors text-sm" data-testid="btn-hero-report">
                  VER REPORTE COMPLETO →
                </button>
              </div>
            </div>
          </div>
          
        </div>
      </section>

      {/* STATS BAR */}
      <section className="border-b border-white/10 bg-[#080808]" data-testid="section-stats">
        <div className="container mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-5 divide-x divide-y md:divide-y-0 divide-white/10">
            <div className="p-6 text-center flex flex-col items-center">
              <Users className="w-6 h-6 text-primary mb-3" />
              <div className="text-3xl font-black text-white mb-1">250+</div>
              <div className="text-xs text-zinc-500 font-bold uppercase tracking-wider">Artistas Analizados<br/><span className="text-zinc-600">Activos</span></div>
            </div>
            <div className="p-6 text-center flex flex-col items-center">
              <FileText className="w-6 h-6 text-primary mb-3" />
              <div className="text-3xl font-black text-white mb-1">150+</div>
              <div className="text-xs text-zinc-500 font-bold uppercase tracking-wider">Reportes Publicados<br/><span className="text-zinc-600">Desde 2022</span></div>
            </div>
            <div className="p-6 text-center flex flex-col items-center">
              <Database className="w-6 h-6 text-primary mb-3" />
              <div className="text-3xl font-black text-white mb-1">10M+</div>
              <div className="text-xs text-zinc-500 font-bold uppercase tracking-wider">Datos Analizados<br/><span className="text-zinc-600">De registros</span></div>
            </div>
            <div className="p-6 text-center flex flex-col items-center">
              <Globe className="w-6 h-6 text-primary mb-3" />
              <div className="text-3xl font-black text-white mb-1">60+</div>
              <div className="text-xs text-zinc-500 font-bold uppercase tracking-wider">Países Cubiertos<br/><span className="text-zinc-600">En todo el mundo</span></div>
            </div>
            <div className="p-6 text-center flex flex-col items-center md:col-span-1 col-span-2">
              <Users2 className="w-6 h-6 text-primary mb-3" />
              <div className="text-3xl font-black text-white mb-1">250K+</div>
              <div className="text-xs text-zinc-500 font-bold uppercase tracking-wider">Comunidad Global<br/><span className="text-zinc-600">Seguidores</span></div>
            </div>
          </div>
        </div>
      </section>

      {/* MAIN CONTENT */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
            
            {/* LEFT COLUMN: TOP 10 */}
            <div className="lg:col-span-5" data-testid="section-top10">
              <div className="flex items-end justify-between border-b border-white/20 pb-4 mb-6">
                <h2 className="text-2xl font-black text-white uppercase tracking-wide">TOP 10 MÉXICO <span className="text-primary">+</span></h2>
                <a href="#" className="text-primary text-xs font-bold uppercase tracking-widest hover:text-white transition-colors">VER TODOS LOS CHARTS →</a>
              </div>

              <div className="flex flex-wrap gap-2 mb-6">
                {["SPOTIFY", "YOUTUBE", "APPLE MUSIC", "DEEZER"].map(tab => (
                  <button 
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`px-3 py-1.5 text-xs font-bold uppercase tracking-wider border ${activeTab === tab ? 'bg-primary text-black border-primary' : 'bg-transparent text-zinc-500 border-white/10 hover:text-white'}`}
                  >
                    {tab}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                {TOP_10.map((artist, idx) => (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: idx * 0.05 }}
                    key={artist.rank} 
                    className="flex items-center gap-4 group p-2 hover:bg-white/5 rounded transition-colors"
                  >
                    <div className="text-xl font-black text-zinc-600 w-6 text-center">{artist.rank}</div>
                    <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${COLORS[idx % COLORS.length]} flex-shrink-0 border border-white/10 shadow-[0_0_10px_rgba(0,0,0,0.5)]`}></div>
                    <div className="min-w-0">
                      <div className="text-white font-bold truncate group-hover:text-primary transition-colors">{artist.name}</div>
                      <div className="text-xs text-zinc-500 truncate">{artist.listeners}</div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>

            {/* CENTER COLUMN: ASCENSO, MAPA, TOURING */}
            <div className="lg:col-span-4 flex flex-col gap-12">
              
              {/* Artistas en Ascenso */}
              <div data-testid="section-artistas-ascenso">
                <div className="flex items-end justify-between border-b border-white/20 pb-4 mb-6">
                  <h2 className="text-xl font-black text-white uppercase tracking-wide">ARTISTAS EN ASCENSO</h2>
                  <a href="#" className="text-primary text-xs font-bold uppercase tracking-widest hover:text-white transition-colors">VER TODOS →</a>
                </div>

                <div className="space-y-4">
                  {ASCENSO.map((artist, idx) => (
                    <motion.div 
                      initial={{ opacity: 0, x: -10 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: idx * 0.1 }}
                      key={artist.rank} 
                      className="flex items-center gap-4 bg-[#0a0a0a] border border-white/5 p-3 hover:border-primary/30 transition-colors"
                    >
                      <div className="text-lg font-black text-zinc-600 w-4 text-center">{artist.rank}</div>
                      <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${COLORS[(idx + 3) % COLORS.length]} flex-shrink-0 border border-white/10`}></div>
                      <div className="text-white font-bold flex-1 truncate">{artist.name}</div>
                      <div className="bg-primary/10 border border-primary/20 text-primary text-xs font-bold px-2 py-1 rounded">
                        {artist.growth}
                      </div>
                    </motion.div>
                  ))}
                </div>
                <p className="text-xs text-zinc-600 font-medium mt-3 uppercase tracking-wider">Crecimiento mensual en Spotify</p>
              </div>

              {/* Mapa Global */}
              <div data-testid="section-mapa-global">
                <div className="flex items-end justify-between border-b border-white/20 pb-4 mb-6">
                  <h2 className="text-xl font-black text-white uppercase tracking-wide">MAPA GLOBAL <span className="text-primary">+</span></h2>
                </div>
                
                <div className="relative border border-white/10 bg-[#0a0a0a] aspect-[4/3] flex flex-col justify-end p-6 overflow-hidden group">
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(57,255,20,0.2)_0%,transparent_60%)] group-hover:bg-[radial-gradient(circle_at_center,rgba(57,255,20,0.3)_0%,transparent_70%)] transition-colors duration-700"></div>
                  
                  {/* Decorative map grid placeholder */}
                  <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(#fff 1px, transparent 1px)', backgroundSize: '20px 20px' }}></div>

                  <div className="relative z-10">
                    <p className="text-white font-bold text-lg leading-tight mb-4 max-w-[200px] drop-shadow-md">
                      Explora dónde escuchan más a los artistas mexicanos en el mundo.
                    </p>
                    <button className="text-primary text-xs font-bold uppercase tracking-widest hover:text-white transition-colors">
                      VER MAPA INTERACTIVO →
                    </button>
                  </div>
                </div>
              </div>

              {/* Touring Actual */}
              <div data-testid="section-touring">
                <div className="flex items-end justify-between border-b border-white/20 pb-4 mb-6">
                  <h2 className="text-xl font-black text-white uppercase tracking-wide">TOURING ACTUAL <span className="text-primary">+</span></h2>
                  <a href="#" className="text-primary text-xs font-bold uppercase tracking-widest hover:text-white transition-colors">VER RANKING →</a>
                </div>

                <div className="inline-block text-zinc-500 text-xs font-bold uppercase tracking-widest mb-4">
                  Top Tours Mexicanos
                </div>

                <div className="space-y-3">
                  {TOURING.map((tour, idx) => (
                    <div key={tour.rank} className="flex justify-between items-center border-b border-white/5 pb-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="text-zinc-600 font-bold">{tour.rank}.</span>
                        <span className="text-zinc-300 font-medium truncate">{tour.tour}</span>
                      </div>
                      <span className="text-white font-bold font-mono text-sm ml-4">{tour.gross}</span>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-zinc-600 font-medium mt-3 uppercase tracking-wider">Gross reportado (USD)</p>
              </div>

            </div>

            {/* RIGHT COLUMN: SÍGUENOS, NEWSLETTER, NOTICIAS */}
            <div className="lg:col-span-3 flex flex-col gap-10">
              
              {/* Síguenos */}
              <div data-testid="section-siguenos">
                <h2 className="text-lg font-black text-white uppercase tracking-wide mb-2">SÍGUENOS</h2>
                <p className="text-sm text-zinc-400 mb-4">Mantente al día con las últimas estadísticas.</p>
                <div className="flex flex-col gap-2">
                  <a href="#" className="flex items-center justify-center gap-3 w-full py-3 border border-white/10 hover:border-primary hover:text-primary transition-colors text-white text-sm font-bold uppercase tracking-widest group">
                    <SiInstagram className="w-5 h-5 group-hover:scale-110 transition-transform" /> Instagram
                  </a>
                  <a href="#" className="flex items-center justify-center gap-3 w-full py-3 border border-white/10 hover:border-primary hover:text-primary transition-colors text-white text-sm font-bold uppercase tracking-widest group">
                    <SiX className="w-5 h-5 group-hover:scale-110 transition-transform" /> X (Twitter)
                  </a>
                  <a href="#" className="flex items-center justify-center gap-3 w-full py-3 border border-white/10 hover:border-primary hover:text-primary transition-colors text-white text-sm font-bold uppercase tracking-widest group">
                    <SiTiktok className="w-5 h-5 group-hover:scale-110 transition-transform" /> TikTok
                  </a>
                  <a href="#" className="flex items-center justify-center gap-3 w-full py-3 border border-white/10 hover:border-primary hover:text-primary transition-colors text-white text-sm font-bold uppercase tracking-widest group">
                    <SiYoutube className="w-5 h-5 group-hover:scale-110 transition-transform" /> YouTube
                  </a>
                </div>
              </div>

              {/* Newsletter */}
              <div data-testid="section-newsletter" className="bg-[#0a0a0a] border border-white/10 p-6">
                <h2 className="text-lg font-black text-white uppercase tracking-wide mb-2">NEWSLETTER</h2>
                <p className="text-sm text-zinc-400 mb-6 leading-relaxed">Recibe reportes exclusivos, noticias y estadísticas directo a tu correo.</p>
                <div className="flex flex-col gap-3">
                  <input 
                    type="email" 
                    placeholder="Tu correo electrónico" 
                    className="w-full bg-[#050505] border border-white/20 text-white px-4 py-3 focus:outline-none focus:border-primary transition-colors"
                  />
                  <button className="w-full bg-primary text-black font-bold uppercase tracking-widest py-3 hover:bg-white transition-colors">
                    SUSCRIBIRME
                  </button>
                </div>
              </div>

              {/* Últimas Noticias */}
              <div data-testid="section-noticias">
                <div className="flex items-end justify-between border-b border-white/20 pb-4 mb-6">
                  <h2 className="text-lg font-black text-white uppercase tracking-wide">ÚLTIMAS NOTICIAS</h2>
                  <a href="#" className="text-primary text-xs font-bold uppercase tracking-widest hover:text-white transition-colors">VER TODAS →</a>
                </div>

                <div className="space-y-6">
                  {NOTICIAS.map((news, idx) => (
                    <div key={idx} className="flex gap-4 group cursor-pointer">
                      <div className="w-20 h-20 bg-[#111] border border-white/5 flex-shrink-0 overflow-hidden relative">
                         <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.05)_0%,transparent_100%)]"></div>
                      </div>
                      <div className="flex flex-col justify-center">
                        <span className="text-primary text-[10px] font-bold uppercase tracking-widest mb-1">{news.tag}</span>
                        <h3 className="text-white font-bold leading-tight mb-2 group-hover:text-primary transition-colors line-clamp-2 text-sm">{news.title}</h3>
                        <span className="text-zinc-600 text-[10px] uppercase tracking-wider">{news.date}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          </div>
        </div>
      </section>

      {/* ÚLTIMOS REPORTES SECTION */}
      <section className="py-16 border-t border-white/10" data-testid="section-reportes">
        <div className="container mx-auto px-4">
          <div className="flex items-end justify-between border-b border-white/20 pb-4 mb-8">
            <h2 className="text-2xl font-black text-white uppercase tracking-wide">ÚLTIMOS REPORTES <span className="text-primary">+</span></h2>
            <a href="#" className="text-primary text-xs font-bold uppercase tracking-widest hover:text-white transition-colors hidden sm:block">VER TODOS LOS REPORTES →</a>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {REPORTES.map((report, idx) => (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.1 }}
                key={idx} 
                className="bg-[#0a0a0a] border border-white/10 p-6 flex flex-col group hover:border-primary/50 transition-colors cursor-pointer relative overflow-hidden"
              >
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-primary/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <span className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest mb-3 group-hover:text-primary transition-colors">{report.tag}</span>
                <h3 className="text-lg font-bold text-white leading-tight mb-3 uppercase tracking-wide">{report.title}</h3>
                <p className="text-sm text-zinc-400 mb-6 flex-1">{report.desc}</p>
                <div className="text-xs font-bold uppercase tracking-widest text-white group-hover:text-primary transition-colors mt-auto">
                  VER REPORTE →
                </div>
              </motion.div>
            ))}
          </div>
          
          <a href="#" className="text-primary text-xs font-bold uppercase tracking-widest hover:text-white transition-colors block sm:hidden mt-8 text-center border border-white/10 py-4">VER TODOS LOS REPORTES →</a>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-white/10 bg-[#050505] pt-16 pb-8" data-testid="footer">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-12 mb-16">
            
            <div className="md:col-span-5 flex flex-col items-center md:items-start text-center md:text-left">
              <img src={logoUrl} alt="Mexico Charts" className="h-10 object-contain mb-6 grayscale" />
              <p className="text-zinc-500 max-w-sm text-sm leading-relaxed">
                Tu fuente #1 de estadísticas, charts y análisis de la música mexicana. De México para el mundo.
              </p>
            </div>

            <div className="md:col-span-2 flex flex-col items-center md:items-start">
              <h4 className="text-white font-bold uppercase tracking-widest text-sm mb-6">EXPLORAR</h4>
              <ul className="space-y-4 text-sm text-zinc-500 font-medium">
                <li><a href="#" className="hover:text-primary transition-colors">Artistas</a></li>
                <li><a href="#" className="hover:text-primary transition-colors">Charts</a></li>
                <li><a href="#" className="hover:text-primary transition-colors">Touring</a></li>
                <li><a href="#" className="hover:text-primary transition-colors">Streaming</a></li>
                <li><a href="#" className="hover:text-primary transition-colors">Noticias</a></li>
              </ul>
            </div>

            <div className="md:col-span-2 flex flex-col items-center md:items-start">
              <h4 className="text-white font-bold uppercase tracking-widest text-sm mb-6">RECURSOS</h4>
              <ul className="space-y-4 text-sm text-zinc-500 font-medium">
                <li><a href="#" className="hover:text-primary transition-colors">Reportes Especiales</a></li>
                <li><a href="#" className="hover:text-primary transition-colors">Ranking Anual</a></li>
                <li><a href="#" className="hover:text-primary transition-colors">Glosario</a></li>
                <li><a href="#" className="hover:text-primary transition-colors">Contacto</a></li>
              </ul>
            </div>

            <div className="md:col-span-3 flex flex-col items-center md:items-start">
              <h4 className="text-white font-bold uppercase tracking-widest text-sm mb-6">LEGAL</h4>
              <ul className="space-y-4 text-sm text-zinc-500 font-medium">
                <li><a href="#" className="hover:text-primary transition-colors">Términos de Uso</a></li>
                <li><a href="#" className="hover:text-primary transition-colors">Política de Privacidad</a></li>
                <li><a href="#" className="hover:text-primary transition-colors">Política de Cookies</a></li>
              </ul>
            </div>

          </div>

          <div className="flex flex-col md:flex-row items-center justify-between border-t border-white/10 pt-8 gap-4">
            <div className="flex items-center gap-4">
              <a href="#" className="text-zinc-600 hover:text-white transition-colors"><SiInstagram className="w-5 h-5" /></a>
              <a href="#" className="text-zinc-600 hover:text-white transition-colors"><SiX className="w-5 h-5" /></a>
              <a href="#" className="text-zinc-600 hover:text-white transition-colors"><SiTiktok className="w-5 h-5" /></a>
              <a href="#" className="text-zinc-600 hover:text-white transition-colors"><SiYoutube className="w-5 h-5" /></a>
            </div>
            <div className="text-zinc-600 text-xs uppercase tracking-wider font-bold text-center">
              © 2024 Mexico Charts. Todos los derechos reservados.
            </div>
            <Diamond className="w-5 h-5 text-zinc-800" />
          </div>
        </div>
      </footer>

    </div>
  );
}
