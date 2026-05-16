/**
 * Driver selector. Usa Upstash Redis se as vars de ambiente estiverem presentes,
 * caso contrário cai pra arquivo local (data.json).
 */
const useKV = !!(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);

if (useKV) {
  console.log('[store] driver: Upstash Redis (KV)');
  module.exports = require('./store-kv');
} else {
  console.log('[store] driver: arquivo local (data.json)');
  module.exports = require('./store-file');
}
