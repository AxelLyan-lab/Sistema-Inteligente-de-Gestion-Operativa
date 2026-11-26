import React, { useRef } from 'react';
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';

interface LaptopMockup3DProps {
  imageSrc: string;
  imageAlt: string;
  urlLabel?: string;
  badgeText?: string;
  className?: string;
  onImageClick?: () => void;
}

export const Interactive3DLaptop: React.FC<LaptopMockup3DProps> = ({
  imageSrc,
  imageAlt,
  urlLabel = 'sigo-cl.run.app — Consola de Mando Táctico',
  badgeText = 'AUTO OPTIMIZADO',
  className = '',
  onImageClick,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  const smoothX = useSpring(mouseX, { stiffness: 140, damping: 22 });
  const smoothY = useSpring(mouseY, { stiffness: 140, damping: 22 });

  const rotateX = useTransform(smoothY, [-0.5, 0.5], [7, -7]);
  const rotateY = useTransform(smoothX, [-0.5, 0.5], [-8, 8]);
  const glareX = useTransform(smoothX, [-0.5, 0.5], ['10%', '90%']);
  const glareY = useTransform(smoothY, [-0.5, 0.5], ['10%', '90%']);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    mouseX.set(x);
    mouseY.set(y);
  };

  const handleMouseLeave = () => {
    mouseX.set(0);
    mouseY.set(0);
  };

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className={`perspective-1400 select-none ${className}`}
    >
      <motion.div
        style={{ rotateX, rotateY }}
        className="preserve-3d relative transition-shadow duration-300"
      >
        {/* Outer Laptop Lid */}
        <div className="relative rounded-[22px] p-[8px] bg-gradient-to-b from-slate-200/80 via-slate-400/50 to-slate-800/90 shadow-[0_32px_70px_-14px_rgba(1,22,18,0.78)] border border-white/40">
          {/* Dark Display Bezel */}
          <div className="relative rounded-[14px] overflow-hidden bg-slate-950 border border-white/15">
            {/* Browser Top Chrome */}
            <div className="flex items-center justify-between px-3.5 py-2 bg-slate-900/95 border-b border-white/10">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-400/90" />
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400/90" />
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400/90" />
              </div>
              <div className="hidden sm:flex items-center gap-2 px-3 py-0.5 rounded-full bg-white/10 border border-white/10 text-[10px] font-medium text-emerald-100/80 truncate max-w-[60%]">
                <span className="w-1.5 h-1.5 rounded-full bg-lime-400 animate-pulse" />
                <span className="truncate">{urlLabel}</span>
              </div>
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/40 text-[9px] font-bold tracking-wider text-lime-300">
                {badgeText}
              </span>
            </div>

            {/* Consistent Laptop Viewport — Zero Cropping & Uniform Height across all modes */}
            <div
              onClick={onImageClick}
              className={`relative aspect-[16/8.3] w-full overflow-hidden bg-slate-950 flex items-center justify-center ${onImageClick ? 'cursor-zoom-in' : ''}`}
            >
              <motion.img
                key={imageSrc}
                src={imageSrc}
                alt={imageAlt}
                initial={{ opacity: 0.35 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.3 }}
                className="w-full h-full object-contain"
              />

              {/* Subtle Dynamic Specular Glass Glare */}
              <motion.div
                className="pointer-events-none absolute inset-0 opacity-20 mix-blend-overlay"
                style={{
                  background: useTransform(
                    [glareX, glareY],
                    ([gx, gy]) =>
                      `radial-gradient(circle at ${gx} ${gy}, rgba(255,255,255,0.85) 0%, rgba(163,230,53,0.12) 35%, transparent 65%)`,
                  ),
                }}
              />
            </div>
          </div>
        </div>

        {/* Metallic Aluminum Base Lip */}
        <div className="relative mx-auto w-[105%] -ml-[2.5%] h-[13px] rounded-b-[14px] bg-gradient-to-b from-slate-200/90 via-slate-300/80 to-slate-500/90 shadow-[0_18px_36px_-6px_rgba(1,20,16,0.75)] border-t border-white/70">
          <div className="mx-auto w-20 h-[4px] rounded-b-md bg-slate-600/50" />
        </div>
      </motion.div>
    </div>
  );
};

interface PhoneMockup3DProps {
  imageSrc?: string;
  imageAlt?: string;
  className?: string;
  onImageClick?: () => void;
  children?: React.ReactNode;
}

export const Interactive3DPhone: React.FC<PhoneMockup3DProps> = ({
  imageSrc,
  imageAlt = 'App Móvil S.I.G.O.',
  className = '',
  onImageClick,
  children,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  const smoothX = useSpring(mouseX, { stiffness: 160, damping: 20 });
  const smoothY = useSpring(mouseY, { stiffness: 160, damping: 20 });

  const rotateX = useTransform(smoothY, [-0.5, 0.5], [12, -12]);
  const rotateY = useTransform(smoothX, [-0.5, 0.5], [-14, 14]);
  const glareX = useTransform(smoothX, [-0.5, 0.5], ['15%', '85%']);
  const glareY = useTransform(smoothY, [-0.5, 0.5], ['15%', '85%']);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    mouseX.set(x);
    mouseY.set(y);
  };

  const handleMouseLeave = () => {
    mouseX.set(0);
    mouseY.set(0);
  };

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className={`perspective-1400 select-none ${className}`}
    >
      <motion.div style={{ rotateX, rotateY }} className="preserve-3d relative">
        {/* Android Flagship Metallic Frame */}
        <div className="relative rounded-[38px] p-[8px] bg-gradient-to-br from-emerald-100/80 via-slate-700 to-emerald-950 shadow-[0_32px_68px_-12px_rgba(1,22,18,0.85),0_0_32px_rgba(163,230,53,0.22)] border border-white/45">
          {/* Side Hardware Buttons */}
          <div className="absolute -right-[3px] top-24 w-[3px] h-10 rounded-r bg-slate-300/80" />
          <div className="absolute -right-[3px] top-36 w-[3px] h-14 rounded-r bg-slate-300/80" />

          {/* Inner Screen Bezel */}
          <div
            onClick={onImageClick}
            className={`relative rounded-[31px] overflow-hidden bg-white aspect-[9/19.4] border border-black/80 ${onImageClick ? 'cursor-zoom-in' : ''}`}
          >
            {/* Punch-Hole Camera (Android Style) */}
            <div className="pointer-events-none absolute top-2.5 left-1/2 -translate-x-1/2 z-20 w-3 h-3 rounded-full bg-slate-950 border border-slate-700/70 shadow-inner" />

            {children ? (
              <div className="w-full h-full">{children}</div>
            ) : (
              imageSrc && (
                <motion.img
                  key={imageSrc}
                  src={imageSrc}
                  alt={imageAlt}
                  initial={{ opacity: 0.35 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.3 }}
                  className="w-full h-full object-contain bg-white"
                />
              )
            )}

            {/* Dynamic Glass Sheen */}
            <motion.div
              className="pointer-events-none absolute inset-0 opacity-20 mix-blend-overlay z-10"
              style={{
                background: useTransform(
                  [glareX, glareY],
                  ([gx, gy]) =>
                    `radial-gradient(circle at ${gx} ${gy}, rgba(255,255,255,0.9) 0%, rgba(34,211,238,0.18) 38%, transparent 65%)`,
                ),
              }}
            />
          </div>
        </div>
      </motion.div>
    </div>
  );
};
