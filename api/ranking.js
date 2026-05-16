const store = require('../lib/store');

module.exports = async (req, res) => {
  try {
    const type = req.query.type === 'bom' ? 'bom' : 'bomba';
    const limit = Math.min(parseInt(req.query.limit, 10) || 999, 999);
    const all = req.query.all === 'true' || req.query.all === '1';
    res.setHeader('Cache-Control', 'no-store');
    res.json({ ranking: await store.ranking(type, limit, { includeUnvoted: all }) });
  } catch (e) {
    console.error('ranking err:', e);
    res.status(500).json({ error: 'Falha ao ler ranking' });
  }
};
