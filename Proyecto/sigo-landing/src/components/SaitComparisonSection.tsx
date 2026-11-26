import React from 'react';
import { motion } from 'framer-motion';
import {
  AlertTriangle,
  CheckCircle2,
  Cpu,
  Hand,
  Info,
  RefreshCw,
  Sparkles,
  XCircle,
} from 'lucide-react';

const uveUnits = [
  {
    code: 'FZ',
    name: 'Furgón Z',
    crew: '2 a 3 efectivos',
    value: '1.00 U.V.E.',
    color: 'from-lime-300 to-emerald-400',
  },
  {
    code: 'RPT',
    name: 'Radiopatrulla (3 tripulantes)',
    crew: '3 efectivos',
    value: '1.00 U.V.E.',
    color: 'from-lime-200 to-teal-300',
  },
  {
    code: 'RPD',
    name: 'Radiopatrulla (1 o 2 tripulantes)',
    crew: '1 a 2 efectivos',
    value: '0.80 U.V.E.',
    color: 'from-emerald-300 to-teal-400',
  },
  {
    code: 'MTT',
    name: 'Moto Todoterreno',
    crew: '1 efectivo',
    value: '0.45 U.V.E.',
    color: 'from-teal-300 to-cyan-400',
  },
  {
    code: 'CB',
    name: 'Carabinero en Bicicleta',
    crew: '1 a 2 efectivos',
    value: '0.30 U.V.E.',
    color: 'from-cyan-300 to-emerald-300',
  },
  {
    code: 'INF',
    name: 'Infantería a Pie',
    crew: '1 a 2 efectivos',
    value: '0.20 U.V.E.',
    color: 'from-cyan-200 to-sky-400',
  },
];

export const SaitComparisonSection: React.FC = () => {
  return (
    <section id="diferenciacion" className="relative py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.25 }}
        transition={{ duration: 0.6 }}
        className="text-center max-w-3xl mx-auto mb-14"
      >
        <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full liquid-pill text-xs font-bold uppercase tracking-wider text-lime-200 mb-4">
          <Sparkles className="w-3.5 h-3.5" />
          Diferenciación
        </span>
        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white tracking-tight">
          Diferenciación frente al{' '}
          <span className="bg-gradient-to-r from-lime-200 to-cyan-200 bg-clip-text text-transparent">
            sistema actual SAIT
          </span>
        </h2>
        <p className="mt-4 text-emerald-50/80 text-base sm:text-lg">
          El sistema actual <strong className="text-white">SAIT de Carabineros</strong> opera de
          forma manual desde central y sin app móvil para el patrullero.{' '}
          <strong className="text-lime-200">S.I.G.O.</strong> conserva el modo{' '}
          <strong className="text-white">Manual</strong>, pero incorpora despacho{' '}
          <strong className="text-cyan-200">Automático</strong> y{' '}
          <strong className="text-lime-200">Automático Optimizado</strong> junto con una app móvil
          conectada en vivo.
        </p>
      </motion.div>

      {/* Comparison Cards */}
      <div className="grid lg:grid-cols-12 gap-6 items-stretch">
        {/* SAIT Current Card */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.6 }}
          className="lg:col-span-5 liquid-glass-dark rounded-[28px] p-7 sm:p-8 flex flex-col justify-between border border-rose-300/20"
        >
          <div>
            <div className="flex items-center justify-between gap-3 mb-6">
              <div className="inline-flex items-center gap-2.5 px-3.5 py-1.5 rounded-full bg-rose-500/15 border border-rose-300/30 text-rose-200 text-xs font-bold">
                <AlertTriangle className="w-4 h-4" />
                <span>SISTEMA ACTUAL</span>
              </div>
              <span className="text-xs font-semibold text-emerald-100/60">Operación Tradicional</span>
            </div>

            <h3 className="text-2xl font-extrabold text-white mb-3">SAIT (Enfoque Manual)</h3>
            <p className="text-sm text-emerald-100/75 leading-relaxed mb-6">
              Aunque cuenta con mapa y telemetría en vivo en la pantalla del operador, toda la
              gestión de despacho es manual y carece de conexión móvil directa para el funcionario en
              terreno.
            </p>

            <ul className="space-y-3.5 text-sm text-emerald-50/80">
              <li className="flex items-start gap-3">
                <XCircle className="w-5 h-5 text-rose-300 shrink-0 mt-0.5" />
                <span>
                  <strong className="text-white">Sin App Móvil para patrulleros:</strong> el
                  carabinero no recibe ruta, geocerca ni alertas en un teléfono; simplemente le
                  indican la coordenada y se desplazan al sector.
                </span>
              </li>
              <li className="flex items-start gap-3">
                <XCircle className="w-5 h-5 text-rose-300 shrink-0 mt-0.5" />
                <span>
                  <strong className="text-white">Despacho 100% manual:</strong> cada asignación y
                  reasignación depende completamente del cálculo manual del operador.
                </span>
              </li>
              <li className="flex items-start gap-3">
                <XCircle className="w-5 h-5 text-rose-300 shrink-0 mt-0.5" />
                <span>
                  <strong className="text-white">Sin optimización matemática U.V.E.:</strong> riesgo
                  de sobre-asignar recursos pesados a zonas de bajo riesgo o dejar déficits activos.
                </span>
              </li>
              <li className="flex items-start gap-3">
                <XCircle className="w-5 h-5 text-rose-300 shrink-0 mt-0.5" />
                <span>
                  <strong className="text-white">Sin rotación preventiva automática:</strong> no
                  ejecuta ciclos automáticos anti-fijación ni carga directa de evidencias/audios.
                </span>
              </li>
            </ul>
          </div>
        </motion.div>

        {/* S.I.G.O. Tri-Modal Evolution Card */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.6 }}
          className="lg:col-span-7 liquid-glass rounded-[28px] p-7 sm:p-8 relative overflow-hidden"
        >
          <div className="pointer-events-none absolute -top-24 -right-24 w-64 h-64 rounded-full bg-lime-300/25 blur-3xl" />

          <div className="relative z-10">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-lime-300/25 border border-lime-200/60 text-lime-100 text-xs font-extrabold">
                <CheckCircle2 className="w-4 h-4 text-lime-300" />
                <span>EVOLUCIÓN TRI-MODAL S.I.G.O.</span>
              </div>
              <span className="text-xs font-semibold text-cyan-100">
                100% adaptable a la doctrina operativa
              </span>
            </div>

            <h3 className="text-2xl sm:text-3xl font-extrabold text-white mb-6">
              3 Modos de Despacho en un Clic
            </h3>

            {/* 3 Modes Grid */}
            <div className="grid sm:grid-cols-3 gap-4 mb-7">
              <div className="rounded-2xl bg-emerald-950/45 border border-white/20 p-4 backdrop-blur-md">
                <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center text-white mb-3">
                  <Hand className="w-5 h-5" />
                </div>
                <h4 className="font-bold text-white text-base">1. Manual</h4>
                <p className="text-xs text-emerald-100/80 mt-1.5 leading-relaxed">
                  Control humano total para procedimientos específicos, idéntico a la doctrina
                  clásica.
                </p>
              </div>

              <div className="rounded-2xl bg-emerald-950/45 border border-cyan-300/35 p-4 backdrop-blur-md">
                <div className="w-10 h-10 rounded-xl bg-cyan-400/20 flex items-center justify-center text-cyan-200 mb-3">
                  <RefreshCw className="w-5 h-5" />
                </div>
                <h4 className="font-bold text-cyan-100 text-base">2. Automático</h4>
                <p className="text-xs text-emerald-100/80 mt-1.5 leading-relaxed">
                  Rotación preventiva y asignación periódica automática mediante contrarreloj
                  configurable (15 min a 2 horas).
                </p>
              </div>

              <div className="rounded-2xl bg-gradient-to-br from-lime-400/25 via-emerald-500/25 to-cyan-500/25 border border-lime-300/60 p-4 backdrop-blur-md shadow-liquid-glow">
                <div className="w-10 h-10 rounded-xl bg-lime-300 flex items-center justify-center text-emerald-950 mb-3 shadow-md">
                  <Cpu className="w-5 h-5" />
                </div>
                <h4 className="font-extrabold text-lime-200 text-base">3. Auto Optimizado</h4>
                <p className="text-xs text-white/90 mt-1.5 leading-relaxed">
                  <strong>Optimiza matemáticamente el recurso U.V.E.</strong> combinando riesgo
                  delictual + capacidad vehicular para cero desperdicio.
                </p>
              </div>
            </div>

            {/* Complete U.V.E. Resource Optimization Strip (All 6 units including Bicycle + RPD/RPT crew rule) */}
            <div className="rounded-2xl bg-emerald-950/55 border border-white/20 p-4 sm:p-5">
              <div className="flex items-center justify-between flex-wrap gap-2 mb-3.5">
                <span className="text-xs font-bold uppercase tracking-wider text-lime-200">
                  Ponderación Matemática U.V.E. (Unidad de Vigilancia Equivalente)
                </span>
                <span className="text-[11px] text-cyan-200 font-medium">
                  Cálculo continuo de cobertura, déficit y reserva
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {uveUnits.map((unit) => (
                  <div
                    key={unit.code}
                    className="rounded-xl bg-white/10 border border-white/15 px-3 py-2.5 flex flex-col"
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span
                        className={`text-sm font-extrabold bg-gradient-to-r ${unit.color} bg-clip-text text-transparent`}
                      >
                        {unit.value}
                      </span>
                      <span className="px-1.5 py-0.5 rounded bg-white/10 text-[10px] font-bold text-white">
                        {unit.code}
                      </span>
                    </div>
                    <span className="text-xs font-bold text-white mt-1 leading-tight">
                      {unit.name}
                    </span>
                    <span className="text-[10px] text-emerald-100/70 mt-0.5">{unit.crew}</span>
                  </div>
                ))}
              </div>

              {/* Explicit Crew Rule Callout */}
              <div className="mt-3.5 rounded-xl bg-lime-400/15 border border-lime-300/35 px-3.5 py-2.5 flex items-start gap-2.5 text-xs text-emerald-50">
                <Info className="w-4 h-4 text-lime-300 shrink-0 mt-0.5" />
                <span>
                  <strong className="text-lime-200">Regla dinámica de tripulación en Patrulla:</strong>{' '}
                  una radiopatrulla con <strong className="text-white">1 o 2 tripulantes</strong>{' '}
                  equivale a <strong className="text-lime-200">0.80 U.V.E. (RPD)</strong>, y con{' '}
                  <strong className="text-white">3 tripulantes</strong> asciende automáticamente a{' '}
                  <strong className="text-lime-200">1.00 U.V.E. (RPT)</strong>.
                </span>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
};
