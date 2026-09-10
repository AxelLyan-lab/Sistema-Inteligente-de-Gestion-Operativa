// ============================================================
// S.I.G.O. — set-env.js
// Script de pre-build: lee .env y genera environment.ts
// Uso: node scripts/set-env.js [--prod]
// ============================================================
'use strict';

const fs      = require('fs');
const path    = require('path');
const dotenv  = require('dotenv');
const colors  = {
  reset:  '\x1b[0m',
  green:  '\x1b[32m',
  yellow: '\x1b[33m',
  cyan:   '\x1b[36m',
  red:    '\x1b[31m',
};

// ── 1. Cargar .env ────────────────────────────────────────
const envPath = path.resolve(__dirname, '../.env');

if (!fs.existsSync(envPath)) {
  console.error(`${colors.red}[set-env] ERROR: No se encontró el archivo .env en:${colors.reset}`);
  console.error(`  ${envPath}`);
  console.error(`${colors.yellow}  → Copia .env.example como .env y completa tus credenciales.${colors.reset}`);
  process.exit(1);
}

dotenv.config({ path: envPath });
console.log(`${colors.cyan}[set-env] Leyendo credenciales desde .env...${colors.reset}`);

// ── 2. Extraer variables con validación ───────────────────
const isProd = process.argv.includes('--prod');

const supabaseUrl     = process.env['SUPABASE_URL']     || 'YOUR_SUPABASE_URL';
const supabaseKey     = process.env['SUPABASE_ANON_KEY'] || 'YOUR_SUPABASE_ANON_KEY';
const mapsApiKey      = process.env['GOOGLE_MAPS_API_KEY'] || 'YOUR_GOOGLE_MAPS_API_KEY';
const apiBaseUrl      = process.env['API_BASE_URL']     || 'http://localhost:3000/api';
const mqttBrokerUrl   = process.env['MQTT_BROKER_URL']  || 'wss://localhost:8084/mqtt';
const mapLat          = parseFloat(process.env['MAP_DEFAULT_LAT'] || '-33.4569');
const mapLng          = parseFloat(process.env['MAP_DEFAULT_LNG'] || '-70.6483');
const mapZoom         = parseInt(process.env['MAP_DEFAULT_ZOOM']  || '12', 10);

// Advertencias si siguen con placeholders
const warnings = [];
if (supabaseUrl.includes('YOUR_'))     warnings.push('SUPABASE_URL');
if (supabaseKey.includes('YOUR_'))     warnings.push('SUPABASE_ANON_KEY');
if (mapsApiKey.includes('YOUR_'))      warnings.push('GOOGLE_MAPS_API_KEY');

if (warnings.length > 0) {
  console.warn(`${colors.yellow}[set-env] ⚠️  Estas variables aún tienen valores placeholder:${colors.reset}`);
  warnings.forEach(w => console.warn(`  • ${w}`));
  console.warn(`${colors.yellow}  La app funcionará en modo demo hasta que las configures.${colors.reset}`);
}

// ── 3. Generar el contenido de environment.ts ─────────────
const envContent = `// ================================================================
// ARCHIVO GENERADO AUTOMÁTICAMENTE — NO EDITAR MANUALMENTE
// Ejecuta: node scripts/set-env.js
// Edita las credenciales en el archivo .env del proyecto
// ================================================================
export const environment = {
  production:       ${isProd},
  supabaseUrl:      '${supabaseUrl}',
  supabaseKey:      '${supabaseKey}',
  googleMapsApiKey: '${mapsApiKey}',
  apiBaseUrl:       '${apiBaseUrl}',
  mqttBrokerUrl:    '${mqttBrokerUrl}',
  mqttTopicPrefix:  'sigo',
  mapDefaultCenter: { lat: ${mapLat}, lng: ${mapLng} },
  mapDefaultZoom:   ${mapZoom},
  gpsThrottleMs:    500,
  heatmapWindowHrs: 24,
  heatmapMaxPoints: 5000,
};
`;

// ── 4. Escribir el archivo target ─────────────────────────
const targetFile = isProd
  ? path.resolve(__dirname, '../src/environments/environment.prod.ts')
  : path.resolve(__dirname, '../src/environments/environment.ts');

fs.writeFileSync(targetFile, envContent, { encoding: 'utf8' });

const fileName = path.basename(targetFile);
const icon = warnings.length === 0 ? '✅' : '⚠️ ';
console.log(`${colors.green}[set-env] ${icon} ${fileName} generado correctamente.${colors.reset}`);

if (warnings.length === 0) {
  console.log(`${colors.green}[set-env] Todas las credenciales configuradas — modo producción activo.${colors.reset}`);
}
