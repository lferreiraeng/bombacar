const express = require('express');
const path = require('path');
const axios = require('axios');
const db = require('./db');
const { scrapeCar } = require('./scraper');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, 'public')));

const ALLOWED_IMG_HOSTS = [/(^|\.)olx\.com\.br$/i, /(^|\.)webmotors\.com\.br$/i, /(^|\.)olxcdn\.com$/i];

app.get('/api/img', async (req, res) => {
  const target = req.query.u;
  if (!target || typeof target !== 'string') return res.status(400).end();

  let parsed;
  try {
    parsed = new URL(target);
  } catch {
    return res.status(400).end();
  }
  if (!/^https?:$/.test(parsed.protocol)) return res.status(400).end();
  if (!ALLOWED_IMG_HOSTS.some((re) => re.test(parsed.hostname))) {
    return res.status(403).end();
  }

  try {
    const upstream = await axios.get(target, {
      responseType: 'stream',
      timeout: 15000,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        Accept: 'image/webp,image/*,*/*;q=0.8',
      },
    });
    res.setHeader('Cache-Control', 'public, max-age=86400, immutable');
    res.setHeader('Content-Type', upstream.headers['content-type'] || 'image/jpeg');
    upstream.data.pipe(res);
  } catch (e) {
    res.status(502).end();
  }
});

app.post('/api/cars', async (req, res) => {
  const { url } = req.body || {};
  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'Envie uma URL válida.' });
  }

  const existing = db.findByUrl(url);
  if (existing) {
    return res.json({ car: existing, alreadyExists: true });
  }

  try {
    const data = await scrapeCar(url);
    const car = db.insertCar(data);
    res.json({ car });
  } catch (err) {
    console.error('Erro scraping:', err.message);
    res.status(500).json({ error: 'Não consegui ler esse link. Verifica a URL.' });
  }
});

app.get('/api/cars/random', (req, res) => {
  const exclude = (req.query.exclude || '')
    .split(',')
    .map((x) => parseInt(x, 10))
    .filter(Number.isFinite);

  const car = db.randomCar(exclude);
  res.json({ car: car || null });
});

app.post('/api/cars/:id/vote', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { type } = req.body || {};

  if (!['bomba', 'bom'].includes(type)) {
    return res.status(400).json({ error: 'Voto inválido.' });
  }

  const car = db.addVote(id, type);
  if (!car) return res.status(404).json({ error: 'Carro não encontrado.' });
  res.json({ car });
});

app.get('/api/ranking', (req, res) => {
  const type = req.query.type === 'bom' ? 'bom' : 'bomba';
  const limit = Math.min(parseInt(req.query.limit, 10) || 5, 20);
  res.json({ ranking: db.ranking(type, limit) });
});

app.get('/api/stats', (req, res) => {
  res.json(db.stats());
});

app.listen(PORT, () => {
  console.log(`BombaCar rodando em http://localhost:${PORT}`);
});
