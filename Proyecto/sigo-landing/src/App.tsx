import React, { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Download, ExternalLink, X } from 'lucide-react';
import { HeroSection, APK_DOWNLOAD_URL, DEMO_CLOUD_URL } from './components/HeroSection';
import { WhatIsSigoSection } from './components/WhatIsSigoSection';
import { SaitComparisonSection } from './components/SaitComparisonSection';
import { CrimeScoringSection } from './components/CrimeScoringSection';
import { FeaturesBentoSection } from './components/FeaturesBentoSection';
import { Showcase3DGallery } from './components/Showcase3DGallery';
import { AuthorSection } from './components/AuthorSection';
import { FinalCtaFooter } from './components/FinalCtaFooter';
import { AndroidIcon, AppleMacIcon, WindowsIcon } from './components/PlatformIcons';

export const App: React.FC = () => {
  const [lightbox, setLightbox] = useState<{ src: string; caption: string } | null>(null);

  return (
    <div className="relative min-h-screen text-white selection:bg-lime-300/40 selection:text-emerald-950">
      {/* Animated Liquid Glass Ambient Orbs (Lime, Emerald, Teal/Cyan) */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden -z-10">
        <div className="animate-orb-slow absolute -top-24 -left-20 w-[440px] h-[440px] rounded-full bg-lime-400/25 blur-[110px]" />
        <div className="animate-orb-reverse absolute top-1/4 -right-24 w-[500px] h-[500px] rounded-full bg-cyan-400/25 blur-[120px]" />
        <div className="animate-orb-slow absolute bottom-10 left-1/3 w-[460px] h-[460px] rounded-full bg-emerald-400/25 blur-[120px]" />
      </div>

      {/* Floating Apple Liquid Glass Navbar */}
      <header className="fixed top-3 left-0 right-0 z-50 px-3 sm:px-6">
        <nav className="max-w-7xl mx-auto liquid-glass rounded-2xl px-3.5 sm:px-5 py-2.5 flex items-center justify-between gap-3">
          {/* Brand */}
          <a href="#inicio" className="flex items-center gap-2.5 shrink-0">
            <div className="w-9 h-9 rounded-xl bg-white/15 border border-white/30 flex items-center justify-center p-1 shadow-liquid-sm">
              <img
                src="/images/logo-carabineros.webp"
                alt="S.I.G.O."
                className="w-full h-full object-contain"
              />
            </div>
            <div className="leading-tight">
              <span className="block text-sm sm:text-base font-extrabold tracking-tight text-white">
                S.I.G.O.
              </span>
              <span className="hidden sm:block text-[10px] font-semibold text-lime-200/90 uppercase tracking-wider">
                Gestión Operativa
              </span>
            </div>
          </a>

          {/* Navigation Links */}
          <div className="hidden lg:flex items-center gap-5 text-xs font-semibold text-emerald-50/85">
            <a href="#que-es-sigo" className="hover:text-lime-200 transition-colors">
              ¿Qué es S.I.G.O.?
            </a>
            <a href="#diferenciacion" className="hover:text-lime-200 transition-colors">
              Diferenciación
            </a>
            <a href="#puntaje-delitos" className="hover:text-lime-200 transition-colors">
              Puntaje y U.V.E.
            </a>
            <a href="#galeria-3d" className="hover:text-lime-200 transition-colors">
              Mockups 3D
            </a>
            <a href="#autor" className="hover:text-lime-200 transition-colors">
              Autor
            </a>
          </div>

          {/* Right Platform Icons + CTAs */}
          <div className="flex items-center gap-2 sm:gap-2.5">
            {/* Compact Platform Icons Indicator */}
            <div
              title="Web compatible con Windows y macOS · App nativa para Android"
              className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-950/45 border border-white/20 text-emerald-100"
            >
              <WindowsIcon className="w-3.5 h-3.5 text-cyan-200" />
              <AppleMacIcon className="w-3.5 h-3.5 text-white" />
              <span className="w-px h-3.5 bg-white/25" />
              <AndroidIcon className="w-3.5 h-3.5 text-lime-300" />
            </div>

            <a
              href={APK_DOWNLOAD_URL}
              download="SIGO.apk"
              className="liquid-btn-secondary inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-white transition-all"
              title="Descargar aplicación móvil Android (SIGO.apk)"
            >
              <AndroidIcon className="w-4 h-4 text-lime-300" />
              <span className="hidden sm:inline">APK</span>
              <Download className="w-3.5 h-3.5 opacity-80" />
            </a>

            <a
              href={DEMO_CLOUD_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="liquid-btn-primary inline-flex items-center gap-1.5 px-3.5 sm:px-4 py-2 rounded-xl text-xs font-extrabold transition-all"
            >
              <span>Probar Demo</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </nav>
      </header>

      {/* Main Content */}
      <main>
        <HeroSection
          onOpenLightbox={(src, caption) => setLightbox({ src, caption })}
        />
        <WhatIsSigoSection />
        <SaitComparisonSection />
        <CrimeScoringSection />
        <FeaturesBentoSection />
        <Showcase3DGallery
          onOpenLightbox={(src, caption) => setLightbox({ src, caption })}
        />
        <AuthorSection />
      </main>

      <FinalCtaFooter />

      {/* Fullscreen Liquid Glass Lightbox */}
      <AnimatePresence>
        {lightbox && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setLightbox(null)}
            className="fixed inset-0 z-[100] bg-emerald-950/85 backdrop-blur-xl flex items-center justify-center p-4 sm:p-8"
          >
            <motion.div
              initial={{ scale: 0.92, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.92, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="liquid-glass rounded-3xl p-3 sm:p-4 max-w-6xl max-h-[92vh] flex flex-col items-center relative"
            >
              <button
                type="button"
                onClick={() => setLightbox(null)}
                className="absolute -top-3 -right-3 w-10 h-10 rounded-full liquid-btn-primary flex items-center justify-center shadow-lg"
                aria-label="Cerrar vista previa"
              >
                <X className="w-5 h-5" />
              </button>
              <img
                src={lightbox.src}
                alt={lightbox.caption}
                className="max-h-[80vh] w-auto rounded-2xl object-contain"
              />
              <p className="mt-3 text-xs sm:text-sm font-semibold text-emerald-50 text-center px-3">
                {lightbox.caption}
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default App;
