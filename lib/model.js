/**
 * Helpers para agregar carros por modelo (Marca + Modelo base).
 * Ex: "Volkswagen T-Cross Comfortline 1.0..." → "Volkswagen T-Cross"
 *     "Jeep Renegade Longitude 1.8..."        → "Jeep Renegade"
 */

function extractModel(car) {
  const t = (car.title || '').trim();
  if (!t) return null;
  const parts = t.split(/\s+/).filter(Boolean);
  if (parts.length < 2) return null;
  const label = parts.slice(0, 2).join(' ');
  return { key: label.toLowerCase(), label };
}

function aggregateByModel(cars, type, limit = 5) {
  const voteKey = type === 'bomba' ? 'votes_bomba' : 'votes_bom';
  const groups = new Map();

  for (const c of cars) {
    const m = extractModel(c);
    if (!m) continue;
    let g = groups.get(m.key);
    if (!g) {
      g = { key: m.key, label: m.label, votes: 0, count: 0, image: null, sampleId: c.id };
      groups.set(m.key, g);
    }
    g.votes += c[voteKey] || 0;
    g.count += 1;
    if (!g.image && c.image) g.image = c.image;
  }

  return [...groups.values()]
    .filter((g) => g.votes > 0)
    .sort((a, b) => b.votes - a.votes || b.count - a.count)
    .slice(0, limit);
}

module.exports = { extractModel, aggregateByModel };
