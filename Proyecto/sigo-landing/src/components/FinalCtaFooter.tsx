import React from 'react';
import { motion } from 'framer-motion';
import { Download, ExternalLink, Sparkles } from 'lucide-react';
import { APK_DOWNLOAD_URL, DEMO_CLOUD_URL } from './HeroSection';
import { AndroidIcon, AppleMacIcon, WindowsIcon } from './PlatformIcons';

export const FinalCtaFooter: React.FC = () => {
  return (
    <footer className="relative pt-8 pb-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
      {/* Grand Final CTA Card */}
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.25 }}
        transition={{ duration: 0.65 }}
        className="liquid-glass rounded-[36px] p-8 sm:p-12 lg:p-14 text-center relative overflow-hidden"
      >
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-lime-300/15 via-emerald-400/10 to-cyan-400/20" />

        <div className="relative z-10 max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full liquid-pill text-xs font-bold text-lime-200 mb-5">
            <Sparkles className="w-4 h-4" />
            <span>Demo Operativa 24/7 en Google Cloud Run</span>
          </div>

          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white tracking-tight">
            Experimenta{' '}
            <span className="bg-gradient-to-r from-lime-200 via-emerald-200 to-cyan-200 bg-clip-text text-transparent">
              S.I.G.O. en vivo
            </span>{' '}
            ahora mismo
          </h2>

          <p className="mt-4 text-emerald-50/85 text-base sm:text-lg">
            Accede a la consola web desde computador, tablet o teléfono y descarga la aplicación
            móvil Android para probar la sincronización en tiempo real.{' '}
            <span className="text-lime-200 font-medium">
              Demo centralizado en Viña del Mar, proyectado para escalar por Plan Cuadrante.
            </span>
          </p>

          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
            <motion.a
              whileHover={{ scale: 1.04, y: -2 }}
              whileTap={{ scale: 0.98 }}
              href={DEMO_CLOUD_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="liquid-btn-primary w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-8 py-4 rounded-2xl font-extrabold text-base transition-all"
            >
              <ExternalLink className="w-5 h-5" />
              <span>Probar Demo en Vivo</span>
            </motion.a>

            <motion.a
              whileHover={{ scale: 1.04, y: -2 }}
              whileTap={{ scale: 0.98 }}
              href={APK_DOWNLOAD_URL}
              download="SIGO.apk"
              className="liquid-btn-secondary w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-8 py-4 rounded-2xl font-bold text-base text-white transition-all"
            >
              <AndroidIcon className="w-5 h-5 text-lime-300" />
              <span>Descargar App Android (.APK)</span>
              <Download className="w-4 h-4 opacity-80" />
            </motion.a>
          </div>

          {/* Compatibility Badges */}
          <div className="mt-8 flex flex-wrap items-center justify-center gap-4 text-xs font-semibold text-emerald-100/85">
            <span className="inline-flex items-center gap-2 px-3.5 py-2 rounded-full bg-emerald-950/45 border border-white/20">
              <WindowsIcon className="w-4 h-4 text-cyan-200" />
              <AppleMacIcon className="w-4 h-4 text-white" />
              <span>Web: Windows & macOS (Cualquier navegador)</span>
            </span>
            <span className="inline-flex items-center gap-2 px-3.5 py-2 rounded-full bg-emerald-950/45 border border-lime-300/35">
              <AndroidIcon className="w-4 h-4 text-lime-300" />
              <span>App Móvil: Exclusiva Android</span>
            </span>
          </div>
        </div>
      </motion.div>

      {/* Bottom Copyright Line */}
      <div className="mt-10 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-emerald-100/65 px-2">
        <div className="flex items-center gap-2.5">
          <img
            src="/images/logo-carabineros.webp"
            alt="Logo S.I.G.O."
            className="w-6 h-6 object-contain"
          />
          <span>
            <strong className="text-white">S.I.G.O.</strong> — Sistema Inteligente de Gestión
            Operativa
          </span>
        </div>
        <p>
          Desarrollado por <strong className="text-emerald-100">Axel Lyan Sepúlveda Muñoz</strong> ·{' '}
          <a
            href="mailto:a.seplvedamuoz@gmail.com"
            className="underline hover:text-lime-200 transition-colors"
          >
            a.seplvedamuoz@gmail.com
          </a>
        </p>
      </div>
    </footer>
  );
};
