/**
 * Helpers para agregar carros por modelo (Marca + Modelo base).
 * Ex: "Volkswagen T-Cross Comfortline 1.0..." → "Volkswagen T-Cross"
 */

function extractModel(car) {
  const t = (car.title || '').trim();
  if (!t) return null;
  const parts = t.split(/\s+/).filter(Boolean);
  if (parts.length < 2) return null;
  const label = parts.slice(0, 2).join(' ');
  return { key: label.toLowerCase(), label };
}

function aggregateByModel(cars, type, limit = 999, opts = {}) {
  const includeUnvoted = !!opts.includeUnvoted;
  const voteKey = type === 'bomba' ? 'votes_bomba' : 'votes_bom';
  const groups = new Map();

  for (const c of cars) {
    const m = extractModel(c);
    if (!m) continue;
    const votes = c[voteKey] || 0;
    let g = groups.get(m.key);
    if (!g) {
      g = { key: m.key, label: m.label, votes: 0, count: 0, image: null, cars: [] };
      groups.set(m.key, g);
    }
    g.votes += votes;
    g.count += 1;
    if (!g.image && c.image) g.image = c.image;
    g.cars.push({
      id: c.id,
      title: c.title,
      image: c.image,
      price: c.price,
      url: c.url,
      votes_bomba: c.votes_bomba || 0,
      votes_bom: c.votes_bom || 0,
    });
  }

  return [...groups.values()]
    .filter((g) => includeUnvoted || g.votes > 0)
    .sort((a, b) => {
      // Modo "todos": ordena por count (mais anúncios) depois por votes
      if (includeUnvoted) return b.count - a.count || b.votes - a.votes;
      return b.votes - a.votes || b.count - a.count;
    })
    .slice(0, limit)
    .map((g) => ({
      ...g,
      cars: g.cars.sort((a, b) => (b[voteKey] || 0) - (a[voteKey] || 0)).slice(0, 30),
    }));
}

module.exports = { extractModel, aggregateByModel };
