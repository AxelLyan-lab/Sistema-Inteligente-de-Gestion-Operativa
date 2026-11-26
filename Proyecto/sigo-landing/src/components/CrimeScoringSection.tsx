import React from 'react';
import { motion } from 'framer-motion';
import { Flame, Scale, ShieldAlert, ShieldCheck, ShieldHalf } from 'lucide-react';

const crimePoints = [
  {
    points: '+50 pts',
    level: 'Delito Crítico',
    examples: 'Arma de fuego, homicidio, hechos de máxima gravedad',
    badgeClass: 'bg-rose-500/25 border-rose-300/50 text-rose-200',
  },
  {
    points: '+20 pts',
    level: 'Grave contra las Personas',
    examples: 'Robo con violencia, robo con intimidación, agresiones graves',
    badgeClass: 'bg-orange-500/25 border-orange-300/50 text-orange-200',
  },
  {
    points: '+10 pts',
    level: 'Grave contra la Propiedad',
    examples: 'Portonazo, robo de vehículo, robo en lugar habitado',
    badgeClass: 'bg-amber-500/25 border-amber-300/50 text-amber-200',
  },
  {
    points: '+5 pts',
    level: 'Delito Medio',
    examples: 'Lanzazo, robo por sorpresa, receptación',
    badgeClass: 'bg-yellow-400/20 border-yellow-300/45 text-yellow-100',
  },
  {
    points: '+2 pts',
    level: 'Falta / Riesgo Bajo',
    examples: 'Hurto simple, daños menores a la propiedad',
    badgeClass: 'bg-emerald-400/20 border-emerald-300/45 text-emerald-100',
  },
  {
    points: '+1 pt',
    level: 'Incivilidad',
    examples: 'Consumo de alcohol en vía pública, ruidos, desórdenes',
    badgeClass: 'bg-cyan-400/20 border-cyan-300/45 text-cyan-100',
  },
];

const riskTiers = [
  {
    icon: ShieldAlert,
    tier: 'Riesgo ALTO',
    threshold: '> 80 puntos',
    uveDemand: '1.00 U.V.E. (o combo 1.25)',
    allowed: '1 Furgón Z (1.00), 1 Patrulla 3 tripulantes (1.00) o Combo RPD (0.80) + Moto MTT (0.45).',
    forbidden: 'Prohibido enviar Bicicletas (CB) o Infantería (INF) por seguridad del personal.',
    cardStyle: 'border-rose-400/45 bg-gradient-to-br from-rose-500/20 to-emerald-950/60',
    pillStyle: 'bg-rose-500/30 text-rose-100 border-rose-300/50',
  },
  {
    icon: ShieldHalf,
    tier: 'Riesgo MEDIO',
    threshold: '40 a 80 puntos',
    uveDemand: '0.45 a 0.80 U.V.E.',
    allowed: '1 Radiopatrulla 1-2 tripulantes (RPD · 0.80) o 1 Moto Todoterreno (MTT · 0.45).',
    forbidden: 'Evita exponer Infantería/Bicicleta y evita malgastar recursos pesados (FZ / RPT).',
    cardStyle: 'border-amber-300/45 bg-gradient-to-br from-amber-500/20 to-emerald-950/60',
    pillStyle: 'bg-amber-500/30 text-amber-100 border-amber-300/50',
  },
  {
    icon: ShieldCheck,
    tier: 'Riesgo BAJO',
    threshold: '< 40 puntos',
    uveDemand: '0.20 a 0.30 U.V.E.',
    allowed: '1 Carabinero en Bicicleta (CB · 0.30) o 1 Infantería a Pie (INF · 0.20).',
    forbidden: 'Reserva los vehículos motorizados mayores para zonas de prioridad Media y Alta.',
    cardStyle: 'border-lime-300/45 bg-gradient-to-br from-lime-500/20 to-emerald-950/60',
    pillStyle: 'bg-lime-400/30 text-lime-100 border-lime-300/50',
  },
];

export const CrimeScoringSection: React.FC = () => {
  return (
    <section id="puntaje-delitos" className="relative py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.2 }}
        transition={{ duration: 0.6 }}
        className="text-center max-w-3xl mx-auto mb-14"
      >
        <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full liquid-pill text-xs font-bold uppercase tracking-wider text-lime-200 mb-4">
          <Scale className="w-3.5 h-3.5" />
          Modelo Propuesto de Puntaje Delictual
        </span>
        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white tracking-tight">
          Clasificación de Delitos por Puntos y{' '}
          <span className="bg-gradient-to-r from-lime-200 via-emerald-200 to-cyan-200 bg-clip-text text-transparent">
            Nivel de Riesgo de Zona
          </span>
        </h2>
        <p className="mt-4 text-emerald-50/80 text-base sm:text-lg">
          De la mano con la optimización del <strong className="text-white">U.V.E.</strong>, S.I.G.O.
          incorpora una escala de puntaje propuesta para ponderar cada hecho delictual dentro de un
          cuadrante y clasificar automáticamente si una zona es de{' '}
          <strong className="text-lime-200">Riesgo Bajo, Medio o Alto</strong>.
        </p>
      </motion.div>

      <div className="grid lg:grid-cols-12 gap-6 items-start">
        {/* Left: Crime Scoring Table */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.6 }}
          className="lg:col-span-6 liquid-glass rounded-[30px] p-6 sm:p-8"
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="w-11 h-11 rounded-2xl bg-lime-300/20 border border-lime-200/45 flex items-center justify-center text-lime-200">
              <Flame className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-xl font-extrabold text-white">Escala de Gravedad por Delito</h3>
              <p className="text-xs text-emerald-100/75">
                La suma de los delitos registrados en el perímetro define el Score de Gravedad
              </p>
            </div>
          </div>

          <div className="space-y-3">
            {crimePoints.map((item) => (
              <div
                key={item.level}
                className="rounded-2xl bg-emerald-950/45 border border-white/15 px-4 py-3.5 flex items-center justify-between gap-4"
              >
                <div className="min-w-0">
                  <p className="text-sm font-bold text-white">{item.level}</p>
                  <p className="text-xs text-emerald-100/75 mt-0.5">{item.examples}</p>
                </div>
                <span
                  className={`shrink-0 px-3 py-1.5 rounded-xl border text-xs font-extrabold tabular-nums ${item.badgeClass}`}
                >
                  {item.points}
                </span>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Right: Resulting Risk Zones & U.V.E. Compatibility */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.6 }}
          className="lg:col-span-6 space-y-4"
        >
          {riskTiers.map((tier) => {
            const Icon = tier.icon;
            return (
              <div
                key={tier.tier}
                className={`rounded-[26px] border p-5 sm:p-6 backdrop-blur-xl shadow-liquid-sm ${tier.cardStyle}`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2.5">
                    <Icon className="w-5 h-5 text-white" />
                    <h3 className="text-lg font-extrabold text-white">{tier.tier}</h3>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-3 py-1 rounded-full border text-xs font-extrabold ${tier.pillStyle}`}
                    >
                      {tier.threshold}
                    </span>
                    <span className="px-3 py-1 rounded-full bg-white/15 border border-white/25 text-xs font-bold text-white">
                      {tier.uveDemand}
                    </span>
                  </div>
                </div>
                <p className="text-xs sm:text-sm text-emerald-50/90 leading-relaxed">
                  <strong className="text-lime-200">Unidades permitidas:</strong> {tier.allowed}
                </p>
                <p className="text-xs text-emerald-100/75 mt-1.5 leading-relaxed">
                  <strong className="text-white">Regla táctica:</strong> {tier.forbidden}
                </p>
              </div>
            );
          })}
        </motion.div>
      </div>

      {/* Dotación de Refuerzo para Emergencias SOS */}
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.2 }}
        transition={{ duration: 0.6 }}
        className="mt-10 liquid-glass rounded-[30px] p-6 sm:p-8 lg:p-9 relative overflow-hidden border border-rose-300/35"
      >
        <div className="pointer-events-none absolute -top-24 -right-24 w-64 h-64 rounded-full bg-rose-400/20 blur-3xl" />

        <div className="relative z-10 grid lg:grid-cols-12 gap-7 items-center">
          <div className="lg:col-span-6 space-y-4">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-rose-500/25 border border-rose-300/50 text-rose-100 text-xs font-extrabold uppercase tracking-wider">
              <ShieldAlert className="w-4 h-4 text-rose-200" />
              <span>Protocolo de Refuerzos SOS</span>
            </div>

            <h3 className="text-2xl sm:text-3xl font-extrabold text-white leading-tight">
              Dotación Configurable de Refuerzo SOS y Regla de Respuesta
            </h3>

            <p className="text-sm sm:text-base text-emerald-50/85 leading-relaxed">
              Desde la consola del operador se configura la meta de refuerzos SOS (desde{' '}
              <strong className="text-white">0.80 hasta 4.00 U.V.E.</strong>, ej.{' '}
              <strong className="text-lime-200">2.45 U.V.E.</strong>). Al emitirse un pedido de
              auxilio, el algoritmo calcula el menor tiempo de llegada (<strong className="text-white">ETA</strong>)
              y despacha automáticamente las unidades más cercanas sin sobrepasar la cuota.
            </p>

            <div className="grid sm:grid-cols-2 gap-3 pt-1">
              <div className="rounded-2xl bg-emerald-950/55 border border-lime-300/35 p-4">
                <p className="text-xs font-extrabold text-lime-200 uppercase tracking-wider">
                  ✅ Quiénes Acuden al SOS
                </p>
                <p className="text-xs sm:text-sm text-white/90 mt-1.5 leading-relaxed">
                  <strong>Solo vehículos motorizados:</strong>{' '}
                  <strong>Patrullas (RPD/RPT)</strong>, <strong>Furgones Z (FZ)</strong> y{' '}
                  <strong>Motocicletas (MTT)</strong> (priorizando Patrullas y Furgones, usando
                  Motos para completar la U.V.E.).
                </p>
              </div>

              <div className="rounded-2xl bg-rose-950/45 border border-rose-300/35 p-4">
                <p className="text-xs font-extrabold text-rose-200 uppercase tracking-wider">
                  🚫 Infantería y Bicicleta
                </p>
                <p className="text-xs sm:text-sm text-white/90 mt-1.5 leading-relaxed">
                  Los <strong>infantes a pie (INF)</strong> y{' '}
                  <strong>carabineros en bicicleta (CB)</strong>{' '}
                  <strong>NO acuden al llamado SOS</strong>, pero{' '}
                  <strong className="text-lime-200">SÍ pueden realizarlo</strong> para recibir
                  rescate motorizado inmediato.
                </p>
              </div>
            </div>
          </div>

          <div className="lg:col-span-6">
            <div className="rounded-2xl overflow-hidden bg-white p-2.5 shadow-[0_20px_50px_-12px_rgba(1,22,18,0.65)] border border-white/50">
              <img
                src="/images/web-sos-config.png"
                alt="Configuración real de Dotación y Recursos para Refuerzos SOS en S.I.G.O."
                className="w-full h-auto block rounded-xl"
              />
            </div>
            <p className="mt-2.5 text-center text-xs text-emerald-100/75">
              Captura real del panel de Ajustes: selector de meta U.V.E. para refuerzos SOS
            </p>
          </div>
        </div>
      </motion.div>
    </section>
  );
};
