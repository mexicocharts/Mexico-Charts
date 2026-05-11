import React, { useEffect } from 'react';
import { motion, useAnimation, useInView } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import './_group.css';

export const Poster = () => {
  return (
    <div className="relative w-full min-h-screen bg-[#080808] text-white overflow-hidden poster-bg flex flex-col md:flex-row font-display">
      <style dangerouslySetInnerHTML={{ __html: `
        @import url('https://fonts.googleapis.com/css2?family=Anton&display=swap');
        .font-display { font-family: 'Anton', sans-serif; text-transform: uppercase; line-height: 0.9; }
        .text-giant { font-size: clamp(4rem, 15vw, 12rem); }
        .text-huge { font-size: clamp(3rem, 10vw, 8rem); }
        .text-xlarge { font-size: clamp(2rem, 8vw, 6rem); }
        .text-large { font-size: clamp(1.5rem, 6vw, 4rem); }
        .text-medium { font-size: clamp(1.2rem, 4vw, 3rem); }
        .vertical-text { writing-mode: vertical-rl; transform: rotate(180deg); }
      `}} />
      
      {/* Scanline Overlay */}
      <div className="scanline-overlay"></div>

      {/* Vertical Banner */}
      <div className="hidden md:flex w-24 lg:w-32 bg-[#39FF14] text-[#080808] flex-col justify-between items-center py-8 z-10 border-r-4 border-white">
        <motion.div 
          initial={{ y: -50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="vertical-text text-6xl tracking-tighter"
        >
          MEXICO CHARTS
        </motion.div>
        <motion.div 
          initial={{ y: 50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.4 }}
          className="vertical-text text-8xl tracking-tighter"
        >
          GIRAS
        </motion.div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col justify-between p-6 md:p-12 z-10 relative">
        
        {/* Top Header Badge */}
        <motion.div 
          initial={{ x: -20, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ duration: 0.5 }}
          className="self-start md:self-end bg-[#39FF14] text-[#080808] px-4 py-2 text-2xl md:text-4xl mb-12 transform -skew-x-12 border-2 border-white shadow-[4px_4px_0_#fff]"
        >
          TEMPORADA 2025
        </motion.div>

        {/* Poster Dates */}
        <div className="flex flex-col gap-6 md:gap-4 w-full">
          {/* PESO PLUMA */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="flex flex-col md:flex-row items-baseline gap-2 border-b-2 border-[#39FF14]/30 pb-2"
          >
            <span className="text-giant text-[#39FF14]">PESO PLUMA</span>
            <div className="flex gap-4 md:ml-auto text-xl md:text-3xl text-gray-400 tracking-widest">
              <span>CDMX</span>
              <span>—</span>
              <span>14.06</span>
            </div>
          </motion.div>

          {/* GRUPO FRONTERA */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="flex flex-col md:flex-row items-baseline gap-2 border-b-2 border-[#39FF14]/30 pb-2 md:justify-end text-right"
          >
            <div className="flex gap-4 md:mr-auto text-xl md:text-3xl text-gray-400 tracking-widest order-2 md:order-1">
              <span>GUADALAJARA</span>
              <span>—</span>
              <span>21.06</span>
            </div>
            <span className="text-huge brutal-text-stroke-white order-1 md:order-2">GRUPO FRONTERA</span>
          </motion.div>

          {/* NATANAEL CANO */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="flex flex-col md:flex-row items-baseline gap-2 border-b-2 border-[#39FF14]/30 pb-2 justify-center"
          >
            <span className="text-xlarge text-white">NATANAEL CANO</span>
            <div className="flex gap-4 ml-4 text-lg md:text-2xl text-[#39FF14] tracking-widest">
              <span>CDMX</span>
              <span>—</span>
              <span>05.07</span>
            </div>
          </motion.div>

          {/* ESLABON ARMADO */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="flex flex-col items-start gap-1 border-b-2 border-[#39FF14]/30 pb-2"
          >
            <span className="text-large text-white">ESLABON ARMADO</span>
            <div className="flex gap-4 text-sm md:text-xl text-gray-400 tracking-widest">
              <span>MONTERREY</span>
              <span>—</span>
              <span>12.07</span>
            </div>
          </motion.div>

          {/* JUNIOR H */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="flex flex-col md:flex-row items-baseline gap-2 border-b-2 border-[#39FF14]/30 pb-2 md:justify-end text-right"
          >
            <div className="flex gap-4 md:mr-auto text-sm md:text-xl text-gray-400 tracking-widest order-2 md:order-1">
              <span>GUADALAJARA</span>
              <span>—</span>
              <span>19.07</span>
            </div>
            <span className="text-xlarge brutal-text-stroke order-1 md:order-2">JUNIOR H</span>
          </motion.div>

          {/* XAVI */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="flex flex-col items-center gap-1 border-b-2 border-[#39FF14]/30 pb-2 mt-4"
          >
            <span className="text-medium text-white tracking-widest">XAVI</span>
            <div className="flex gap-4 text-xs md:text-lg text-[#39FF14] tracking-widest">
              <span>TIJUANA</span>
              <span>—</span>
              <span>26.07</span>
            </div>
          </motion.div>

          {/* SANTA FE KLAN */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="flex flex-col md:flex-row items-baseline gap-2 pb-2 mt-4"
          >
            <span className="text-huge text-white">SANTA FE KLAN</span>
            <div className="flex gap-4 md:ml-auto text-xl md:text-3xl text-gray-400 tracking-widest">
              <span>CDMX</span>
              <span>—</span>
              <span>02.08</span>
            </div>
          </motion.div>
        </div>

        {/* Footer CTA */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1, duration: 0.5 }}
          className="mt-16 flex justify-between items-end border-t-4 border-[#39FF14] pt-6"
        >
          <div className="text-3xl md:text-6xl text-white max-w-xl">
            CONSIGUE TUS <span className="text-[#39FF14]">BOLETOS</span> AHORA
          </div>
          <button className="bg-[#39FF14] text-[#080808] p-4 md:p-8 hover:bg-white transition-colors duration-300 group">
            <ArrowRight className="w-8 h-8 md:w-16 md:h-16 transform group-hover:translate-x-2 transition-transform" />
          </button>
        </motion.div>

      </div>
    </div>
  );
};

export default Poster;