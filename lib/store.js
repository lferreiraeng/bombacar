/**
 * Driver selector. Usa Upstash Redis se qualquer das vars padrão estiver presente,
 * caso contrário cai pra arquivo local (data.json).
 *
 * Aceita ambos os esquemas de nome:
 *   - KV_REST_API_URL / KV_REST_API_TOKEN          (Vercel KV)
 *   - UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN  (Upstash padrão)
 */

// Normaliza pra o que o cliente @upstash/redis usa por default
if (!process.env.KV_REST_API_URL && process.env.UPSTASH_REDIS_REST_URL) {
  process.env.KV_REST_API_URL = process.env.UPSTASH_REDIS_REST_URL;
}
if (!process.env.KV_REST_API_TOKEN && process.env.UPSTASH_REDIS_REST_TOKEN) {
  process.env.KV_REST_API_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
}

const useKV = !!(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);

if (useKV) {
  console.log('[store] driver: Upstash Redis (KV)');
  module.exports = require('./store-kv');
} else {
  console.log('[store] driver: arquivo local (data.json) — KV_REST_API_URL/TOKEN não definidos');
  module.exports = require('./store-file');
}
