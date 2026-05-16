const store = require('../lib/store');

module.exports = async (req, res) => {
  try {
    const type = req.query.type === 'bom' ? 'bom' : 'bomba';
    const limit = Math.min(parseInt(req.query.limit, 10) || 5, 20);
    res.setHeader('Cache-Control', 'no-store');
    res.json({ ranking: await store.ranking(type, limit) });
  } catch (e) {
    console.error('ranking err:', e);
    res.status(500).json({ error: 'Falha ao ler ranking' });
  }
};
