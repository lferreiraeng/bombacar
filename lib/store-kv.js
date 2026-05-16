/**
 * Store driver: Upstash Redis (compatível com Vercel KV).
 * Ativado quando KV_REST_API_URL e KV_REST_API_TOKEN estão presentes.
 */
const { Redis } = require('@upstash/redis');

const redis = Redis.fromEnv();

const K = {
  cars: 'bc:cars',
  car: (id) => `bc:car:${id}`,
  nextId: 'bc:nextId',
  urlIdx: (u) => `bc:url:${Buffer.from(u).toString('base64url')}`,
  rankBomba: 'bc:rank:bomba',
  rankBom: 'bc:rank:bom',
  totalBombas: 'bc:total:bombas',
  totalBons: 'bc:total:bons',
};

async function readCarById(id) {
  const c = await redis.get(K.car(id));
  return c || null;
}

module.exports = {
  async listCars() {
    const ids = await redis.smembers(K.cars);
    if (!ids.length) return [];
    const cars = await Promise.all(ids.map(readCarById));
    return cars.filter(Boolean);
  },

  async findByUrl(url) {
    const id = await redis.get(K.urlIdx(url));
    if (id == null) return null;
    return readCarById(id);
  },

  async findById(id) {
    return readCarById(id);
  },

  async insertCar(data) {
    const id = await redis.incr(K.nextId);
    const car = {
      id,
      url: data.url,
      title: data.title,
      image: data.image,
      images: data.images || [],
      price: data.price,
      description: data.description,
      source: data.source,
      properties: data.properties || [],
      votes_bomba: 0,
      votes_bom: 0,
      created_at: new Date().toISOString(),
    };
    await Promise.all([
      redis.set(K.car(id), car),
      redis.sadd(K.cars, id),
      redis.set(K.urlIdx(car.url), id),
    ]);
    return car;
  },

  async randomCar(excludeIds = []) {
    const ids = await redis.smembers(K.cars);
    const ex = new Set(excludeIds.map(String));
    const pool = ids.filter((id) => !ex.has(String(id)));
    if (!pool.length) return null;
    const id = pool[Math.floor(Math.random() * pool.length)];
    return readCarById(id);
  },

  async addVote(id, type) {
    const car = await readCarById(id);
    if (!car) return null;

    const rankKey = type === 'bomba' ? K.rankBomba : type === 'bom' ? K.rankBom : null;
    const totalKey = type === 'bomba' ? K.totalBombas : type === 'bom' ? K.totalBons : null;
    if (!rankKey) return null;

    if (type === 'bomba') car.votes_bomba += 1;
    else car.votes_bom += 1;

    await Promise.all([
      redis.set(K.car(id), car),
      redis.zincrby(rankKey, 1, id),
      redis.incr(totalKey),
    ]);
    return car;
  },

  async ranking(type, limit = 5) {
    const key = type === 'bomba' ? K.rankBomba : K.rankBom;
    // Upstash retorna [{member,score}, ...] OU array intercalado dependendo da versão
    const raw = await redis.zrange(key, 0, limit - 1, { rev: true, withScores: true });
    const ids = [];
    if (Array.isArray(raw)) {
      for (let i = 0; i < raw.length; i += 2) ids.push(raw[i]);
    }
    if (!ids.length) return [];
    const cars = (await Promise.all(ids.map(readCarById))).filter(Boolean);
    return cars.map((c) => ({
      id: c.id,
      title: c.title,
      image: c.image,
      price: c.price,
      votes_bomba: c.votes_bomba,
      votes_bom: c.votes_bom,
    }));
  },

  async stats() {
    const [total, bombas, bons] = await Promise.all([
      redis.scard(K.cars),
      redis.get(K.totalBombas),
      redis.get(K.totalBons),
    ]);
    return {
      total: total || 0,
      bombas: Number(bombas || 0),
      bons: Number(bons || 0),
    };
  },

  isReadOnly: false,
};
