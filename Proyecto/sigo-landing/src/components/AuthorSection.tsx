import React, { useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Check, Code2, Copy, ImagePlus, Mail, User } from 'lucide-react';

const AUTHOR_EMAIL = 'a.seplvedamuoz@gmail.com';

export const AuthorSection: React.FC = () => {
  const [copied, setCopied] = useState(false);
  const [photoUrl, setPhotoUrl] = useState<string | null>('/images/author.jpg');
  const [photoMissing, setPhotoMissing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleCopyEmail = async () => {
    try {
      await navigator.clipboard.writeText(AUTHOR_EMAIL);
      setCopied(true);
      setTimeout(() => setCopied(false), 2400);
    } catch {
      window.location.href = `mailto:${AUTHOR_EMAIL}`;
    }
  };

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const objectUrl = URL.createObjectURL(file);
    setPhotoUrl(objectUrl);
    setPhotoMissing(false);
  };

  return (
    <section id="autor" className="relative py-20 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.25 }}
        transition={{ duration: 0.65 }}
        className="liquid-glass rounded-[34px] p-7 sm:p-10 lg:p-12 relative overflow-hidden"
      >
        <div className="pointer-events-none absolute -top-24 -left-24 w-64 h-64 rounded-full bg-lime-300/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -right-24 w-64 h-64 rounded-full bg-cyan-300/20 blur-3xl" />

        <div className="relative z-10 flex flex-col md:flex-row items-center gap-8 lg:gap-11">
          {/* Author Photo Portrait Squircle Frame (calibrated for Axel's photo) */}
          <div className="shrink-0 flex flex-col items-center">
            <div
              onClick={() => fileInputRef.current?.click()}
              title="Haz clic si deseas probar otra foto"
              className="group relative w-48 h-56 sm:w-52 sm:h-60 rounded-[36px] p-[4px] bg-gradient-to-br from-lime-200 via-emerald-300 to-cyan-300 shadow-liquid-glow cursor-pointer transition-transform hover:scale-[1.02]"
            >
              <div className="w-full h-full rounded-[32px] overflow-hidden bg-emerald-950/80 flex flex-col items-center justify-center relative">
                {photoUrl && !photoMissing ? (
                  <img
                    src={photoUrl}
                    alt="Axel Lyan Sepúlveda Muñoz"
                    onError={() => setPhotoMissing(true)}
                    className="w-full h-full object-cover object-[center_20%]"
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center text-center px-4">
                    <div className="w-16 h-16 rounded-2xl bg-white/10 border border-white/25 flex items-center justify-center text-lime-200 mb-3">
                      <User className="w-8 h-8" />
                    </div>
                    <p className="text-xs font-bold text-white">Espacio para tu foto</p>
                  </div>
                )}

                {/* Subtle Hover Overlay */}
                <div className="absolute inset-0 bg-emerald-950/55 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white text-xs font-semibold gap-1.5">
                  <ImagePlus className="w-6 h-6 text-lime-300" />
                  <span>Cambiar foto</span>
                </div>
              </div>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handlePhotoSelect}
              className="hidden"
            />
          </div>

          {/* Author Details */}
          <div className="text-center md:text-left flex-1">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full liquid-pill text-xs font-bold text-lime-200 mb-4">
              <Code2 className="w-4 h-4" />
              <span>Autoría y Desarrollo del Sistema</span>
            </div>

            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-white tracking-tight">
              Axel Lyan Sepúlveda Muñoz
            </h2>
            <p className="mt-1.5 text-sm sm:text-base font-semibold text-cyan-200">
              Desarrollador Full-Stack & Mobile — Proyecto de Título S.I.G.O.
            </p>

            <p className="mt-4 text-sm sm:text-base text-emerald-50/85 leading-relaxed">
              Responsable del diseño integral, arquitectura Cloud Run en tiempo real, modelo de
              puntaje delictual por gravedad, motor de optimización algorítmica{' '}
              <strong className="text-white">U.V.E.</strong>, consola web de mando táctico
              multiplataforma y aplicación móvil nativa Android para la modernización del patrullaje
              preventivo.
            </p>

            {/* Contact Actions */}
            <div className="mt-6 flex flex-wrap items-center justify-center md:justify-start gap-3">
              <a
                href={`mailto:${AUTHOR_EMAIL}`}
                className="liquid-btn-primary inline-flex items-center gap-2.5 px-5 py-3 rounded-2xl text-sm font-bold transition-all"
              >
                <Mail className="w-4 h-4" />
                <span>{AUTHOR_EMAIL}</span>
              </a>

              <button
                type="button"
                onClick={handleCopyEmail}
                className="liquid-btn-secondary inline-flex items-center gap-2 px-4 py-3 rounded-2xl text-sm font-semibold text-white transition-all"
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4 text-lime-300" />
                    <span className="text-lime-200">¡Correo copiado!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    <span>Copiar correo</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </section>
  );
};
