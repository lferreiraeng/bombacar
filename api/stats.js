const store = require('../lib/store');

module.exports = async (req, res) => {
  try {
    res.setHeader('Cache-Control', 'no-store');
    res.json(await store.stats());
  } catch (e) {
    console.error('stats err:', e);
    res.status(500).json({ error: 'Falha ao ler stats' });
  }
};
