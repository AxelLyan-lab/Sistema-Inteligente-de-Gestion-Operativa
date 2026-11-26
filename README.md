# S.I.G.O. — Sprint 2 (Hito 2)

**S.I.G.O.** es una plataforma integral de comando, control, despacho inteligente y supervisión táctica en tiempo real para patrullaje preventivo y respuesta reactiva ante emergencias (**SOS**), desarrollada para **Carabineros de Chile** (con entorno de demostración centralizado en **Viña del Mar**, escalable al modelo nacional del **Plan Cuadrante de Seguridad Preventiva**).

El ecosistema integra en tiempo real una **Consola Web de Mando y Control** (Angular 18), una **Aplicación Móvil Android Nativa** para funcionarios en terreno (React Native / Expo + Servicio Nativo en Segundo Plano Kotlin), un **Motor Táctico Backend 24/7** (Node.js + Express + TypeScript), persistencia geoespacial (**PostgreSQL + PostGIS** en Supabase) y una **Landing Page Interactiva 3D** (React 18 + Vite + Framer Motion).

---

## 🌐 Enlaces en Vivo (Google Cloud Run)

| Servicio | Descripción | URL en Producción |
| :--- | :--- | :--- |
| **Consola Web (`sigo-cl`)** | Dashboard Táctico del Operador / Supervisor | [https://sigo-cl-243815551696.southamerica-west1.run.app](https://sigo-cl-243815551696.southamerica-west1.run.app) |
| **Landing Page (`landingpage-sigo-cl`)** | Sitio Oficial Presentación 3D + Descarga directa APK | [https://landingpage-sigo-cl-243815551696.southamerica-west1.run.app](https://landingpage-sigo-cl-243815551696.southamerica-west1.run.app) |
| **API Backend (`sigo-api`)** | Motor Táctico 24/7 y API REST Geoespacial | [https://sigo-api-243815551696.southamerica-west1.run.app](https://sigo-api-243815551696.southamerica-west1.run.app) |
| **Instalador Android (`SIGO.apk`)** | APK Release firmado listo para instalar en Android | Disponible en la raíz del repositorio (`./SIGO.apk`) y en la Landing Page |

---

## 🧠 Pilares Tecnológicos y Operativos

### 1. Tres Modos de Operación Táctica
1. **Modo Manual:** Control humano directo idéntico a la doctrina clásica de despacho, pero con recepción inmediata de la zona asignada en la App Móvil del funcionario en terreno.
2. **Modo Automático:** Rotación cíclica configurable (15 min a 2 horas, o ciclos cortos de demostración) y asignación automática de patrullas a los cuadrantes críticos activos según proximidad y compatibilidad de riesgo.
3. **Modo Auto Optimizado (Algoritmo Core U.V.E.):** Evalúa al segundo el déficit o superávit de vigilancia en cada zona activa, reasigna recursos para evitar subcobertura o sobrecobertura y diagnostica exactamente qué unidades faltan cuando la dotación en terreno es insuficiente (tolerancia de activación con déficit $\le 0.45\text{ U.V.E.}$).

---

### 2. Ponderación Matemática U.V.E. (Unidad de Vigilancia Equivalente)

Cada medio de transporte y conformación de tripulación aporta un peso matemático exacto para cubrir la demanda de vigilancia de cada cuadrante:

| Código | Medio / Unidad Policial | Dotación | Valor U.V.E. |
| :---: | :--- | :---: | :---: |
| **FZ** | Furgón Policial (Z) | 2 o más efectivos | **1.00 U.V.E.** |
| **RPT** | Radiopatrulla Tripulación Completa | 3 tripulantes (Conductor + 2 acompañantes) | **1.00 U.V.E.** |
| **RPD** | Radiopatrulla Estándar | 1 o 2 tripulantes (Conductor + 0 o 1 acompañante) | **0.80 U.V.E.** |
| **MTT** | Motocicleta Todoterreno | 1 motorista | **0.45 U.V.E.** |
| **CB** | Carabinero en Bicicleta | 1 ciclista | **0.30 U.V.E.** |
| **INF** | Infantería / Patrullaje a Pie | 1 infante | **0.20 U.V.E.** |

---

### 3. Clasificación de Delitos por Puntaje y Nivel de Riesgo de Zona

S.I.G.O. pondera la gravedad de cada hecho delictual registrado dentro del radio del cuadrante para determinar su **Score de Gravedad** y su demanda de cobertura:

#### Escala de Puntos por Delito
* **+50 pts (Crítico):** Arma de fuego, homicidio, hechos de máxima gravedad.
* **+20 pts (Grave contra las Personas):** Robo con violencia, robo con intimidación, agresiones graves.
* **+10 pts (Grave contra la Propiedad):** Portonazo, robo de vehículo, robo en lugar habitado.
* **+5 pts (Delito Medio):** Lanzazo, robo por sorpresa, receptación.
* **+2 pts (Falta / Riesgo Bajo):** Hurto simple, daños menores.
* **+1 pt (Incivilidad):** Consumo de alcohol en vía pública, ruidos molestos, desórdenes.

#### Niveles de Riesgo Resultantes y Reglas de Asignación
* 🔴 **Riesgo ALTO (`> 80 puntos`):** Demanda **1.00 U.V.E.** (1 `FZ`, 1 `RPT` de 3 tripulantes, o combo `RPD 0.80 + MTT 0.45 = 1.25 U.V.E.`). *Prohibido despachar Bicicletas (`CB`) o Infantería (`INF`) por seguridad del personal.*
* 🟠 **Riesgo MEDIO (`40 a 80 puntos`):** Demanda **0.45 a 0.80 U.V.E.** (`RPD` de 1-2 tripulantes o Moto `MTT`).
* 🟢 **Riesgo BAJO (`< 40 puntos`):** Demanda **0.20 a 0.30 U.V.E.** (Bicicleta `CB` o Infantería `INF`), reservando los vehículos motorizados mayores para zonas de prioridad Media y Alta.

---

### 4. Protocolo de Emergencias SOS y Dotación de Refuerzo
* **Meta U.V.E. Configurable:** El supervisor define en Ajustes la cuota de refuerzo para emergencias SOS (de `0.80` a `4.00 U.V.E.`, ej. `2.45 U.V.E.`).
* **Despacho Algorítmico por Menor ETA:** Al activarse un botón de pánico SOS desde terreno, el motor convoca automáticamente a las unidades más cercanas hasta cubrir la meta U.V.E.
* **Doctrina de Respuesta SOS:**
  * ✅ **Quiénes acuden al llamado SOS:** Exclusivamente unidades motorizadas (**Furgones Z `FZ`**, **Radiopatrullas `RPT`/`RPD`** y **Motocicletas `MTT`**).
  * 🚫 **Infantería y Bicicleta:** Los **infantes (`INF`)** y **bicicletas (`CB`)** **no acuden** a cubrir emergencias SOS ajenas, pero **sí pueden emitir alertas SOS** para recibir rescate motorizado inmediato.

---

### 5. Control Evidenciado por Falta o Atraso y Bloqueo de Cierre de Sesión
* **Cronómetro ETA Sincronizado:** Cuando el algoritmo o el operador envían una unidad a una zona, corre en tiempo real el tiempo límite de traslado configurado (`tiempo_llegada_min`) tanto en la consola web como en la App Móvil. Al entrar al perímetro GPS (geocerca), la unidad pasa automáticamente a estado **En Zona (Patrullando)**.
* **Justificación en Panel de Evidencias:** Si la unidad no arriba dentro del tiempo límite, se registra el atraso sobre ese destino. El funcionario puede ingresar al **Panel de Evidencias** para registrar una descripción y fotografía opcional explicando el motivo del retraso o inasistencia.
* **Bloqueo Obligatorio al Cerrar Sesión:** Si el funcionario acumuló retrasos durante su turno y no subió la evidencia correspondiente, **el sistema bloquea el cierre de sesión** e impide finalizar el turno hasta que describa obligatoriamente por qué no llegó o se atrasó al/los destinos asignados (con opción de adjuntar fotografía de respaldo).

---

### 6. Telemetría y Notificaciones Nativas 24/7 en Segundo Plano (Android)
* Servicio nativo Android (`SigoBackgroundService.kt`) con `START_STICKY` y `stopWithTask="false"`:
  * Continúa transmitiendo coordenadas GPS reales a la consola central aunque el funcionario bloquee la pantalla o cierre la aplicación de la lista de recientes.
  * Mantiene polling activo en segundo plano para emitir **notificaciones del sistema con sonido y vibración** ante nuevas zonas asignadas, mensajes o notas de voz de la central y alertas SOS, deteniéndose únicamente cuando el funcionario cierra su sesión operativa.

---

## 📂 Estructura del Proyecto

```text
├── Proyecto/
│   ├── frontend/                # Consola Web de Mando y Control (Angular 18 + TailwindCSS + Google Maps)
│   │   ├── src/app/core/        # Servicios (MapService, ApiService, SettingsService, UVE Engine)
│   │   ├── src/app/features/    # Vistas: Mapa Táctico, Unidades, Mensajes, Evidencias, Zonas, Usuarios, Ajustes
│   │   ├── scripts/             # Generador de variables de entorno (set-env.js)
│   │   └── Dockerfile           # Contenedor Nginx para despliegue en Cloud Run
│   │
│   ├── sigo-api/                # Backend API REST y Motor Táctico 24/7 (Node.js + Express + TypeScript)
│   │   ├── src/controllers/     # Controladores de misiones, patrullas, sesiones, SOS, evidencias y auth
│   │   ├── src/routes/          # Rutas REST (/api/v1/tactico, /patrol, /missions, /sesiones, /users)
│   │   ├── src/utils/           # Motor Táctico 24/7 (tacticalEngine.ts), cálculo U.V.E. y geocercas
│   │   ├── database/            # Scripts SQL y esquema PostGIS
│   │   └── Dockerfile           # Contenedor Node.js para despliegue en Cloud Run
│   │
│   ├── sigo-app/                # Aplicación Móvil Android para Patrullas (React Native / Expo + Kotlin)
│   │   ├── src/screens/         # Login, HomeScreen (Mapa + SOS), EvidenceScreen, MessagesScreen, ProfileScreen
│   │   ├── src/services/        # Cliente API, telemetría GPS, evidencias y puente nativo de segundo plano
│   │   └── android/             # Proyecto nativo Android con SigoBackgroundService.kt (GPS + Push 24/7)
│   │
│   └── sigo-landing/            # Landing Page Promocional 3D (React 18 + Vite + Tailwind + Framer Motion)
│       ├── src/components/      # Mockups 3D interactivos, comparativa SAIT vs S.I.G.O., tabla U.V.E. y galería
│       └── Dockerfile           # Contenedor Nginx para despliegue en Cloud Run
│
├── SIGO.apk                     # Instalador Android compilado (Release APK)
├── deploy-gcp.ps1               # Script automatizado de despliegue a Google Cloud Run
└── README.md
```

---

## 🛠️ Instalación y Ejecución Local

### Prerrequisitos
* **Node.js**: v18 o v20+
* **npm**: v9+
* **Base de Datos**: Proyecto en **Supabase** con extensión `postgis` habilitada.
* **Google Maps API Key**: Habilitada para Maps JavaScript API y Maps SDK for Android.

### 1. Backend (`Proyecto/sigo-api`)
```bash
cd Proyecto/sigo-api
npm install
cp .env.example .env   # Configurar SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, JWT_SECRET y GOOGLE_MAPS_API_KEY
npm run dev
```
El servidor backend y el Motor Táctico 24/7 iniciarán en `http://localhost:3000`.

### 2. Consola Web del Operador (`Proyecto/frontend`)
```bash
cd Proyecto/frontend
npm install
cp .env.example .env   # Configurar SUPABASE_URL, SUPABASE_KEY, GOOGLE_MAPS_API_KEY y API_BASE_URL
npm start
```
La consola web estará disponible en `http://localhost:4200`.

### 3. Aplicación Móvil Android (`Proyecto/sigo-app`)
```bash
cd Proyecto/sigo-app
npm install --legacy-peer-deps
npx expo start
```
Para generar el APK nativo con el servicio 24/7 en segundo plano:
```bash
cd Proyecto/sigo-app/android
./gradlew assembleRelease
```

### 4. Landing Page (`Proyecto/sigo-landing`)
```bash
cd Proyecto/sigo-landing
npm install
npm run dev
```

---

## 👤 Autor

* **Axel Lyan Sepúlveda Muñoz** — Ingeniería / Proyecto de Título
* Contacto: `a.seplvedamuoz@gmail.com`
