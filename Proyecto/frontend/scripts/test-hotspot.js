require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const ws = require('ws');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, {
  auth: { persistSession: false },
  realtime: { transport: ws }
});
async function test() {
  const { data, error } = await supabase.from('eventos_hotspots').select('*').limit(1);
  if (error) console.error(error);
  else {
    const hex = data[0].geom_delito;
    console.log("EWKB HEX:", hex);
    
    if (typeof hex === 'string' && hex.length >= 50) {
      const buffer = new Uint8Array(hex.match(/[\da-f]{2}/gi).map(h => parseInt(h, 16)));
      const view = new DataView(buffer.buffer);
      const isLittleEndian = buffer[0] === 1;
      const lng = view.getFloat64(9, isLittleEndian);
      const lat = view.getFloat64(17, isLittleEndian);
      console.log(`Parsed: Lng=${lng}, Lat=${lat}`);
    }
  }
}
test();
