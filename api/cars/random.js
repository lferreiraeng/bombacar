const store = require('../../lib/store');

module.exports = async (req, res) => {
  try {
    const exclude = (req.query.exclude || '')
      .split(',')
      .map((x) => parseInt(x, 10))
      .filter(Number.isFinite);
    res.setHeader('Cache-Control', 'no-store');
    const car = await store.randomCar(exclude);
    res.json({ car: car || null });
  } catch (e) {
    console.error('random err:', e);
    res.status(500).json({ error: 'Falha ao buscar carro' });
  }
};
