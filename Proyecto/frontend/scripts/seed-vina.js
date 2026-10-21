require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const ws = require('ws');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, {
  auth: { persistSession: false },
  realtime: { transport: ws }
});

// Coordenadas aproximadas del centro de Viña del Mar (Alvarez - 15 Norte, Av Peru - Quillota)
const LAT_MIN = -33.0260; // Sur (Alvarez)
const LAT_MAX = -33.0075; // Norte (15 Norte)
const LNG_MIN = -71.5585; // Oeste (Av Peru)
const LNG_MAX = -71.5460; // Este (Quillota)

async function seedHotspots() {
  console.log("Limpiando hotspots antiguos...");
  await supabase.from('eventos_hotspots').delete().neq('id_evento', 0); // Borra todos

  console.log("Generando 500 puntos de calor en Viña del Mar (Centro)...");
  
  const puntos = [];
  const ahora = Date.now();
  
  for(let i = 0; i < 500; i++) {
    // Generación aleatoria dentro de la bounding box
    const lat = Math.random() * (LAT_MAX - LAT_MIN) + LAT_MIN;
    const lng = Math.random() * (LNG_MAX - LNG_MIN) + LNG_MIN;
    
    // Distribución en las últimas 24 horas
    const fecha = new Date(ahora - Math.random() * 24 * 3600000).toISOString();
    
    puntos.push({
      tipo_delito: 'ROBO',
      geom_delito: `POINT(${lng} ${lat})`,
      fecha_ocurrencia: fecha
    });
  }
  
  const { error } = await supabase.from('eventos_hotspots').insert(puntos);
  
  if (error) {
    console.error("Error insertando puntos:", error);
  } else {
    console.log("✅ 500 puntos insertados con éxito en la base de datos.");
  }
}

seedHotspots();
