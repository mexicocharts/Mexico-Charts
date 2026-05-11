import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Calendar, MapPin, ArrowRight, Ticket, Timer } from 'lucide-react';
import './_group.css';

const SHOWS = [
  {
    artist: 'Grupo Frontera',
    venue: 'Auditorio GDL',
    city: 'Guadalajara',
    date: '21 Jun',
    status: 'ENTRADAS'
  },
  {
    artist: 'Natanael Cano',
    venue: 'Palacio de los Deportes',
    city: 'CDMX',
    date: '5 Jul',
    status: 'SOLD OUT'
  },
  {
    artist: 'Eslabon Armado',
    venue: 'Arena Monterrey',
    city: 'Monterrey',
    date: '12 Jul',
    status: 'ENTRADAS'
  },
  {
    artist: 'Junior H',
    venue: 'Auditorio Telmex',
    city: 'GDL',
    date: '19 Jul',
    status: 'ENTRADAS'
  }
];

export function Stadium() {
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });

  useEffect(() => {
    const targetDate = new Date('2025-06-14T20:00:00').getTime();

    const updateTimer = () => {
      const now = new Date().getTime();
      const difference = targetDate - now;

      if (difference > 0) {
        setTimeLeft({
          days: Math.floor(difference / (1000 * 60 * 60 * 24)),
          hours: Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
          minutes: Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60)),
          seconds: Math.floor((difference % (1000 * 60)) / 1000)
        });
      }
    };

    updateTimer();
    const timerId = setInterval(updateTimer, 1000);
    return () => clearInterval(timerId);
  }, []);

  return (
    <div className="bg-[#080808] min-h-screen w-full text-white p-6 md:p-12 overflow-hidden font-stadium-body">
      
      {/* HEADER */}
      <div className="mb-10 max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <h2 className="font-stadium text-5xl md:text-7xl uppercase tracking-wider inline-block relative">
            Próximas Giras
            <span className="absolute -bottom-2 left-0 w-full h-[6px] bg-[#39FF14]"></span>
          </h2>
        </motion.div>
      </div>

      <div className="max-w-7xl mx-auto flex flex-col xl:flex-row gap-6">
        
        {/* HERO CARD - 70% width on large screens */}
        <motion.div 
          initial={{ opacity: 0, x: -50 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="xl:w-[70%] relative stadium-border-glow border-2 border-[#39FF14] bg-black rounded-xl overflow-hidden p-8 md:p-12 flex flex-col justify-end min-h-[500px] md:min-h-[600px]"
        >
          {/* Background Image / Overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-[#080808] via-[#080808]/80 to-transparent z-10" />
          <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1540039155732-d6824b5ce102?q=80&w=2800&auto=format&fit=crop')] bg-cover bg-center opacity-40 mix-blend-luminosity" />
          
          <div className="relative z-20 flex flex-col gap-6">
            <div className="flex flex-wrap items-center gap-4">
              <span className="bg-[#39FF14] text-black font-stadium px-4 py-1 text-xl uppercase tracking-widest skew-x-[-10deg]">
                <span className="skew-x-[10deg] block">Headliner</span>
              </span>
              <div className="flex items-center gap-2 text-[#39FF14] font-bold">
                <MapPin size={20} />
                <span className="uppercase tracking-wider">Foro Sol, CDMX</span>
              </div>
              <div className="flex items-center gap-2 text-white/80 font-bold">
                <Calendar size={20} />
                <span className="uppercase tracking-wider">14 Jun 2025</span>
              </div>
            </div>

            <h3 className="font-stadium text-7xl md:text-[120px] leading-[0.85] text-white uppercase drop-shadow-[0_0_15px_rgba(57,255,20,0.3)]">
              Peso <br className="hidden md:block"/> Pluma
            </h3>

            {/* Countdown Timer */}
            <div className="grid grid-cols-4 gap-4 mt-4 max-w-md bg-black/50 border border-[#39FF14]/30 p-4 backdrop-blur-sm rounded-lg">
              <div className="flex flex-col items-center">
                <span className="font-stadium text-4xl text-[#39FF14]">{timeLeft.days}</span>
                <span className="text-[10px] uppercase tracking-widest text-white/60">Días</span>
              </div>
              <div className="flex flex-col items-center">
                <span className="font-stadium text-4xl text-[#39FF14]">{timeLeft.hours}</span>
                <span className="text-[10px] uppercase tracking-widest text-white/60">Hrs</span>
              </div>
              <div className="flex flex-col items-center">
                <span className="font-stadium text-4xl text-[#39FF14]">{timeLeft.minutes}</span>
                <span className="text-[10px] uppercase tracking-widest text-white/60">Min</span>
              </div>
              <div className="flex flex-col items-center">
                <span className="font-stadium text-4xl text-[#39FF14]">{timeLeft.seconds}</span>
                <span className="text-[10px] uppercase tracking-widest text-white/60">Seg</span>
              </div>
            </div>

            <button className="mt-4 bg-[#39FF14] text-black font-stadium text-2xl uppercase py-4 px-8 w-fit hover:bg-white hover:text-black transition-colors duration-300 flex items-center gap-3 group">
              Comprar Boletos
              <Ticket className="w-6 h-6 group-hover:scale-110 transition-transform" />
            </button>
          </div>
        </motion.div>

        {/* TILES - 30% width grid */}
        <div className="xl:w-[30%] flex flex-col gap-6">
          {SHOWS.map((show, idx) => (
            <motion.div
              key={show.artist}
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.2 + (idx * 0.1) }}
              className="bg-[#111] border border-white/10 p-5 rounded-xl hover:border-[#39FF14]/50 transition-colors group flex flex-col justify-between"
            >
              <div className="flex justify-between items-start mb-4">
                <div className="bg-white/10 text-white text-xs font-bold uppercase py-1 px-3 rounded-full flex items-center gap-1">
                  <MapPin size={12} className="text-[#39FF14]" />
                  {show.city}
                </div>
                <div className={`text-xs font-black uppercase tracking-wider px-2 py-1 ${show.status === 'SOLD OUT' ? 'bg-red-500/20 text-red-500' : 'bg-[#39FF14]/20 text-[#39FF14]'}`}>
                  {show.status}
                </div>
              </div>

              <div>
                <h4 className="font-stadium text-3xl mb-1 uppercase text-white group-hover:text-[#39FF14] transition-colors">{show.artist}</h4>
                <div className="flex flex-col gap-1 text-sm text-white/60 font-semibold uppercase">
                  <span>{show.venue}</span>
                  <span className="text-[#39FF14]">{show.date}</span>
                </div>
              </div>
            </motion.div>
          ))}

          {/* CTA */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.8 }}
            className="mt-auto pt-6"
          >
            <button className="w-full bg-transparent border-2 border-white/20 text-white font-stadium text-xl uppercase py-4 px-6 hover:border-[#39FF14] hover:text-[#39FF14] transition-all flex items-center justify-between group">
              Ver Calendario Completo
              <ArrowRight className="group-hover:translate-x-2 transition-transform" />
            </button>
          </motion.div>

        </div>
      </div>
    </div>
  );
}
