import React, { useEffect, useState } from "react";
import { motion, useMotionValue, useTransform, animate } from "framer-motion";
import { Loader2 } from "lucide-react";

export function PollstarProfile() {
  const [isMounted, setIsMounted] = useState(false);
  const count = useMotionValue(0);
  const rounded = useTransform(count, (latest) => Math.round(latest * 10) / 10);

  useEffect(() => {
    setIsMounted(true);
    const controls = animate(count, 87.4, { duration: 2, ease: "easeOut" });
    return controls.stop;
  }, []);

  const chartData = [
    { year: 2021, gross: 2.5, label: "$2.5M" },
    { year: 2022, gross: 8.9, label: "$8.9M" },
    { year: 2023, gross: 41.8, label: "$41.8M", peak: true },
    { year: 2024, gross: 34.2, label: "$34.2M" },
  ];
  const maxGross = Math.max(...chartData.map((d) => d.gross));

  const tours = [
    { name: "Éxodo World Tour", year: 2024, shows: 89, gross: "$34.2M", avgShow: "$384K", avgTickets: "12.4K", isRecord: true },
    { name: "Genesis Tour", year: 2023, shows: 124, gross: "$41.8M", avgShow: "$337K", avgTickets: "14.2K", isRecord: false },
    { name: "Doble P Tour", year: 2022, shows: 67, gross: "$8.9M", avgShow: "$132K", avgTickets: "8.1K", isRecord: false },
    { name: "Regional Breakout", year: 2021, shows: 32, gross: "$2.5M", avgShow: "$78K", avgTickets: "5.2K", isRecord: false },
  ];

  const topVenues = [
    { rank: 1, name: "Foro Sol", city: "CDMX", shows: 8, gross: 18.4 },
    { rank: 2, name: "Madison Square Garden", city: "NY", shows: 3, gross: 7.2 },
    { rank: 3, name: "Crypto.com Arena", city: "LA", shows: 4, gross: 9.1 },
    { rank: 4, name: "Auditorio Nacional", city: "CDMX", shows: 6, gross: 5.8 },
    { rank: 5, name: "Toyota Center", city: "Houston", shows: 5, gross: 4.3 },
  ];
  const maxVenueGross = Math.max(...topVenues.map(v => v.gross));

  return (
    <div className="min-h-screen bg-[#080808] text-zinc-400 font-sans selection:bg-[#39FF14] selection:text-black overflow-x-hidden">
      <style dangerouslySetInnerHTML={{ __html: `
        @import url('https://fonts.googleapis.com/css2?family=Anton&display=swap');
        .font-anton { font-family: 'Anton', sans-serif; }
        .noise-bg {
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)' opacity='0.05'/%3E%3C/svg%3E");
        }
      `}} />

      {/* 1. HERO SECTION */}
      <section className="relative h-[400px] w-full flex flex-col justify-between px-8 py-10 noise-bg border-b border-zinc-900">
        <div className="flex justify-between items-end h-full w-full max-w-7xl mx-auto pb-8">
          {/* Left Side */}
          <div className="flex flex-col">
            <span className="text-[#39FF14] text-sm uppercase tracking-[0.3em] font-bold mb-4">
              Historial de Giras
            </span>
            <motion.h1 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
              className="font-anton text-[120px] leading-[0.85] text-white uppercase"
            >
              Peso<br/>Pluma
            </motion.h1>
          </div>

          {/* Right Side */}
          <div className="flex flex-col items-end text-right">
            <div className="flex items-baseline text-[#39FF14] font-anton text-[100px] leading-none">
              <span>$</span>
              <motion.span>{rounded}</motion.span>
              <span>M</span>
            </div>
            <div className="text-zinc-500 uppercase tracking-widest text-sm font-bold mt-2">
              Carrera Total
            </div>
            <div className="text-zinc-400 mt-1 text-sm tracking-widest">
              312 SHOWS · 18 PAÍSES
            </div>
          </div>
        </div>

        {/* Bottom Rule */}
        <div className="max-w-7xl mx-auto w-full flex flex-col gap-2">
          <div className="w-full h-px bg-[#39FF14]/30" />
          <div className="text-xs text-[#39FF14]/60 tracking-wider">
            DATOS: POLLSTAR RESEARCH · ACTUALIZADO 2024
          </div>
        </div>
      </section>

      {/* 2. CAREER STATS STRIP */}
      <section className="h-[120px] border-b border-zinc-900 bg-zinc-950 flex">
        <div className="max-w-7xl mx-auto w-full grid grid-cols-4 divide-x divide-zinc-900">
          <div className="flex flex-col justify-center px-8">
            <span className="text-zinc-500 text-xs uppercase tracking-widest mb-1">Gira Más Lucrativa</span>
            <span className="text-white text-xl font-bold tracking-tight">Éxodo World Tour <span className="text-[#39FF14]">$34.2M</span></span>
          </div>
          <div className="flex flex-col justify-center px-8">
            <span className="text-zinc-500 text-xs uppercase tracking-widest mb-1">Show Más Grande</span>
            <span className="text-white text-xl font-bold tracking-tight">65,000 — Foro Sol CDMX</span>
          </div>
          <div className="flex flex-col justify-center px-8">
            <span className="text-zinc-500 text-xs uppercase tracking-widest mb-1">Promedio Por Show</span>
            <span className="text-white text-xl font-bold tracking-tight">$280K</span>
          </div>
          <div className="flex flex-col justify-center px-8">
            <span className="text-zinc-500 text-xs uppercase tracking-widest mb-1">Año Pico</span>
            <span className="text-white text-xl font-bold tracking-tight">2023</span>
          </div>
        </div>
      </section>

      {/* 3. TOURING TIMELINE CHART */}
      <section className="h-[280px] border-b border-zinc-900 px-8 py-10">
        <div className="max-w-7xl mx-auto w-full h-full flex flex-col">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-1 h-5 bg-[#39FF14]" />
            <h2 className="text-white font-bold uppercase tracking-widest">Trayectoria de Giras</h2>
            <span className="text-zinc-600 text-sm ml-4">Ingresos brutos por año de gira · Fuente: Pollstar</span>
          </div>
          
          <div className="flex-1 relative flex items-end justify-around pb-6 pt-10">
            {/* Grid lines */}
            <div className="absolute inset-0 flex flex-col justify-between pb-6 pt-10 pointer-events-none">
              <div className="w-full h-px bg-zinc-900" />
              <div className="w-full h-px bg-zinc-900" />
              <div className="w-full h-px bg-zinc-900" />
              <div className="w-full h-px bg-zinc-900" />
            </div>

            {/* Bars */}
            {chartData.map((d, i) => (
              <div key={d.year} className="relative flex flex-col items-center w-24 group z-10 h-full justify-end">
                {/* Value label */}
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.5 + i * 0.1 }}
                  className="absolute -top-8 text-white font-anton text-2xl"
                >
                  {d.label}
                </motion.div>
                
                {/* Peak Badge */}
                {d.peak && (
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 1 }}
                    className="absolute -top-14 bg-[#39FF14] text-black text-[10px] font-bold px-2 py-0.5 rounded-sm uppercase tracking-wider"
                  >
                    Pico
                    <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-t-[4px] border-t-[#39FF14]" />
                  </motion.div>
                )}

                {/* Bar */}
                <motion.div 
                  className="w-full bg-[#39FF14] opacity-90 group-hover:opacity-100 transition-opacity"
                  initial={{ height: 0 }}
                  animate={{ height: isMounted ? ((d.gross / maxGross) * 100) + '%' : 0 }}
                  transition={{ duration: 1, delay: i * 0.1, ease: "easeOut" }}
                />

                {/* Year label */}
                <div className="absolute -bottom-6 text-zinc-500 text-sm font-bold tracking-widest">
                  {d.year}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 4. TOURS TABLE */}
      <section className="h-[400px] border-b border-zinc-900 px-8 py-10">
        <div className="max-w-7xl mx-auto w-full">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-1 h-5 bg-[#39FF14]" />
            <h2 className="text-white font-bold uppercase tracking-widest">Historial de Giras</h2>
          </div>

          <div className="w-full text-left border-collapse">
            <div className="grid grid-cols-6 text-zinc-600 text-xs uppercase tracking-widest font-bold pb-4 border-b border-zinc-900">
              <div className="col-span-2">Gira</div>
              <div>Año</div>
              <div>Shows</div>
              <div>Gross Total</div>
              <div>Prom/Show</div>
              <div>Prom Boletos</div>
            </div>

            <div className="flex flex-col">
              {tours.map((tour, i) => (
                <motion.div
                  key={tour.name}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.1 }}
                  className={"grid grid-cols-6 py-5 border-b border-zinc-900/50 items-center transition-colors hover:bg-zinc-900/50 " + (tour.isRecord ? 'bg-[#39FF14]/[0.02]' : '')}
                >
                  <div className="col-span-2 flex items-center gap-3">
                    <span className="text-white font-bold">{tour.name}</span>
                    {tour.isRecord && (
                      <span className="bg-[#39FF14]/10 text-[#39FF14] text-[10px] px-2 py-0.5 border border-[#39FF14]/20 rounded-sm font-bold tracking-wider">
                        GIRA MÁS RECIENTE
                      </span>
                    )}
                  </div>
                  <div className="text-zinc-400">{tour.year}</div>
                  <div className="text-zinc-400">{tour.shows}</div>
                  <div className={"font-anton tracking-wide " + (tour.isRecord ? 'text-[#39FF14]' : 'text-white')}>{tour.gross}</div>
                  <div className="text-zinc-400">{tour.avgShow}</div>
                  <div className="text-zinc-400">{tour.avgTickets}</div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* 5. BIGGEST NIGHT CARD */}
      <section className="h-[240px] border-b border-zinc-900 py-10 px-8 relative overflow-hidden">
        {/* Top Accent */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-[#39FF14]" />
        
        {/* Background Texture */}
        <div className="absolute inset-0 opacity-10 noise-bg" />

        <div className="max-w-7xl mx-auto w-full h-full flex items-center justify-between relative z-10">
          <div className="flex flex-col">
            <span className="text-zinc-500 text-sm uppercase tracking-widest font-bold mb-2">La Noche Más Grande</span>
            <span className="font-anton text-[80px] leading-none text-white uppercase">Foro Sol</span>
          </div>

          <div className="flex items-center justify-center">
            <div className="w-32 h-32 rounded-full border border-[#39FF14] flex flex-col items-center justify-center bg-[#39FF14]/10">
              <span className="text-[#39FF14] font-anton text-4xl">100%</span>
              <span className="text-white text-[10px] uppercase tracking-widest font-bold">Sold Out</span>
            </div>
          </div>

          <div className="flex flex-col gap-2 text-right">
            <div className="flex justify-end gap-6 text-sm text-zinc-400 font-bold tracking-widest uppercase">
              <span>18 Nov 2023</span>
              <span>CDMX</span>
            </div>
            <div className="text-[#39FF14] font-anton text-6xl my-1">
              $4,200,000
            </div>
            <div className="text-zinc-500 text-sm uppercase tracking-widest font-bold">
              CAPACIDAD: 65,000 / 65,000
            </div>
          </div>
        </div>
      </section>

      {/* 6. TOP VENUES */}
      <section className="h-[300px] border-b border-zinc-900 px-8 py-10">
        <div className="max-w-7xl mx-auto w-full h-full flex flex-col">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-1 h-5 bg-[#39FF14]" />
            <h2 className="text-white font-bold uppercase tracking-widest">Recintos Principales</h2>
          </div>

          <div className="flex flex-col flex-1 justify-between">
            {topVenues.map((venue, i) => (
              <div key={venue.rank} className={"flex items-center py-2 " + (i % 2 === 0 ? 'bg-zinc-900/30' : '') + " px-4 -mx-4 rounded-sm"}>
                <div className="w-8 text-[#39FF14] font-anton text-xl opacity-80">{venue.rank}</div>
                <div className="w-64">
                  <span className="text-white font-bold">{venue.name}</span>
                  <span className="text-zinc-500 ml-2 text-sm">{venue.city}</span>
                </div>
                <div className="w-24 text-zinc-400 text-sm">{venue.shows} Shows</div>
                
                <div className="flex-1 flex items-center gap-4 justify-end">
                  <span className="font-anton text-white tracking-wide">${venue.gross}M</span>
                  <div className="w-64 h-1 bg-zinc-900 rounded-full overflow-hidden">
                    <motion.div 
                      className="h-full bg-[#39FF14]"
                      initial={{ width: 0 }}
                      animate={{ width: ((venue.gross / maxVenueGross) * 100) + '%' }}
                      transition={{ duration: 1, delay: i * 0.1 }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 7. PRÓXIMOS EVENTOS TEASER */}
      <section className="h-[200px] bg-zinc-950 px-8 py-10 relative border-b border-zinc-900">
        <div className="max-w-7xl mx-auto w-full h-full relative">
          <div className="flex items-center gap-3 mb-4">
            <h2 className="text-white font-bold uppercase tracking-widest">Próximos Eventos</h2>
            <span className="bg-[#39FF14] text-black text-[10px] px-2 py-0.5 rounded-sm font-bold tracking-wider">
              PRÓXIMAMENTE
            </span>
          </div>

          {/* Blurred Background Grid */}
          <div className="grid grid-cols-3 gap-4 opacity-20 blur-sm pointer-events-none mt-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-16 border border-zinc-800 rounded-sm bg-zinc-900/50" />
            ))}
          </div>

          {/* Loading Overlay */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <Loader2 className="w-6 h-6 text-[#39FF14] animate-spin mb-3" />
            <span className="text-white text-sm font-bold tracking-widest uppercase">Conectando con Ticketmaster...</span>
            <span className="text-zinc-500 text-xs mt-2">Integración con venta de boletos en tiempo real · Disponible pronto</span>
          </div>
        </div>
      </section>

      {/* 8. FOOTER STRIP */}
      <footer className="h-[80px] bg-[#080808] px-8 flex items-center">
        <div className="max-w-7xl mx-auto w-full flex justify-between items-center text-xs uppercase tracking-widest font-bold">
          <div className="text-white">Mexico Charts</div>
          <div className="text-zinc-600">Datos provistos por Pollstar Research</div>
          <a href="#" className="text-[#39FF14] hover:underline flex items-center gap-1">
            Ver en Pollstar <span className="text-lg leading-none">→</span>
          </a>
        </div>
      </footer>
    </div>
  );
}

export default PollstarProfile;