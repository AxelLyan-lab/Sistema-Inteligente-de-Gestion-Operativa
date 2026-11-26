import React from 'react';
import { motion } from 'framer-motion';
import {
  Download,
  ExternalLink,
  Radio,
  ShieldCheck,
  Sparkles,
  Wifi,
} from 'lucide-react';
import { Interactive3DLaptop, Interactive3DPhone } from './DeviceMockups3D';
import { AndroidIcon, AppleMacIcon, WindowsIcon } from './PlatformIcons';

export const DEMO_CLOUD_URL =
  'https://sigo-cl-243815551696.southamerica-west1.run.app';
export const APK_DOWNLOAD_URL = '/SIGO.apk';

interface HeroSectionProps {
  onOpenLightbox: (src: string, caption: string) => void;
}

export const HeroSection: React.FC<HeroSectionProps> = ({ onOpenLightbox }) => {
  return (
    <section
      id="inicio"
      className="relative pt-32 pb-20 lg:pt-40 lg:pb-28 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto"
    >
      <div className="grid lg:grid-cols-12 gap-12 lg:gap-8 items-center">
        {/* Left Copy Column */}
        <motion.div
          initial={{ opacity: 0, y: 26 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="lg:col-span-6 text-left"
        >
          <div className="inline-flex items-center gap-2.5 px-4 py-2 rounded-full liquid-pill text-xs sm:text-sm font-semibold text-emerald-50 mb-6">
            <Sparkles className="w-4 h-4 text-lime-300 shrink-0" />
            <span>Mando Táctico, Optimización U.V.E. y Telemetría en Tiempo Real</span>
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-[3.5rem] font-extrabold tracking-tight leading-[1.07] text-white">
            S.I.G.O.:{' '}
            <span className="bg-gradient-to-r from-lime-200 via-emerald-200 to-cyan-200 bg-clip-text text-transparent">
              Gestión Operativa Inteligente
            </span>{' '}
            para Patrullaje Preventivo
          </h1>

          <p className="mt-6 text-base sm:text-lg text-emerald-50/85 leading-relaxed max-w-xl">
            Evoluciona el despacho policial tradicional hacia una arquitectura{' '}
            <strong className="text-white font-semibold">Cloud + Android</strong> sincronizada en
            milisegundos. Calcula y optimiza automáticamente el{' '}
            <strong className="text-lime-200 font-semibold">U.V.E.</strong>, coordina patrullas con
            geocercas GPS activas, mensajería con notas de voz y evidencias geolocalizadas.
          </p>

          {/* Primary CTAs */}
          <div className="mt-8 flex flex-col sm:flex-row gap-4">
            <motion.a
              whileHover={{ scale: 1.03, y: -2 }}
              whileTap={{ scale: 0.98 }}
              href={DEMO_CLOUD_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="liquid-btn-primary inline-flex items-center justify-center gap-2.5 px-7 py-4 rounded-2xl font-bold text-base transition-all"
            >
              <ExternalLink className="w-5 h-5" />
              <span>Probar Demo en Vivo</span>
            </motion.a>

            <motion.a
              whileHover={{ scale: 1.03, y: -2 }}
              whileTap={{ scale: 0.98 }}
              href={APK_DOWNLOAD_URL}
              download="SIGO.apk"
              className="liquid-btn-secondary inline-flex items-center justify-center gap-2.5 px-7 py-4 rounded-2xl font-semibold text-base text-white transition-all"
            >
              <AndroidIcon className="w-5 h-5 text-lime-300" />
              <span>Descargar App Android (.APK)</span>
              <Download className="w-4 h-4 opacity-80" />
            </motion.a>
          </div>

          {/* Platform Compatibility Liquid Glass Strip */}
          <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-3.5 max-w-xl">
            <div className="liquid-glass rounded-2xl p-3.5 flex items-center gap-3.5">
              <div className="flex items-center gap-2 px-2.5 py-2 rounded-xl bg-white/15 border border-white/25 text-white shrink-0">
                <WindowsIcon className="w-5 h-5 text-cyan-200" />
                <span className="w-px h-4 bg-white/25" />
                <AppleMacIcon className="w-5 h-5 text-white" />
              </div>
              <div className="text-xs leading-snug">
                <p className="font-bold text-white">Consola Web Universal</p>
                <p className="text-emerald-100/80">
                  Windows, macOS y cualquier navegador sin instalación
                </p>
              </div>
            </div>

            <div className="liquid-glass rounded-2xl p-3.5 flex items-center gap-3.5">
              <div className="flex items-center justify-center w-11 h-11 rounded-xl bg-lime-400/20 border border-lime-300/40 text-lime-200 shrink-0">
                <AndroidIcon className="w-6 h-6" />
              </div>
              <div className="text-xs leading-snug">
                <p className="font-bold text-white">App Patrullero Android</p>
                <p className="text-emerald-100/80">
                  Exclusiva Android · GPS y alertas 24/7 en segundo plano
                </p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Right Interactive 3D Dual Mockup Composition */}
        <motion.div
          initial={{ opacity: 0, scale: 0.94, y: 24 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.85, delay: 0.12, ease: [0.22, 1, 0.36, 1] }}
          className="lg:col-span-6 relative pt-4 pb-12 lg:pb-6"
        >
          {/* Ambient Glow behind 3D Devices */}
          <div className="pointer-events-none absolute -inset-6 rounded-[40px] bg-gradient-to-tr from-lime-400/25 via-emerald-400/20 to-cyan-400/30 blur-3xl" />

          {/* Floating Status Pill Top Left */}
          <motion.div
            animate={{ y: [0, -7, 0] }}
            transition={{ duration: 4.5, repeat: Infinity, ease: 'easeInOut' }}
            className="hidden sm:flex items-center gap-2.5 px-3.5 py-2 rounded-2xl liquid-pill absolute -top-4 left-2 z-30 text-xs font-semibold text-white"
          >
            <span className="w-2.5 h-2.5 rounded-full bg-lime-400 shadow-[0_0_12px_#a3e635] animate-pulse" />
            <Wifi className="w-3.5 h-3.5 text-cyan-200" />
            <span>Sync Cloud Run · Tiempo Real</span>
          </motion.div>

          {/* 3D Interactive Laptop */}
          <div className="relative z-10 sm:pr-12">
            <Interactive3DLaptop
              imageSrc="/images/web-hero-optimal.jpg"
              imageAlt="Consola Web S.I.G.O. — Mapa Táctico 100% Optimizado U.V.E."
              onImageClick={() =>
                onOpenLightbox(
                  '/images/web-hero-optimal.jpg',
                  'Consola Web S.I.G.O. — 5 Zonas Activas con Cobertura Óptima U.V.E. y Motor Auto Optimizado',
                )
              }
            />
          </div>

          {/* 3D Interactive Android Smartphone Overlapping */}
          <motion.div
            initial={{ opacity: 0, x: 24, y: 24 }}
            animate={{ opacity: 1, x: 0, y: 0 }}
            transition={{ duration: 0.9, delay: 0.3 }}
            className="relative sm:absolute sm:-bottom-8 sm:right-0 z-20 w-[200px] sm:w-[215px] mx-auto mt-8 sm:mt-0"
          >
            <Interactive3DPhone
              imageSrc="/images/mobile-patrol-active.jpg"
              imageAlt="App Móvil Android S.I.G.O. — En patrullaje activo de Zona de Riesgo"
              onImageClick={() =>
                onOpenLightbox(
                  '/images/mobile-patrol-active.jpg',
                  'App Móvil Android S.I.G.O. — Geocerca activa, estado RP-201 y Carga Operativa 0.80 U.V.E.',
                )
              }
            />
          </motion.div>

          {/* Floating U.V.E. Badge Bottom Left */}
          <motion.div
            animate={{ y: [0, 6, 0] }}
            transition={{ duration: 5.2, repeat: Infinity, ease: 'easeInOut' }}
            className="hidden sm:flex items-center gap-3 px-4 py-2.5 rounded-2xl liquid-glass-dark absolute -bottom-10 left-4 z-30"
          >
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-lime-300 to-emerald-400 flex items-center justify-center text-emerald-950 shadow-md">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div className="text-xs">
              <p className="text-lime-200 font-bold flex items-center gap-1.5">
                <Radio className="w-3.5 h-3.5" />
                Motor Tri-Modal Activo
              </p>
              <p className="text-emerald-100/80">Manual · Automático · Auto Optimizado</p>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
};
