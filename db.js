const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, 'data.json');

function load() {
  try {
    const raw = fs.readFileSync(FILE, 'utf8');
    const data = JSON.parse(raw);
    return { cars: data.cars || [], nextId: data.nextId || 1 };
  } catch {
    return { cars: [], nextId: 1 };
  }
}

const state = load();
let lastWriteAt = 0;

function persist() {
  const tmp = FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(state, null, 2));
  fs.renameSync(tmp, FILE);
  lastWriteAt = Date.now();
}

function reloadFromDisk() {
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
        const existing = state.cars.find((x) => x.id === c.id);
        if (existing) {
          existing.votes_bomba = c.votes_bomba;
          existing.votes_bom = c.votes_bom;
        }
      }
    }
    state.nextId = Math.max(state.nextId, data.nextId || 1);
    if (added) console.log(`[db] hot-reload: +${added} carros (total ${state.cars.length})`);
  } catch {}
}

fs.watchFile(FILE, { interval: 1000 }, () => {
  // Ignora se acabamos de escrever (evita auto-trigger)
  if (Date.now() - lastWriteAt < 1500) return;
  reloadFromDisk();
});

function listCars() {
  return state.cars;
}

function findByUrl(url) {
  return state.cars.find((c) => c.url === url) || null;
}

function findById(id) {
  return state.cars.find((c) => c.id === id) || null;
}

function insertCar(data) {
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
}

function randomCar(excludeIds = []) {
  const exclude = new Set(excludeIds);
  const pool = state.cars.filter((c) => !exclude.has(c.id));
  if (pool.length === 0) return null;
  return pool[Math.floor(Math.random() * pool.length)];
}

function addVote(id, type) {
  const car = findById(id);
  if (!car) return null;
  if (type === 'bomba') car.votes_bomba += 1;
  else if (type === 'bom') car.votes_bom += 1;
  else return null;
  persist();
  return car;
}

function ranking(type, limit = 5) {
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
}

function stats() {
  let bombas = 0;
  let bons = 0;
  for (const c of state.cars) {
    bombas += c.votes_bomba;
    bons += c.votes_bom;
  }
  return { total: state.cars.length, bombas, bons };
}

module.exports = {
  listCars,
  findByUrl,
  findById,
  insertCar,
  randomCar,
  addVote,
  ranking,
  stats,
};
