/**
 * Sincroniza data.json local com Upstash Redis.
 *
 * Requer as variáveis de ambiente:
 *   KV_REST_API_URL
 *   KV_REST_API_TOKEN
 *
 * Uso: npm run sync
 */
const fs = require('fs');
const path = require('path');

if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) {
  console.error('❌ KV_REST_API_URL e KV_REST_API_TOKEN não estão definidos.');
  console.error('   Exporte no shell ou crie um arquivo .env (copie .env.example).');
  process.exit(1);
}

// Carrega .env se existir (best-effort, sem dependência)
try {
  const envFile = path.join(__dirname, '..', '.env');
  if (fs.existsSync(envFile)) {
    for (const line of fs.readFileSync(envFile, 'utf8').split(/\r?\n/)) {
      const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/i);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  }
} catch {}

const { Redis } = require('@upstash/redis');
const redis = Redis.fromEnv();

const DATA = path.join(__dirname, '..', 'data.json');

(async () => {
  if (!fs.existsSync(DATA)) {
    console.error(`❌ ${DATA} não encontrado. Rode 'npm run seed' antes.`);
    process.exit(1);
  }

  const { cars = [], nextId = 1 } = JSON.parse(fs.readFileSync(DATA, 'utf8'));
  console.log(`📦 Subindo ${cars.length} carros pro Upstash...`);

  let totalBombas = 0;
  let totalBons = 0;
  let i = 0;

  for (const car of cars) {
    const id = car.id;
    const carUrl = car.url;
    const ops = [
      redis.set(`bc:car:${id}`, car),
      redis.sadd('bc:cars', id),
      redis.set(`bc:url:${Buffer.from(carUrl).toString('base64url')}`, id),
    ];
    if (car.votes_bomba > 0) {
      ops.push(redis.zadd('bc:rank:bomba', { score: car.votes_bomba, member: id }));
    }
    if (car.votes_bom > 0) {
      ops.push(redis.zadd('bc:rank:bom', { score: car.votes_bom, member: id }));
    }
    await Promise.all(ops);

    totalBombas += car.votes_bomba || 0;
    totalBons += car.votes_bom || 0;
    i++;
    if (i % 10 === 0) process.stdout.write(`  ${i}/${cars.length}\r`);
  }

  await Promise.all([
    redis.set('bc:nextId', nextId),
    redis.set('bc:total:bombas', totalBombas),
    redis.set('bc:total:bons', totalBons),
  ]);

  console.log(`\n✅ ${cars.length} carros sincronizados.`);
  console.log(`   nextId: ${nextId}`);
  console.log(`   votos: ${totalBombas} bombas | ${totalBons} bons`);
})().catch((e) => {
  console.error('FATAL:', e);
  process.exit(1);
});
