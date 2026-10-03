// Genera la configuración pública de la web a partir de variables de entorno.
// Uso: SUPABASE_URL=... SUPABASE_PUBLISHABLE_KEY=... node configure.cjs
const fs = require('node:fs');
const path = require('node:path');

const url = (process.env.SUPABASE_URL || '').trim();
const key = (process.env.SUPABASE_PUBLISHABLE_KEY || '').trim();

function isPublicKey(value) {
  if (value.startsWith('sb_publishable_')) return true;
  // Compatibilidad con la clave anon antigua, que es un JWT con role=anon.
  const payload = value.split('.')[1];
  if (!payload) return false;
  try {
    return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')).role === 'anon';
  } catch {
    return false;
  }
}

if (!/^https:\/\/[a-z0-9.-]+\.supabase\.co\/?$/i.test(url) || !isPublicKey(key)) {
  console.error('Faltan SUPABASE_URL y una SUPABASE_PUBLISHABLE_KEY válida. No uses tokens sbp_ ni claves privadas.');
  process.exitCode = 1;
} else {
  const config = `window.PTJ_CONFIG = ${JSON.stringify({ supabaseUrl: url.replace(/\/$/, ''), supabasePublishableKey: key }, null, 2)};\n`;
  fs.writeFileSync(path.join(__dirname, 'config.js'), config, 'utf8');
  console.log('config.js actualizado con los datos públicos de Supabase.');
}
