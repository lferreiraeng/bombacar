const fs = require('fs');
const path = require('path');
const { aggregateByModel } = require('./model');

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
    return {
      cars: data.cars || [],
      nextId: data.nextId || 1,
      voted: data.voted || {},
      pending: data.pending || [],
    };
  } catch {
    return { cars: [], nextId: 1, voted: {}, pending: [] };
  }
}

const state = loadSync();

function persist() {
  const tmp = FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(state, null, 2));
  fs.renameSync(tmp, FILE);
}

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
      state.voted = data.voted || state.voted;
      state.pending = data.pending || state.pending;
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
  async addVote(id, type, voter = null) {
    const car = state.cars.find((c) => c.id === Number(id));
    if (!car) return null;
    if (!['bomba', 'bom'].includes(type)) return null;

    if (voter) {
      const key = `${id}:${voter}`;
      state.voted[key] = state.voted[key] || true;
      if (state.voted[key] === 'done') return { ...car, alreadyVoted: true };
      state.voted[key] = 'done';
    }

    if (type === 'bomba') car.votes_bomba += 1;
    else car.votes_bom += 1;
    persist();
    return car;
  },
  async ranking(type, limit = 999) {
    return aggregateByModel(state.cars, type, limit);
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
  async pushPending(url) {
    if (!state.pending.includes(url)) state.pending.push(url);
    persist();
    return 1;
  },
  async popPending() {
    const url = state.pending.shift();
    if (url) persist();
    return url || null;
  },
  async pendingCount() {
    return state.pending.length;
  },

  isReadOnly: false,
};
