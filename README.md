# S.I.G.O. — Sprint 2 (Hito 2)

Sistema Inteligente de Gestión Operativa: supervisión reactiva de patrullaje policial en tiempo real.
En este sprint se agregó la **app móvil para carabineros en terreno** y se completó la **consola web** de mando.

---

## 🧩 Componentes

| Carpeta | Descripción | Tecnología |
| :--- | :--- | :--- |
| `Proyecto/sigo-app` | App móvil del funcionario en terreno | React Native (Expo) |
| `Proyecto/sigo-api` | Servidor que conecta app, consola y base de datos | Node.js + Express + TypeScript |
| `Proyecto/frontend` | Consola web del supervisor | Angular 18 + Google Maps |
| Base de datos | Datos, zonas y alertas con mapas | Supabase (PostgreSQL + PostGIS) |

---

## ✅ Historias de Usuario del Sprint

| HU | Nombre | Pts |
| :--- | :--- | :---: |
| HU07 | Alertas de desvío de ruta | 5 |
| HU09 | Control de acceso y roles | 5 |
| HU13 | Inicio de sesión del funcionario en la app | 5 |
| HU14 | Seguimiento de ubicación GPS (telemetría) | 8 |
| HU15 | Botón de pánico SOS y solicitud de refuerzos | 8 |
| HU16 | Envío de fotos y evidencias desde terreno | 5 |
| HU17 | Mensajes y notas de voz en tiempo real | 5 |
| HU18 | Envío manual a zonas y fin de ronda inmediato | 5 |
| HU19 | Registro de vehículo y tripulación | 3 |

**Total: 49 puntos**

---

## 🚀 Qué se puede hacer ahora

**App móvil (carabinero)**
- Iniciar sesión y registrar su vehículo y compañeros.
- Enviar su ubicación en vivo y ver su zona asignada.
- Presionar **SOS** y pedir refuerzos.
- Enviar fotos, evidencias, mensajes y notas de voz.
- Finalizar la ronda al terminar el patrullaje.

**Consola web (supervisor)**
- Ver el mapa con zonas de riesgo y unidades activas en tiempo real.
- Asignación automática de zonas cada 30 segundos o envío manual de una unidad.
- Recibir alertas de SOS y de desvío de ruta, y marcarlas como resueltas.
- Revisar evidencias y mensajes, y administrar usuarios.
- Cambiar tema (claro/oscuro) y sonidos de alerta.

---

## 🛠️ Cómo ejecutar

Requisitos: Node.js 18+ y npm. Copiar cada `.env.example` a `.env` con las claves de Supabase y Google Maps.

```bash
# 1. Servidor (puerto 3000)
cd Proyecto/sigo-api
npm install
npm run dev

# 2. Consola web (http://localhost:4200)
cd Proyecto/frontend
npm install
npm start

# 3. App móvil (escanear el QR con Expo Go)
cd Proyecto/sigo-app
npm install --legacy-peer-deps
npx expo start --tunnel
```

> La app móvil necesita que `EXPO_PUBLIC_API_URL` (archivo `sigo-app/.env.local`) apunte a la dirección del servidor.

---

## 📂 Estructura

```text
├── Documentos Informacion/    # Informes y planes del proyecto
├── Proyecto/
│   ├── sigo-app/              # App móvil
│   ├── sigo-api/              # Servidor y scripts SQL (database/)
│   └── frontend/              # Consola web
└── README.md
```
