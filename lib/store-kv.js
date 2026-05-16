/**
 * Store driver: Upstash Redis.
 * Único source of truth: objeto do carro em bc:car:{id}.
 * Stats e ranking calculam por MGET sob demanda.
 */
const { Redis } = require('@upstash/redis');
const { aggregateByModel } = require('./model');

const redis = Redis.fromEnv();

const K = {
  cars: 'bc:cars',
  car: (id) => `bc:car:${id}`,
  nextId: 'bc:nextId',
  urlIdx: (u) => `bc:url:${Buffer.from(u).toString('base64url')}`,
  voted: (carId, voter) => `bc:voted:${carId}:${voter}`,
  pending: 'bc:pending',
};

async function readCarById(id) {
  if (id == null) return null;
  const c = await redis.get(K.car(id));
  return c || null;
}

async function readAllCars() {
  const ids = await redis.smembers(K.cars);
  if (!ids.length) return [];
  const cars = await redis.mget(...ids.map((id) => K.car(id)));
  return cars.filter(Boolean);
}

module.exports = {
  async listCars() {
    return readAllCars();
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

  async addVote(id, type, voter = null) {
    const car = await readCarById(id);
    if (!car) return null;
    if (!['bomba', 'bom'].includes(type)) return null;

    // 1 voto por IP por carro (TTL 30 dias)
    if (voter) {
      const set = await redis.set(K.voted(id, voter), 1, { nx: true, ex: 30 * 24 * 3600 });
      // Upstash retorna 'OK' se setou, null se já existia
      if (!set) return { ...car, alreadyVoted: true };
    }

    if (type === 'bomba') car.votes_bomba += 1;
    else car.votes_bom += 1;

    await redis.set(K.car(id), car);
    return car;
  },

  async ranking(type, limit = 999, opts = {}) {
    const cars = await readAllCars();
    return aggregateByModel(cars, type, limit, opts);
  },

  async stats() {
    const ids = await redis.smembers(K.cars);
    if (!ids.length) return { total: 0, bombas: 0, bons: 0, driver: 'kv' };
    const cars = await redis.mget(...ids.map((id) => K.car(id)));
    let bombas = 0;
    let bons = 0;
    for (const c of cars) {
      if (c) {
        bombas += c.votes_bomba || 0;
        bons += c.votes_bom || 0;
      }
    }
    return { total: ids.length, bombas, bons, driver: 'kv' };
  },

  // Fila de URLs pendentes (cadastradas pelo público; crawler local processa)
  async pushPending(url) {
    return redis.sadd(K.pending, url);
  },
  async popPending() {
    return redis.spop(K.pending);
  },
  async pendingCount() {
    return redis.scard(K.pending);
  },

  isReadOnly: false,
};
