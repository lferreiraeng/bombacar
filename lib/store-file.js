/**
 * Store driver: arquivo local (data.json).
 * Usado em desenvolvimento e quando KV_REST_API_URL não está configurado.
 */
const fs = require('fs');
const path = require('path');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..');
const FILE = path.join(DATA_DIR, 'data.json');
const SEED_FILE = path.join(__dirname, '..', 'data.json');

try {
  if (DATA_DIR !== path.join(__dirname, '..') && !fs.existsSync(FILE) && fs.existsSync(SEED_FILE)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.copyFileSync(SEED_FILE, FILE);
    console.log(`[store-file] seed inicial copiado para ${FILE}`);
  }
} catch (e) {
  console.warn('[store-file] seed copy falhou:', e.message);
}

function loadSync() {
  try {
    const raw = fs.readFileSync(FILE, 'utf8');
    const data = JSON.parse(raw);
    return { cars: data.cars || [], nextId: data.nextId || 1 };
  } catch {
    return { cars: [], nextId: 1 };
  }
}

const state = loadSync();

function persist() {
  const tmp = FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(state, null, 2));
  fs.renameSync(tmp, FILE);
}

// Hot-reload entre processos (server + seed rodando juntos)
try {
  fs.watchFile(FILE, { interval: 1000 }, () => {
    try {
      const raw = fs.readFileSync(FILE, 'utf8');
      const data = JSON.parse(raw);
      const ids = new Set(state.cars.map((c) => c.id));
      let added = 0;
      for (const c of data.cars || []) {
        if (!ids.has(c.id)) {
          state.cars.push(c);
          added++;
        } else {
          const ex = state.cars.find((x) => x.id === c.id);
          if (ex) {
            ex.votes_bomba = c.votes_bomba;
            ex.votes_bom = c.votes_bom;
          }
        }
      }
      state.nextId = Math.max(state.nextId, data.nextId || 1);
      if (added) console.log(`[store-file] hot-reload: +${added} carros (total ${state.cars.length})`);
    } catch {}
  });
} catch {}

module.exports = {
  async listCars() {
    return state.cars;
  },
  async findByUrl(url) {
    return state.cars.find((c) => c.url === url) || null;
  },
  async findById(id) {
    return state.cars.find((c) => c.id === Number(id)) || null;
  },
  async insertCar(data) {
    const car = {
      id: state.nextId++,
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
    state.cars.push(car);
    persist();
    return car;
  },
  async randomCar(excludeIds = []) {
    const exclude = new Set(excludeIds.map(Number));
    const pool = state.cars.filter((c) => !exclude.has(c.id));
    if (!pool.length) return null;
    return pool[Math.floor(Math.random() * pool.length)];
  },
  async addVote(id, type) {
    const car = state.cars.find((c) => c.id === Number(id));
    if (!car) return null;
    if (type === 'bomba') car.votes_bomba += 1;
    else if (type === 'bom') car.votes_bom += 1;
    else return null;
    persist();
    return car;
  },
  async ranking(type, limit = 5) {
    const key = type === 'bomba' ? 'votes_bomba' : 'votes_bom';
    return state.cars
      .filter((c) => c[key] > 0)
      .sort((a, b) => b[key] - a[key])
      .slice(0, limit)
      .map((c) => ({
        id: c.id,
        title: c.title,
        image: c.image,
        price: c.price,
        votes_bomba: c.votes_bomba,
        votes_bom: c.votes_bom,
      }));
  },
  async stats() {
    let bombas = 0;
    let bons = 0;
    for (const c of state.cars) {
      bombas += c.votes_bomba;
      bons += c.votes_bom;
    }
    return { total: state.cars.length, bombas, bons };
  },
  isReadOnly: false,
};
