import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Eye, Layers, Monitor, Smartphone } from 'lucide-react';
import { Interactive3DLaptop, Interactive3DPhone } from './DeviceMockups3D';
import { AndroidIcon, AppleMacIcon, WindowsIcon } from './PlatformIcons';

interface CaptureItem {
  id: string;
  label: string;
  title: string;
  description: string;
  src: string;
  badge: string;
}

const webCaptures: CaptureItem[] = [
  {
    id: 'web-optimal-main',
    label: 'Mapa 100% Optimizado',
    title: 'Mapa Táctico Completo — 5 Zonas con Cobertura Óptima U.V.E.',
    description:
      'Vista principal real del operador en modo Auto Optimizado: 5 cuadrantes activos (Z1, Z7, Z5, Z14, Z12) cubiertos al 100% con 3.35 U.V.E. disponibles y confirmación de cobertura óptima.',
    src: '/images/web-hero-optimal.jpg',
    badge: 'AUTO OPTIMIZADO',
  },
  {
    id: 'web-sos',
    label: 'Modo SOS en Web',
    title: 'Centro de Emergencias SOS y Despacho Automático por ETA',
    description:
      'Alerta sonora activa con despacho algorítmico inmediato hacia el móvil solicitante (#60): convoca Furgón Z (1.00 · ETA 1 min), Patrulla RPD (0.80 · ETA 3.6 min) y Moto MTT (0.45 · ETA 1 min) cubriendo la meta U.V.E.',
    src: '/images/web-sos-center.png',
    badge: 'EMERGENCIA SOS',
  },
  {
    id: 'web-messages',
    label: 'Mensajería Web',
    title: 'Canal Directo de Mensajería Táctica en Vivo',
    description:
      'Comunicación instantánea entre el Supervisor en Central y las patrullas en servicio (RP-201), coordinando dotación, suma de compañeros al turno e instrucciones tácticas en tiempo real.',
    src: '/images/web-messages.png',
    badge: 'CHAT EN VIVO',
  },
  {
    id: 'web-evidences',
    label: 'Archivo Evidencias',
    title: 'Registro y Archivo Centralizado de Evidencias de Terreno',
    description:
      'Organización automática por funcionario y fecha del material fotográfico, video comprimido y relatos cargados exclusivamente desde la App Móvil en terreno.',
    src: '/images/web-evidences.png',
    badge: 'EVIDENCIAS CLOUD',
  },
  {
    id: 'web-auto-modal',
    label: 'Diagnóstico U.V.E.',
    title: 'Modal Auto Optimizado (Margen ±0.45 U.V.E.)',
    description:
      'Al activar la optimización automática, el sistema identifica exactamente qué unidades faltan para cubrir todas las zonas configuradas y permite despacharlas o esperar su ingreso desde móvil.',
    src: '/images/web-auto-modal.png',
    badge: 'MARGEN ±0.45 U.V.E.',
  },
];

const mobileCaptures: CaptureItem[] = [
  {
    id: 'mob-sos-confirm',
    label: 'Confirmar SOS',
    title: 'Confirmación de Alerta SOS con GPS y Badge de Estado',
    description:
      'Desde la vista principal de RP-201 (con badge de alto contraste "En camino" y banner dinámico "Dirígete a: Z4"), el funcionario confirma la alerta SOS para convocar las unidades motorizadas más cercanas.',
    src: '/images/mobile-sos-confirm.png',
    badge: 'SOS EN 1 TOQUE',
  },
  {
    id: 'mob-sos-dispatched',
    label: 'Refuerzos en Camino',
    title: 'Confirmación de Refuerzos U.V.E. Despachados por Menor ETA',
    description:
      'Respuesta instantánea en el teléfono del patrullero confirmando la demanda U.V.E. activada y el despacho automático de patrullas, furgones y motos hacia su ubicación GPS.',
    src: '/images/mobile-sos-dispatched.png',
    badge: 'DESPACHO ACTIVO',
  },
  {
    id: 'mob-messages',
    label: 'Mensajes y Audio',
    title: 'Mensajería Directa con Central de Supervisión y Notas de Voz',
    description:
      'Chat sincronizado en tiempo real con la Central SIGO, indicador EN LÍNEA y botón nativo de grabación de audio para enviar reportes de voz sin soltar el procedimiento.',
    src: '/images/mobile-messages-real.png',
    badge: 'CHAT + AUDIO',
  },
  {
    id: 'mob-evidence',
    label: 'Evidencia y Atrasos',
    title: 'Captura de Evidencia y Control Obligatorio por Falta/Atraso',
    description:
      'Permite subir foto/video 640p y justificar por qué la unidad no llegó o se atrasó a una zona asignada. Si hubo retrasos en el turno y no se justificaron, el sistema bloquea el cierre de sesión hasta describir obligatoriamente el motivo (con foto opcional).',
    src: '/images/mobile-evidence-real.png',
    badge: 'CONTROL ATRASOS',
  },
  {
    id: 'mob-patrol',
    label: 'Patrullaje & Geocerca',
    title: 'Detección GPS Automática en Zona de Riesgo',
    description:
      'Al ingresar al perímetro asignado, el sistema valida la geocerca en tiempo real, activa el estado de patrullaje en zona de riesgo y sincroniza la dotación de turno.',
    src: '/images/mobile-patrol-active.jpg',
    badge: 'GPS EN VIVO',
  },
];

interface Showcase3DGalleryProps {
  onOpenLightbox: (src: string, caption: string) => void;
}

export const Showcase3DGallery: React.FC<Showcase3DGalleryProps> = ({ onOpenLightbox }) => {
  const [platform, setPlatform] = useState<'web' | 'mobile'>('web');
  const [selectedWeb, setSelectedWeb] = useState(0);
  const [selectedMobile, setSelectedMobile] = useState(0);

  const activeList = platform === 'web' ? webCaptures : mobileCaptures;
  const activeIdx = platform === 'web' ? selectedWeb : selectedMobile;
  const current = activeList[activeIdx];

  const handleSelect = (index: number) => {
    if (platform === 'web') setSelectedWeb(index);
    else setSelectedMobile(index);
  };

  return (
    <section id="galeria-3d" className="relative py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.2 }}
        transition={{ duration: 0.6 }}
        className="text-center max-w-3xl mx-auto mb-10"
      >
        <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full liquid-pill text-xs font-bold uppercase tracking-wider text-lime-200 mb-4">
          <Layers className="w-3.5 h-3.5" />
          Capturas Reales Actuales en Mockups 3D
        </span>
        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white tracking-tight">
          Explora la Consola Web y la{' '}
          <span className="bg-gradient-to-r from-lime-200 to-cyan-200 bg-clip-text text-transparent">
            App Móvil en 3D
          </span>
        </h2>
        <p className="mt-3 text-emerald-50/80 text-sm sm:text-base">
          Visualización amplia e íntegra de pantallas reales actuales (Mapa Optimizado, SOS,
          Mensajería y Evidencias). Haz clic en cualquier captura para verla a pantalla completa.
        </p>

        {/* Platform Switcher */}
        <div className="mt-7 inline-flex flex-wrap justify-center p-1.5 rounded-2xl liquid-glass-dark gap-1.5 max-w-full">
          <button
            type="button"
            onClick={() => setPlatform('web')}
            className={`inline-flex items-center gap-2.5 px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${
              platform === 'web'
                ? 'liquid-btn-primary'
                : 'text-emerald-100/80 hover:text-white hover:bg-white/10'
            }`}
          >
            <Monitor className="w-4 h-4" />
            <span>Consola Web</span>
            <span className="flex items-center gap-1 opacity-80">
              <WindowsIcon className="w-3.5 h-3.5" />
              <AppleMacIcon className="w-3.5 h-3.5" />
            </span>
          </button>

          <button
            type="button"
            onClick={() => setPlatform('mobile')}
            className={`inline-flex items-center gap-2.5 px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${
              platform === 'mobile'
                ? 'liquid-btn-primary'
                : 'text-emerald-100/80 hover:text-white hover:bg-white/10'
            }`}
          >
            <Smartphone className="w-4 h-4" />
            <span>App Móvil</span>
            <AndroidIcon className="w-3.5 h-3.5 opacity-85" />
          </button>
        </div>
      </motion.div>

      {/* Main Interactive 3D Stage */}
      <div className="liquid-glass rounded-[34px] p-5 sm:p-8 lg:p-10">
        <AnimatePresence mode="wait">
          {platform === 'web' ? (
            <motion.div
              key="web-full-stage"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.3 }}
              className="space-y-8"
            >
              {/* FULL-WIDTH Large Uncropped 3D Laptop */}
              <div className="max-w-5xl mx-auto">
                <Interactive3DLaptop
                  imageSrc={current.src}
                  imageAlt={current.title}
                  badgeText={current.badge}
                  onImageClick={() => onOpenLightbox(current.src, current.title)}
                />
              </div>

              {/* Description + Selector Row below the large monitor */}
              <div className="max-w-5xl mx-auto grid lg:grid-cols-12 gap-6 items-start pt-2">
                <div className="lg:col-span-5">
                  <span className="inline-block px-3 py-1 rounded-full bg-lime-300/20 border border-lime-200/45 text-xs font-extrabold text-lime-200 mb-2.5">
                    {current.badge}
                  </span>
                  <h3 className="text-xl sm:text-2xl font-extrabold text-white leading-tight">
                    {current.title}
                  </h3>
                  <p className="mt-2.5 text-sm text-emerald-50/85 leading-relaxed">
                    {current.description}
                  </p>
                  <button
                    type="button"
                    onClick={() => onOpenLightbox(current.src, current.title)}
                    className="mt-3.5 inline-flex items-center gap-2 text-xs font-bold text-cyan-200 hover:text-lime-200 transition-colors"
                  >
                    <Eye className="w-4 h-4" />
                    <span>Ampliar captura en pantalla completa</span>
                  </button>
                </div>

                <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                  {webCaptures.map((item, idx) => {
                    const isActive = idx === selectedWeb;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => handleSelect(idx)}
                        className={`text-left px-3.5 py-3 rounded-2xl border transition-all ${
                          isActive
                            ? 'bg-gradient-to-r from-lime-300/25 to-cyan-300/25 border-lime-200/75 text-white shadow-liquid-sm'
                            : 'bg-emerald-950/45 border-white/15 text-emerald-100/75 hover:bg-white/10 hover:text-white'
                        }`}
                      >
                        <span className="block text-xs font-extrabold">{item.label}</span>
                        <span className="block text-[10px] opacity-75 truncate mt-0.5">
                          {item.badge}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="mobile-full-stage"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.3 }}
              className="space-y-10"
            >
              {/* Featured Selected Mobile Screen + Details */}
              <div className="grid lg:grid-cols-12 gap-8 items-center">
                <div className="lg:col-span-5 flex justify-center">
                  <div className="w-[230px] sm:w-[285px]">
                    <Interactive3DPhone
                      imageSrc={current.src}
                      imageAlt={current.title}
                      onImageClick={() => onOpenLightbox(current.src, current.title)}
                    />
                  </div>
                </div>

                <div className="lg:col-span-7 space-y-6">
                  <div>
                    <span className="inline-block px-3 py-1 rounded-full bg-lime-300/20 border border-lime-200/45 text-xs font-extrabold text-lime-200 mb-3">
                      {current.badge}
                    </span>
                    <h3 className="text-2xl sm:text-3xl font-extrabold text-white leading-tight">
                      {current.title}
                    </h3>
                    <p className="mt-3 text-sm sm:text-base text-emerald-50/85 leading-relaxed">
                      {current.description}
                    </p>
                    <button
                      type="button"
                      onClick={() => onOpenLightbox(current.src, current.title)}
                      className="mt-4 inline-flex items-center gap-2 text-xs font-bold text-cyan-200 hover:text-lime-200 transition-colors"
                    >
                      <Eye className="w-4 h-4" />
                      <span>Ampliar captura en pantalla completa</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                    {mobileCaptures.map((item, idx) => {
                      const isActive = idx === selectedMobile;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => handleSelect(idx)}
                          className={`text-left px-3.5 py-3 rounded-2xl border transition-all ${
                            isActive
                              ? 'bg-gradient-to-r from-lime-300/25 to-cyan-300/25 border-lime-200/75 text-white shadow-liquid-sm'
                              : 'bg-emerald-950/45 border-white/15 text-emerald-100/75 hover:bg-white/10 hover:text-white'
                          }`}
                        >
                          <span className="block text-xs font-extrabold">{item.label}</span>
                          <span className="block text-[10px] opacity-75 mt-0.5">{item.badge}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* 3-Phone Simultaneous 3D Trio: SOS + Carga de Evidencia + Mensajes (100% Real Screenshots) */}
              <div className="pt-6 border-t border-white/15">
                <p className="text-xs font-bold uppercase tracking-widest text-lime-200 text-center mb-6">
                  Trío Real Android S.I.G.O. — Solicitud SOS · Carga de Evidencia · Mensajes en Vivo
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-center justify-items-center">
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-[215px]">
                      <Interactive3DPhone
                        imageSrc="/images/mobile-sos-confirm.png"
                        imageAlt="Confirmar Solicitud de Refuerzos SOS"
                        onImageClick={() =>
                          onOpenLightbox(
                            '/images/mobile-sos-confirm.png',
                            'App Móvil Real — Confirmar Solicitud de Refuerzos SOS',
                          )
                        }
                      />
                    </div>
                    <span className="text-xs font-bold text-white">1. Solicitud SOS</span>
                  </div>

                  <div className="flex flex-col items-center gap-3">
                    <div className="w-[215px]">
                      <Interactive3DPhone
                        imageSrc="/images/mobile-evidence-real.png"
                        imageAlt="Carga de evidencia móvil"
                        onImageClick={() =>
                          onOpenLightbox(
                            '/images/mobile-evidence-real.png',
                            'App Móvil Real — Carga de Evidencia (Foto, Video 640p y Galería)',
                          )
                        }
                      />
                    </div>
                    <span className="text-xs font-bold text-white">2. Carga de Evidencia</span>
                  </div>

                  <div className="flex flex-col items-center gap-3">
                    <div className="w-[215px]">
                      <Interactive3DPhone
                        imageSrc="/images/mobile-messages-real.png"
                        imageAlt="Mensajes en vivo y audio móvil"
                        onImageClick={() =>
                          onOpenLightbox(
                            '/images/mobile-messages-real.png',
                            'App Móvil Real — Mensajería con Central de Supervisión y Audio',
                          )
                        }
                      />
                    </div>
                    <span className="text-xs font-bold text-white">3. Mensajes y Audio</span>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </section>
  );
};
