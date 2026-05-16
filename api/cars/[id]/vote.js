const store = require('../../../lib/store');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).end();

  const id = parseInt(req.query.id, 10);
  if (!Number.isFinite(id)) return res.status(400).json({ error: 'ID inválido.' });

  const { type } = req.body || {};
  if (!['bomba', 'bom'].includes(type)) {
    return res.status(400).json({ error: 'Voto inválido.' });
  }

  try {
    const car = await store.addVote(id, type);
    if (!car) return res.status(404).json({ error: 'Carro não encontrado.' });
    res.json({ car });
  } catch (e) {
    console.error('vote err:', e);
    res.status(500).json({ error: 'Falha ao registrar voto' });
  }
};
