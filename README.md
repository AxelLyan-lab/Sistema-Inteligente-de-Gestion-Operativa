# S.I.G.O. — Sistema Inteligente de Gestión Operativa

Sistema inteligente de gestión operativa y supervisión reactiva para patrullaje preventivo y auditoría táctica en tiempo real. Utiliza algoritmos geoespaciales, mapas de calor dinámicos y telemetría de baja latencia para optimizar la cobertura territorial y coordinar unidades en terreno.

---

## 📌 Arquitectura y Tecnologías

* **Frontend Web (Dashboard Supervisor)**: Angular 18 (Standalone Components, Signals, RxJS), TailwindCSS.
* **Cartografía & Visualización Espacial**: Google Maps JavaScript API, Marcadores avanzados (`AdvancedMarkerElement`), motor Canvas Overlay para renderizado dinámico de mapas de calor con compensación de radio por nivel de zoom.
* **Persistencia & Análisis Espacial**: PostgreSQL 15+ con extensión **PostGIS** e índices espaciales **GiST** en Supabase.
* **Tiempo Real**: Supabase Realtime (WebSockets) y protocolo de telemetría MQTT.
* **Gestión de Entorno**: Script de pre-build seguro (`set-env.js`) que inyecta variables desde `.env` hacia las configuraciones de Angular.

---

## 🚀 Estado del Desarrollo — Sprint 1

El proyecto cumple con los objetivos y tareas del **Sprint 1**:

1. **HU01: Gestión de Persistencia Espacial y Datos Tácticos**
   - Extensión PostGIS habilitada en PostgreSQL.
   - Tablas espaciales creadas: `eventos_hotspots`, `zonas_patrullaje`, `sesiones_operativas`, `telemetria_activa`, `alertas_emergencia`.
   - Índices espaciales GiST implementados para optimización de consultas geoespaciales.
   - Script de generación y seeding de puntos delictuales sintéticos en Viña del Mar.

2. **HU02: Visualización de Cartografía Base**
   - Integración dinámica de Google Maps JavaScript API.
   - Renderizado del Dashboard centrado en el área operativa de Viña del Mar con tema táctico oscuro.
   - Gestión de capas tácticas (Mapa de Calor, Unidades activas, Zonas de patrullaje).

3. **HU03: Renderizado de Mapas de Calor Dinámicos**
   - Consulta reactiva de puntos delictuales geoespaciales.
   - Capa de densidad dinámica con algoritmo de compensación de radio según el nivel de zoom.
   - Clasificación de zonas calientes según criticidad delictual (Riesgo Bajo, Medio, Alto).
   - Temporizador de rotación de cuadrantes calientes cada 30 segundos con countdown visible en el panel.

4. **Funcionalidades de Supervisión y Demo Táctica**
   - Despacho automático e inteligente de vehículos según nivel de riesgo (Patrullas a zonas de alto riesgo, Motos a riesgo medio, Bicicletas a riesgo bajo).
   - Máquina de estados táctica (`DISPONIBLE` → `EN_RUTA` → `PATRULLANDO`).
   - Panel de unidades activas, contadores globales en barra superior y sistema de alertas SOS en tiempo real.

---

## 📂 Estructura del Repositorio

```text
├── Documentos Informacion/
│   ├── Base de datos                 # Esquema relacional SQL y configuración PostGIS
│   ├── Informacion Proyecto           # Especificación técnica, objetivos y flujos del sistema
│   └── implementation_plan.md        # Plan de implementación táctico
├── Proyecto/
│   └── dashboard-web/                # Aplicación Frontend en Angular 18
│       ├── src/                      # Código fuente (Core, Features, Components, Store)
│       ├── scripts/                  # Scripts de utilidades (seed-vina.js, set-env.js, check-db.js)
│       ├── package.json              # Dependencias y scripts de npm
│       └── .env.example              # Plantilla de variables de entorno requeridas
└── README.md
```

---

## 🛠️ Instalación y Puesta en Marcha

### Prerrequisitos
* **Node.js**: v18 o superior
* **npm**: v9 o superior

### 1. Clonar el repositorio
```bash
git clone https://github.com/AxelLyan-lab/Sistema-Inteligente-de-Gestion-Operativa.git
cd Sistema-Inteligente-de-Gestion-Operativa/Proyecto/dashboard-web
```

### 2. Instalar dependencias
```bash
npm install
```

### 3. Configurar variables de entorno
Copia la plantilla `.env.example` como `.env`:
```bash
cp .env.example .env
```
Edita `.env` con tus credenciales:
```env
SUPABASE_URL=https://tu-proyecto.supabase.co
SUPABASE_ANON_KEY=tu-anon-key-de-supabase
GOOGLE_MAPS_API_KEY=tu-api-key-de-google-maps
```

### 4. Iniciar en modo desarrollo
```bash
npm start
```
La aplicación estará disponible en `http://localhost:4200`.
