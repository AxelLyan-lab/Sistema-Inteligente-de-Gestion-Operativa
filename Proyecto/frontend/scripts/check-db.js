require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const ws = require('ws');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Faltan credenciales en .env");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false },
  realtime: { transport: ws }
});

async function checkDb() {
  console.log("=== REVISANDO TABLA 'usuarios' ===");
  const { data: usuarios, error: errUsuarios } = await supabase.from('usuarios').select('*');
  if (errUsuarios) {
    console.error("Error al consultar usuarios:", errUsuarios);
  } else {
    console.log("Usuarios en BD:");
    console.table(usuarios);
  }

  // Intentamos iniciar sesión con la combinación rut_limpio para ver qué error da exactamente
  console.log("\n=== PRUEBA DE LOGIN (RUT: 12345678-9) ===");
  const { data: loginData1, error: loginErr1 } = await supabase.auth.signInWithPassword({
    email: '12345678-9@sigo.internal',
    password: 'demo123'
  });
  console.log("Login sin puntos:", loginErr1 ? loginErr1.message : "¡ÉXITO!");

  console.log("\n=== PRUEBA DE LOGIN (RUT: 12.345.678-9) ===");
  const { data: loginData2, error: loginErr2 } = await supabase.auth.signInWithPassword({
    email: '12.345.678-9@sigo.internal',
    password: 'demo123'
  });
  console.log("Login con puntos:", loginErr2 ? loginErr2.message : "¡ÉXITO!");
}

checkDb();
