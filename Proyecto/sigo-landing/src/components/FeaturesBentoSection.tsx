import React from 'react';
import { motion } from 'framer-motion';
import {
  AlertTriangle,
  BellRing,
  Camera,
  CheckCircle2,
  Clock,
  FileCheck2,
  Gauge,
  Lock,
  MapPin,
  Mic,
  Radio,
  ShieldAlert,
  Smartphone,
  Users,
} from 'lucide-react';

const features = [
  {
    icon: Gauge,
    badge: 'Algoritmo Core',
    title: 'Optimización Matemática del U.V.E.',
    description:
      'Calcula al segundo la U.V.E. Total Disponible, la U.V.E. Real asignada a zonas críticas, los déficits exactos y la reserva operativa, sugiriendo el vehículo ideal para cubrir cada cuadrante sin desperdiciar recursos.',
    highlights: ['Sin parpadeos de mapa', 'Cobertura por riesgo Alto / Medio / Bajo', 'Reserva estratégica'],
    span: 'lg:col-span-7',
    accent: 'from-lime-300/30 to-emerald-400/20',
  },
  {
    icon: Smartphone,
    badge: 'Sincronización Web ↔ Android',
    title: 'Flujo Bidireccional en Tiempo Real',
    description:
      'La App Android mantiene telemetría GPS activa incluso en segundo plano. Al cruzar el perímetro de la zona asignada, el banner cambia automáticamente de "Dirígete a: [Zona]" a "En patrullaje activo" y actualiza la consola central.',
    highlights: ['GPS en segundo plano', 'Geocerca automática', 'Notificaciones nativas con sonido'],
    span: 'lg:col-span-5',
    accent: 'from-cyan-300/30 to-teal-400/20',
  },
  {
    icon: Mic,
    badge: 'Comunicación Directa',
    title: 'Mensajería Táctica y Notas de Voz Nativas',
    description:
      'Canal directo entre Central de Mando y cada patrulla en servicio con grabación nativa de audio (MediaRecorder), reproducción instantánea y alertas de alta prioridad para decisiones críticas en terreno.',
    highlights: ['Audio Push-to-Talk', 'Alertas prioritarias', 'Historial persistente'],
    span: 'lg:col-span-4',
    accent: 'from-emerald-300/25 to-cyan-400/20',
  },
  {
    icon: Camera,
    badge: 'Respaldo Probatorio',
    title: 'Carga de Evidencias y Control de Atrasos',
    description:
      'Captura nativa de fotografías y video comprimido en 640p directamente desde cámara o galería, además del módulo de justificación evidenciada cuando la unidad se atrasa o no logra llegar a la zona asignada en el tiempo límite.',
    highlights: ['Foto y Video 640p', 'Justificación de falta/atraso', 'Bloqueo de cierre sin justificar'],
    span: 'lg:col-span-4',
    accent: 'from-lime-300/25 to-teal-400/20',
  },
  {
    icon: ShieldAlert,
    badge: 'Respuesta Inmediata',
    title: 'Refuerzos SOS U.V.E. y Dotación Viva',
    description:
      'Botón de Solicitud de Refuerzos (+0.5 a +2.0 U.V.E.) que despacha unidades por menor ETA, además de permitir sumar compañeros por RUT en pleno turno recalculando la tripulación al instante.',
    highlights: ['Despacho por menor ETA', 'Suma de compañeros por RUT', 'Rotación 15m a 2h'],
    span: 'lg:col-span-4',
    accent: 'from-teal-300/25 to-lime-400/20',
  },
];

const flowSteps = [
  { icon: Clock, title: '1. Rotación & Cálculo U.V.E.', desc: 'La central asigna cuadrantes óptimos.' },
  { icon: BellRing, title: '2. Alerta Push Android', desc: 'La patrulla recibe destino con sonido.' },
  { icon: MapPin, title: '3. Ingreso a Geocerca', desc: 'GPS valida entrada y activa patrullaje.' },
  { icon: Users, title: '4. Evidencia, Audio & SOS', desc: 'Flujo vivo reportado al supervisor.' },
];

export const FeaturesBentoSection: React.FC = () => {
  return (
    <section id="pilares" className="relative py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.25 }}
        transition={{ duration: 0.6 }}
        className="text-center max-w-3xl mx-auto mb-14"
      >
        <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full liquid-pill text-xs font-bold uppercase tracking-wider text-cyan-200 mb-4">
          <Radio className="w-3.5 h-3.5" />
          Capacidades de Alto Valor
        </span>
        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white tracking-tight">
          Un ecosistema diseñado para{' '}
          <span className="bg-gradient-to-r from-lime-200 via-emerald-200 to-cyan-200 bg-clip-text text-transparent">
            operación real en terreno
          </span>
        </h2>
      </motion.div>

      {/* Bento Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {features.map((feat, idx) => {
          const Icon = feat.icon;
          return (
            <motion.div
              key={feat.title}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.15 }}
              transition={{ duration: 0.55, delay: idx * 0.06 }}
              whileHover={{ y: -4 }}
              className={`${feat.span} liquid-glass rounded-[28px] p-6 sm:p-7 relative overflow-hidden group transition-all`}
            >
              <div
                className={`pointer-events-none absolute -top-20 -right-20 w-52 h-52 rounded-full bg-gradient-to-br ${feat.accent} blur-3xl opacity-70 group-hover:opacity-100 transition-opacity`}
              />
              <div className="relative z-10 flex flex-col h-full justify-between">
                <div>
                  <div className="flex items-center justify-between gap-3 mb-5">
                    <div className="w-12 h-12 rounded-2xl bg-white/15 border border-white/30 flex items-center justify-center text-lime-200 shadow-liquid-sm">
                      <Icon className="w-6 h-6" />
                    </div>
                    <span className="px-3 py-1 rounded-full bg-emerald-950/50 border border-white/20 text-[11px] font-bold text-emerald-100">
                      {feat.badge}
                    </span>
                  </div>
                  <h3 className="text-xl sm:text-2xl font-extrabold text-white mb-2.5">
                    {feat.title}
                  </h3>
                  <p className="text-sm text-emerald-50/80 leading-relaxed">{feat.description}</p>
                </div>

                <div className="mt-6 flex flex-wrap gap-2">
                  {feat.highlights.map((tag) => (
                    <span
                      key={tag}
                      className="px-3 py-1 rounded-full bg-white/12 border border-white/25 text-xs font-semibold text-lime-100"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Control Evidenciado por Falta o Atraso a Zona y Bloqueo de Cierre de Sesión */}
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.2 }}
        transition={{ duration: 0.6 }}
        className="mt-8 liquid-glass rounded-[30px] p-6 sm:p-8 lg:p-9 relative overflow-hidden border border-amber-300/40"
      >
        <div className="pointer-events-none absolute -top-24 -right-24 w-72 h-72 rounded-full bg-amber-400/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -left-24 w-72 h-72 rounded-full bg-lime-400/15 blur-3xl" />

        <div className="relative z-10 space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-500/25 border border-amber-300/50 text-amber-100 text-xs font-extrabold uppercase tracking-wider">
              <AlertTriangle className="w-4 h-4 text-amber-200" />
              <span>Auditoría de Cumplimiento Operativo</span>
            </div>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-500/25 border border-rose-300/45 text-xs font-extrabold text-rose-100">
              <Lock className="w-3.5 h-3.5" />
              Bloqueo de Cierre de Turno ante Retrasos Sin Justificar
            </span>
          </div>

          <div className="max-w-4xl">
            <h3 className="text-2xl sm:text-3xl font-extrabold text-white leading-tight">
              Control Evidenciado por Falta o Atraso a Zona Asignada
            </h3>
            <p className="mt-2.5 text-sm sm:text-base text-emerald-50/85 leading-relaxed">
              Cuando el <strong className="text-white">algoritmo automático</strong> o el{' '}
              <strong className="text-white">operador manualmente</strong> envían a una unidad hacia
              una zona y el funcionario <strong className="text-amber-200">no llega dentro del tiempo límite determinado (ETA)</strong>,
              el sistema registra automáticamente la falta o retraso sobre ese destino para exigir
              trazabilidad y responsabilidad operativa antes de finalizar el servicio.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-2xl bg-emerald-950/55 border border-amber-300/35 p-5 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between gap-2 mb-3">
                  <span className="w-9 h-9 rounded-xl bg-amber-400/20 border border-amber-300/45 flex items-center justify-center text-amber-200">
                    <Clock className="w-5 h-5" />
                  </span>
                  <span className="text-[11px] font-extrabold uppercase tracking-wider text-amber-200">
                    Paso 1 · Durante el Turno
                  </span>
                </div>
                <h4 className="text-base font-extrabold text-white">
                  Justificación Voluntaria en Panel de Evidencias
                </h4>
                <p className="mt-2 text-xs sm:text-sm text-emerald-50/85 leading-relaxed">
                  Si la unidad no logra arribar a tiempo al cuadrante asignado, el funcionario tiene
                  la opción inmediata en el <strong className="text-white">Panel de Evidencias</strong>{' '}
                  de agregar una <strong className="text-lime-200">descripción detallada y fotografía opcional</strong>{' '}
                  dejando evidenciado por qué se atrasó o no pudo llegar al destino (ej. procedimiento en ruta, congestión o desvío).
                </p>
              </div>
            </div>

            <div className="rounded-2xl bg-rose-950/50 border border-rose-300/40 p-5 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between gap-2 mb-3">
                  <span className="w-9 h-9 rounded-xl bg-rose-400/20 border border-rose-300/45 flex items-center justify-center text-rose-200">
                    <Lock className="w-5 h-5" />
                  </span>
                  <span className="text-[11px] font-extrabold uppercase tracking-wider text-rose-200">
                    Paso 2 · Regla de Bloqueo
                  </span>
                </div>
                <h4 className="text-base font-extrabold text-white">
                  Imposibilidad de Cerrar Sesión sin Evidencia
                </h4>
                <p className="mt-2 text-xs sm:text-sm text-emerald-50/85 leading-relaxed">
                  Si el funcionario presentó uno o más retrasos durante su turno y{' '}
                  <strong className="text-rose-200">no subió la evidencia oportunamente</strong>, al
                  intentar <strong className="text-white">Cerrar Sesión</strong> la aplicación{' '}
                  <strong className="text-rose-200">bloquea el cierre del turno</strong> e impide
                  abandonar el servicio hasta regularizar cada atraso pendiente.
                </p>
              </div>
            </div>

            <div className="rounded-2xl bg-emerald-950/55 border border-lime-300/40 p-5 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between gap-2 mb-3">
                  <span className="w-9 h-9 rounded-xl bg-lime-400/20 border border-lime-300/45 flex items-center justify-center text-lime-200">
                    <FileCheck2 className="w-5 h-5" />
                  </span>
                  <span className="text-[11px] font-extrabold uppercase tracking-wider text-lime-200">
                    Paso 3 · Liberación y Cierre
                  </span>
                </div>
                <h4 className="text-base font-extrabold text-white">
                  Descargo Obligatorio + Foto Opcional
                </h4>
                <p className="mt-2 text-xs sm:text-sm text-emerald-50/85 leading-relaxed">
                  Para poder cerrar sesión, el funcionario debe{' '}
                  <strong className="text-white">describir obligatoriamente</strong> el motivo por el
                  cual no llegó o se atrasó al y/o los destinos asignados, pudiendo{' '}
                  <strong className="text-lime-200">adjuntar fotografía de respaldo</strong>. Recién
                  una vez enviada la evidencia al supervisor se habilita el cierre de sesión.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl bg-white/10 border border-white/20 px-4 py-3 flex flex-wrap items-center justify-between gap-3 text-xs text-emerald-50/90">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-lime-300 shrink-0" />
              <span>
                <strong>Trazabilidad Total para el Mando:</strong> Todas las justificaciones de
                atraso quedan archivadas en la consola web junto a la hora, zona asignada, relato y
                respaldo fotográfico del funcionario.
              </span>
            </div>
          </div>
        </div>
      </motion.div>

      {/* End-to-End Real-Time Flow Strip */}
      <motion.div
        initial={{ opacity: 0, y: 22 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.2 }}
        transition={{ duration: 0.6 }}
        className="mt-8 liquid-glass-dark rounded-[28px] p-6 sm:p-8"
      >
        <p className="text-xs font-bold uppercase tracking-widest text-lime-300 mb-5 text-center sm:text-left">
          Flujo de Conexión Continuo Central Web ↔ App Móvil Android
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {flowSteps.map((step) => {
            const StepIcon = step.icon;
            return (
              <div
                key={step.title}
                className="rounded-2xl bg-white/8 border border-white/15 p-4 flex items-start gap-3.5"
              >
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-lime-300/25 to-cyan-400/25 border border-lime-200/40 flex items-center justify-center text-lime-200 shrink-0">
                  <StepIcon className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-white text-sm">{step.title}</h4>
                  <p className="text-xs text-emerald-100/75 mt-1">{step.desc}</p>
                </div>
              </div>
            );
          })}
        </div>
      </motion.div>
    </section>
  );
};
