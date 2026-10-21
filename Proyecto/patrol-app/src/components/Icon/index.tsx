import React from 'react';
import Svg, { Path, Circle, Rect } from 'react-native-svg';
import { Stroke } from '../../theme';

/**
 * Set de iconos vectoriales propios — lienzo 24×24, trazo uniforme de 1.5,
 * extremos redondeados y sin relleno.
 */
const P = {
  inicio: (
    <>
      <Path d="M12 21s7-5.6 7-11a7 7 0 1 0-14 0c0 5.4 7 11 7 11z" />
      <Circle cx="12" cy="10" r="2.6" />
    </>
  ),
  evidencia: (
    <>
      <Rect x="4" y="3" width="16" height="18" rx="3" />
      <Path d="M8 9h8M8 13h8M8 17h4" />
    </>
  ),
  mensajes: <Path d="M4 6a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3v8a3 3 0 0 1-3 3h-7l-4 4v-4a3 3 0 0 1-2-3z" />,
  perfil: (
    <>
      <Circle cx="12" cy="8" r="4" />
      <Path d="M4 21c0-4 3.6-6 8-6s8 2 8 6" />
    </>
  ),
  escudo: <Path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" />,
  alerta: (
    <>
      <Path d="M12 3.5l9.5 17h-19z" />
      <Path d="M12 10v4M12 17.4v.01" />
    </>
  ),
  campana: (
    <>
      <Path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z" />
      <Path d="M10 21h4" />
    </>
  ),
  mira: (
    <>
      <Circle cx="12" cy="12" r="7" />
      <Path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
    </>
  ),
  camara: (
    <>
      <Path d="M3 8a2 2 0 0 1 2-2h2l1.5-2h7L17 6h2a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <Circle cx="12" cy="13" r="3.5" />
    </>
  ),
  imagen: (
    <>
      <Rect x="3" y="4" width="18" height="16" rx="3" />
      <Circle cx="9" cy="10" r="1.6" />
      <Path d="M21 16l-5-5-9 9" />
    </>
  ),
  lupa: (
    <>
      <Circle cx="11" cy="11" r="6.5" />
      <Path d="M20 20l-4.2-4.2" />
    </>
  ),
  reloj: (
    <>
      <Circle cx="12" cy="12" r="9" />
      <Path d="M12 7v5l3 2" />
    </>
  ),
  check: (
    <>
      <Circle cx="12" cy="12" r="9" />
      <Path d="M8 12.5l2.7 2.7L16 9.5" />
    </>
  ),
  enviar: <Path d="M21 3L10 14M21 3l-7 18-4-7-7-4z" />,
  ojo: (
    <>
      <Path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" />
      <Circle cx="12" cy="12" r="3" />
    </>
  ),
  ojoOculto: (
    <>
      <Path d="M3 3l18 18" />
      <Path d="M10.6 5.1A10 10 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-3.2 4M6.5 6.6C3.7 8.5 2 12 2 12s3.6 7 10 7c1.7 0 3.2-.4 4.5-1" />
      <Path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
    </>
  ),
  flecha: <Path d="M5 12h14M13 6l6 6-6 6" />,
  atras: <Path d="M19 12H5M11 6l-6 6 6 6" />,
  cerrar: <Path d="M6 6l12 12M18 6L6 18" />,
  mas: <Path d="M12 5v14M5 12h14" />,
  candado: (
    <>
      <Rect x="5" y="11" width="14" height="10" rx="3" />
      <Path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </>
  ),
  id: (
    <>
      <Rect x="3" y="5" width="18" height="14" rx="3" />
      <Circle cx="9" cy="11" r="2" />
      <Path d="M6.5 16c.4-1.5 1.5-2 2.5-2s2.1.5 2.5 2M14 10h4M14 14h3" />
    </>
  ),
  lista: (
    <>
      <Rect x="5" y="4" width="14" height="17" rx="3" />
      <Path d="M9 4V3h6v1M9 11h6M9 15h4" />
    </>
  ),
  auto: (
    <>
      <Path d="M4 16v-4l2-5h12l2 5v4z" />
      <Path d="M4 12h16M7 16v2M17 16v2" />
      <Circle cx="8" cy="14" r=".5" />
      <Circle cx="16" cy="14" r=".5" />
    </>
  ),
  moto: (
    <>
      <Circle cx="6" cy="16" r="3" />
      <Circle cx="18" cy="16" r="3" />
      <Path d="M6 16l4-7h4l4 7M10 9L8 6H6M14 9h3" />
    </>
  ),
  bici: (
    <>
      <Circle cx="6" cy="16" r="3.5" />
      <Circle cx="18" cy="16" r="3.5" />
      <Path d="M6 16l4-8h6l2 8M10 8L12 16M9 6h3" />
    </>
  ),
  peaton: (
    <>
      <Circle cx="13" cy="4.5" r="1.8" />
      <Path d="M9 21l2.5-6-2-3 1.5-4 3.5 2 2.5 2M11.5 15l4 6M11 8.5L8 11" />
    </>
  ),
  grupo: (
    <>
      <Circle cx="9" cy="8" r="3.2" />
      <Path d="M3 20c0-3.6 2.8-5.5 6-5.5s6 1.9 6 5.5" />
      <Path d="M16 5.2a3 3 0 0 1 0 5.6M18 14.8c1.8.6 3 2.2 3 5.2" />
    </>
  ),
  salir: (
    <>
      <Path d="M10 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4" />
      <Path d="M16 8l4 4-4 4M20 12H9" />
    </>
  ),
  chevron: <Path d="M9 6l6 6-6 6" />,
  chart: (
    <>
      <Path d="M4 20V10M10 20V4M16 20v-8M22 20H2" />
    </>
  ),
  luna: <Path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" />,
  sol: (
    <>
      <Circle cx="12" cy="12" r="4" />
      <Path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </>
  ),
  senal: (
    <>
      <Path d="M5 19a10 10 0 0 1 0-14M19 5a10 10 0 0 1 0 14M8.5 15.5a5 5 0 0 1 0-7M15.5 8.5a5 5 0 0 1 0 7" />
      <Circle cx="12" cy="12" r="1" />
    </>
  ),
  microfono: (
    <>
      <Path d="M12 2a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" />
      <Path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v3M8 22h8" />
    </>
  ),
  play: <Path d="M5 3l14 9-14 9V3z" />,
  pausa: (
    <>
      <Rect x="6" y="4" width="4" height="16" rx="1" />
      <Rect x="14" y="4" width="4" height="16" rx="1" />
    </>
  ),
  video: (
    <>
      <Rect x="2" y="5" width="14" height="14" rx="2" />
      <Path d="M16 10l6-4v12l-6-4v-4z" />
    </>
  ),
};

export type IconName = keyof typeof P;

interface IconProps {
  name: IconName;
  size?: number;
  color?: string;
  strokeWidth?: number;
}

export default function Icon({ name, size = 22, color = '#111412', strokeWidth = Stroke }: IconProps) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {P[name]}
    </Svg>
  );
}
