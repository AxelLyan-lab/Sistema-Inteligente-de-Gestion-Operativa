import React from 'react';
import { motion } from 'framer-motion';
import { Compass, Cpu, Globe2, Layers, ShieldCheck, Smartphone } from 'lucide-react';

const pillars = [
  {
    icon: Cpu,
    title: 'Motor Matemático U.V.E.',
    desc: 'Traduce tanto la capacidad operativa de cada patrulla como la gravedad delictual de cada cuadrante a una unidad común: la Unidad de Vigilancia Equivalente.',
  },
  {
    icon: Smartphone,
    title: 'Conectividad Directa a Terreno',
    desc: 'Conecta la Consola Web de la Central con una App Móvil nativa Android que guía a cada funcionario hacia su zona asignada con GPS y alertas en segundo plano.',
  },
  {
    icon: Compass,
    title: 'Rotación Preventiva Anti-Fijación',
    desc: 'Rota dinámicamente las zonas activas sin repetir ciclos consecutivos, evitando patrones predecibles y maximizando la cobertura preventiva con la misma flota.',
  },
];

export const WhatIsSigoSection: React.FC = () => {
  return (
    <section id="que-es-sigo" className="relative py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 22 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.25 }}
        transition={{ duration: 0.6 }}
        className="liquid-glass rounded-[34px] p-7 sm:p-10 lg:p-12 relative overflow-hidden"
      >
        <div className="pointer-events-none absolute -top-24 -right-24 w-72 h-72 rounded-full bg-lime-300/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -left-24 w-72 h-72 rounded-full bg-cyan-300/20 blur-3xl" />

        <div className="relative z-10">
          <div className="max-w-3xl">
            <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full liquid-pill text-xs font-bold uppercase tracking-wider text-lime-200 mb-4">
              <ShieldCheck className="w-4 h-4" />
              ¿Qué es S.I.G.O.?
            </span>

            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white tracking-tight">
              Sistema Inteligente de{' '}
              <span className="bg-gradient-to-r from-lime-200 via-emerald-200 to-cyan-200 bg-clip-text text-transparent">
                Gestión Operativa
              </span>
            </h2>

            <p className="mt-4 text-base sm:text-lg text-emerald-50/85 leading-relaxed">
              <strong className="text-white">S.I.G.O.</strong> es una plataforma táctica de mando,
              control y patrullaje preventivo desarrollada para modernizar la gestión de recursos
              policiales. Integra en tiempo real una{' '}
              <strong className="text-lime-200">Consola Web de Operador</strong> y una{' '}
              <strong className="text-cyan-200">Aplicación Móvil Android</strong> para optimizar
              matemáticamente dónde, cuándo y con qué tipo de vehículo patrullar cada sector crítico,
              evitando tanto la sobre-asignación como la falta de cobertura.
            </p>
          </div>

          <div className="mt-9 grid grid-cols-1 md:grid-cols-3 gap-5">
            {pillars.map((item, idx) => {
              const Icon = item.icon;
              return (
                <motion.div
                  key={item.title}
                  initial={{ opacity: 0, y: 18 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.2 }}
                  transition={{ duration: 0.5, delay: idx * 0.08 }}
                  className="rounded-2xl bg-emerald-950/45 border border-white/20 p-5 backdrop-blur-md"
                >
                  <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-lime-300/25 to-cyan-400/25 border border-lime-200/40 flex items-center justify-center text-lime-200 mb-4">
                    <Icon className="w-5 h-5" />
                  </div>
                  <h3 className="text-lg font-extrabold text-white">{item.title}</h3>
                  <p className="mt-2 text-sm text-emerald-100/80 leading-relaxed">{item.desc}</p>
                </motion.div>
              );
            })}
          </div>

          {/* Alcance Demo Viña del Mar & Proyección Plan Cuadrante */}
          <div className="mt-8 rounded-2xl bg-gradient-to-r from-lime-400/15 via-emerald-500/15 to-cyan-400/20 border border-lime-300/45 p-5 sm:p-6 flex flex-col sm:flex-row items-start gap-4">
            <div className="w-11 h-11 rounded-xl bg-lime-300/25 border border-lime-200/50 flex items-center justify-center text-lime-200 shrink-0">
              <Globe2 className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-extrabold uppercase tracking-wider text-lime-200">
                Alcance de la Versión Demo · Escalable a Plan Cuadrante
              </p>
              <p className="mt-1.5 text-sm sm:text-base text-emerald-50/90 leading-relaxed">
                Esta versión demostrativa está{' '}
                <strong className="text-white">centralizada en Viña del Mar</strong> con el objetivo
                de mostrar y validar en vivo todas las funcionalidades del ecosistema. Su
                arquitectura está pensada y diseñada para ser{' '}
                <strong className="text-lime-200">futuramente ampliable</strong> y operar por{' '}
                <strong className="text-cyan-200">Plan Cuadrante</strong> en cualquier comuna o
                sector del país.
              </p>
            </div>
          </div>

          <div className="mt-6 inline-flex items-center gap-2.5 text-xs font-semibold text-cyan-200">
            <Layers className="w-4 h-4 shrink-0" />
            <span>
              Arquitectura 100% sincronizada: Backend táctico 24/7 + Consola Web + App Android Nativa
            </span>
          </div>
        </div>
      </motion.div>
    </section>
  );
};
