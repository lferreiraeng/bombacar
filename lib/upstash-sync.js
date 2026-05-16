/**
 * Sync incremental: empurra UM carro novo pro Upstash.
 * Usado pelo crawl.js a cada carro inserido.
 */
const fs = require('fs');
const path = require('path');

// Carrega .env (se existir) antes de checar credenciais
try {
  const envFile = path.join(__dirname, '..', '.env');
  if (fs.existsSync(envFile)) {
    for (const line of fs.readFileSync(envFile, 'utf8').split(/\r?\n/)) {
      const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/i);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  }
} catch {}

let _redis = null;
function getRedis() {
  if (_redis) return _redis;
  if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) return null;
  const { Redis } = require('@upstash/redis');
  _redis = Redis.fromEnv();
  return _redis;
}

async function syncCar(car) {
  const r = getRedis();
  if (!r) return false;
  await Promise.all([
    r.set(`bc:car:${car.id}`, car),
    r.sadd('bc:cars', car.id),
    r.set(`bc:url:${Buffer.from(car.url).toString('base64url')}`, car.id),
  ]);
  const current = Number(await r.get('bc:nextId')) || 0;
  if (car.id + 1 > current) await r.set('bc:nextId', car.id + 1);
  return true;
}

function isConfigured() {
  return !!getRedis();
}

module.exports = { syncCar, isConfigured };
