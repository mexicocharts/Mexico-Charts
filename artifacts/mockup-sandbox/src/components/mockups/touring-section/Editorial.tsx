import React from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, MapPin, Calendar } from 'lucide-react';
import './_group.css';

const SHOWS = [
  { artist: "Peso Pluma", venue: "Foro Sol, CDMX", date: "14 Jun" },
  { artist: "Grupo Frontera", venue: "Auditorio GDL, Guadalajara", date: "21 Jun" },
  { artist: "Natanael Cano", venue: "Palacio de los Deportes, CDMX", date: "5 Jul" },
  { artist: "Eslabon Armado", venue: "Arena Monterrey", date: "12 Jul" },
  { artist: "Junior H", venue: "Auditorio Telmex, GDL", date: "19 Jul" },
  { artist: "Xavi", venue: "Plaza de Toros, Tijuana", date: "26 Jul" }
];

export function Editorial() {
  return (
    <div className="touring-editorial-container">
      <div className="touring-editorial-noise"></div>
      
      {/* Top Hero Strip */}
      <div className="w-full border-b border-white/10 px-6 md:px-12 py-4 flex items-center justify-between relative z-20 bg-[#080808]/80 backdrop-blur-sm">
        <div className="text-xs tracking-[0.3em] text-white/50 font-bold uppercase">
          Mexico Charts /// Live
        </div>
        <div className="text-xs tracking-[0.2em] neon-text font-bold uppercase">
          Verano 2026
        </div>
      </div>

      <div className="w-full flex flex-col lg:flex-row relative z-20 min-h-[calc(100vh-60px)]">
        
        {/* Left Column: Giant Typography */}
        <div className="w-full lg:w-5/12 p-8 md:p-12 lg:p-20 flex flex-col justify-between border-b lg:border-b-0 lg:border-r border-white/10 relative">
          <div className="absolute top-0 right-0 w-full h-full bg-gradient-to-br from-[#39FF14]/5 to-transparent opacity-50 pointer-events-none"></div>
          
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="flex flex-col gap-2 relative z-10"
          >
            <h1 className="font-display text-[15vw] lg:text-[8vw] leading-[0.85] m-0 text-white select-none">
              GIRAS<br/>
              <span className="text-transparent" style={{ WebkitTextStroke: '2px rgba(255,255,255,0.2)' }}>&</span><br/>
              <span className="neon-text">CONCIER</span><br/>
              TOS
            </h1>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.5, duration: 1 }}
            className="mt-12 lg:mt-0 max-w-sm"
          >
            <p className="text-white/60 text-lg leading-relaxed font-medium">
              La cartelera definitiva de la música mexicana. Fechas, venues y el impacto en vivo de los artistas que dominan los charts globales.
            </p>
            <div className="mt-8 glitch-line w-full"></div>
          </motion.div>
        </div>

        {/* Right Column: Shows List */}
        <div className="w-full lg:w-7/12 shows-scroll-container overflow-y-auto max-h-[calc(100vh-60px)] bg-[#0A0A0A]">
          <div className="p-6 md:p-12 lg:p-20 flex flex-col gap-8">
            
            {SHOWS.map((show, index) => (
              <motion.div 
                key={index}
                initial={{ opacity: 0, x: 20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, margin: "-100px" }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                className="show-card group cursor-pointer border-b border-white/5 pb-8 pl-4 lg:pl-8 relative"
              >
                <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
                  <div className="flex flex-col gap-1">
                    <h2 className="font-display text-4xl md:text-5xl lg:text-6xl tracking-tight text-white group-hover:text-white transition-colors">
                      {show.artist}
                    </h2>
                    <div className="flex flex-wrap items-center gap-4 mt-2 text-white/50 text-sm md:text-base font-medium">
                      <span className="flex items-center gap-1.5 group-hover:text-white/80 transition-colors">
                        <MapPin size={16} className="neon-text" />
                        {show.venue}
                      </span>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4 lg:flex-col lg:items-end lg:gap-2 text-right">
                    <div className="flex items-center gap-2 text-xl md:text-2xl font-bold text-white/90">
                      <Calendar size={20} className="text-[#39FF14]" />
                      {show.date}
                    </div>
                    <div className="hidden lg:flex items-center gap-2 text-[#39FF14] text-sm font-bold uppercase tracking-wider opacity-0 group-hover:opacity-100 transition-opacity transform translate-x-4 group-hover:translate-x-0">
                      Boletos <ArrowRight size={16} />
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}

            <motion.div 
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              className="mt-12 flex justify-center lg:justify-start"
            >
              <button className="flex items-center gap-3 bg-transparent border-2 border-[#39FF14] text-[#39FF14] px-8 py-4 font-bold uppercase tracking-widest text-sm hover:bg-[#39FF14] hover:text-black transition-all duration-300">
                Ver Todos los Shows <ArrowRight size={18} />
              </button>
            </motion.div>

          </div>
        </div>

      </div>
    </div>
  );
}

export default Editorial;
