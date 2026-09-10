# S.I.G.O — Dashboard Web Frontend (Angular 18+)

Sistema Inteligente de Gestión Operativa — Consola de Mando para Supervisores

## Descripción

Desarrollo del **Frontend Web (Dashboard)** completo del sistema S.I.G.O usando **Angular 18+** con integración de **Google Maps JavaScript API (v3.64)**, consumiendo la API REST del backend Node.js y comunicándose en tiempo real via **MQTT sobre WebSockets**. Todo ubicado en `Proyecto de titulo/proyecto/dashboard-web/`.

---

## User Review Required

> [!IMPORTANT]
> Se necesita una **Google Maps API Key** válida para renderizar los mapas. Por ahora se usará un placeholder `YOUR_GOOGLE_MAPS_API_KEY` en el `environment.ts`. Deberás reemplazarla con tu clave real antes de correr la app.

> [!IMPORTANT]
> Se necesita la URL de tu proyecto **Supabase** y la `ANON_KEY` para conectar con la base de datos. Se usarán placeholders en `environment.ts`.

> [!WARNING]
> Este plan cubre el **Frontend Web completo** (Angular 18). El backend Node.js y la App Móvil (React Native) son proyectos separados que quedan fuera del alcance de esta entrega.

---

## Open Questions

> [!NOTE]
> ¿Tienes ya una Google Maps API Key disponible? Si no, el mapa se renderizará con un placeholder visual hasta que la obtengas.

> [!NOTE]
> ¿Ya tienes el proyecto Supabase creado con las tablas? Se asume que sí, ya que el script SQL fue el que se proporcionó.

---

## Proposed Changes

### Bootstrap del proyecto Angular

#### [NEW] `Proyecto de titulo/proyecto/dashboard-web/` (Angular 18 workspace)

Creado via `npx @angular/cli@18 new dashboard-web`. Configurado con:
- **Routing**: habilitado
- **Styles**: SCSS
- **SSR**: deshabilitado (SPA pura)

---

### Core Module — Servicios y Modelos

#### [NEW] `src/app/core/models/index.ts`
Interfaces TypeScript que mapean exactamente el esquema PostGIS:
- `Usuario`, `SesionOperativa`, `TripulacionSesion`
- `EventoHotspot`, `TelemetriaActiva`
- `AsignacionTactica`, `RegistroEvidencia`, `AlertaEmergencia`
- Enums: `EstadoOperativo`, `EstadoMision`, `TipoEvidencia`, `OrigenAsignacion`

#### [NEW] `src/app/core/services/auth.service.ts`
- Login/logout con RUT + password contra Supabase Auth
- Manejo de JWT, refresh token
- Persistencia en localStorage

#### [NEW] `src/app/core/services/api.service.ts`
- HttpClient wrapper con interceptor de autenticación
- Métodos CRUD para todas las entidades del esquema
- Override manual de unidades (MANUAL_SUPERVISOR)
- Revisión de evidencias (bandeja de reportes)

#### [NEW] `src/app/core/services/supabase.service.ts`
- Inicialización del cliente Supabase
- Realtime subscriptions (Postgres Changes) para telemetría y alertas

#### [NEW] `src/app/core/services/mqtt.service.ts`
- Conexión MQTT sobre WebSockets (MQTT.js via CDN o npm)
- Suscripción a topic `sigo/telemetria/{imei}` para recibir coordenadas GPS en tiempo real
- Emite eventos al MapService

#### [NEW] `src/app/core/services/map.service.ts`
- Carga dinámica de Google Maps JS API
- Gestión de capas: heatmap, markers SIMcards, polígonos hotspots
- Toggle de capas por tipo
- Renderizado de geocercas de asignaciones

#### [NEW] `src/app/core/guards/auth.guard.ts`
- Redirige a `/login` si no hay sesión activa

#### [NEW] `src/app/core/interceptors/auth.interceptor.ts`
- Inyecta Bearer token en todos los requests HTTP

---

### Feature: Autenticación

#### [NEW] `src/app/features/auth/login/login.component.ts`
- Formulario RUT + contraseña con validación reactiva
- Formato RUT chileno (XX.XXX.XXX-X)
- Feedback visual de error/carga
- Redirige al dashboard tras autenticación exitosa

---

### Feature: Dashboard Principal (Mapa)

#### [NEW] `src/app/features/dashboard/dashboard.component.ts`
La vista principal de la Consola de Mando. Contiene:

**Mapa Central (Google Maps):**
- Mapa dark mode (styled map) centrado en la ciudad operacional
- **Capa Mapa de Calor**: renderiza `eventos_hotspots` como heatmap con `google.maps.visualization.HeatmapLayer`
- **Capa SIMcards Activas**: markers animados por estado (color según `estado_operativo`)
- **Capa Polígonos Asignación**: muestra geocercas de `asignaciones_tacticas`
- **Toggle Panel**: botones para encender/apagar cada capa independientemente

**Panel Lateral Derecho:**
- Lista en tiempo real de unidades activas con badge de estado
- Click en unidad → centra mapa y muestra detalle (tripulación, vehículo, misión actual)
- **Override Manual**: formulario para seleccionar unidad y enviar coordenadas (estado `MANUAL_SUPERVISOR`)

**Barra Superior:**
- Contador de unidades por estado (DISPONIBLE, EN_RUTA, PATRULLANDO, EMERGENCIA)
- Botón de notificaciones (alertas SOS activas)
- Info del supervisor logueado

**Panel de Alertas SOS:**
- Badge rojo pulsante en el mapa para cada `alertas_emergencia` con estado `ACTIVA`
- Drawer lateral con detalle de la emergencia y unidades respondiendo

---

### Feature: Bandeja de Reportes

#### [NEW] `src/app/features/reports/reports.component.ts`
- Lista de `registro_evidencias` con `tipo_evidencia = 'JUSTIFICACION_ATRASO'`
- Cards con foto (Supabase Storage URL), descripción textual, funcionario y timestamp
- Filtros por estado de misión y rango de fechas
- Vista de detalle con imagen ampliada y datos de la asignación táctica

---

### Feature: Gestión de Unidades

#### [NEW] `src/app/features/units/units.component.ts`
- Tabla completa de `sesiones_operativas` activas e históricas
- Detalle de tripulación (`tripulacion_sesion`)
- Timeline de estados de cada sesión
- Exportación de historial

---

### Shared Components

#### [NEW] `src/app/shared/components/`
- `status-badge/`: Badge de color según `estado_operativo`
- `unit-card/`: Card reutilizable para mostrar unidad
- `map-toggle-panel/`: Panel de toggles de capas del mapa
- `alert-drawer/`: Drawer deslizante para alertas SOS
- `evidence-viewer/`: Visor de evidencias fotográficas
- `rut-input/`: Input con formato de RUT chileno

---

### Estilos y Diseño

**Paleta de colores (dark mode operacional):**
- Background: `#0a0e1a` (navy profundo)
- Surface: `#111827` (gris oscuro)
- Accent: `#00d4ff` (cian eléctrico — tecnológico)
- Warning: `#f59e0b` (ámbar)
- Danger: `#ef4444` (rojo alerta)
- Success: `#10b981` (verde disponible)

**Estados visuales de unidades:**
| Estado | Color |
|--------|-------|
| DISPONIBLE | 🟢 `#10b981` |
| EN_RUTA_HOTSPOT | 🔵 `#3b82f6` |
| PATRULLANDO_ZONA | 🟡 `#f59e0b` |
| OCUPADO_EMERGENCIA | 🔴 `#ef4444` pulsante |
| INACTIVO | ⚫ `#6b7280` |

**Google Maps**: tema dark custom para integrar con la UI

---

### Environments

#### [NEW] `src/environments/environment.ts`
```typescript
export const environment = {
  production: false,
  supabaseUrl: 'YOUR_SUPABASE_URL',
  supabaseKey: 'YOUR_SUPABASE_ANON_KEY',
  googleMapsApiKey: 'YOUR_GOOGLE_MAPS_API_KEY',
  apiBaseUrl: 'http://localhost:3000/api',
  mqttBrokerUrl: 'ws://localhost:9001'
};
```

---

## Verification Plan

### Comandos
```bash
cd "Proyecto de titulo/proyecto/dashboard-web"
npm install
ng serve
# → http://localhost:4200
```

### Manual Verification
1. La pantalla de login renderiza con el formulario RUT + contraseña
2. El dashboard muestra el mapa dark con controles de capas
3. El toggle de heatmap activa/desactiva la capa visual
4. El panel lateral lista las unidades con sus badges de estado correctos
5. Las alertas SOS muestran badge pulsante rojo en el mapa
6. La bandeja de reportes muestra las justificaciones con foto

### Build de producción
```bash
ng build --configuration=production
```
