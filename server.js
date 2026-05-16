/**
 * Servidor Express local (modo dev).
 * Em produção (Vercel), os endpoints vivem em /api/*.js.
 */
const express = require('express');
const path = require('path');
const axios = require('axios');
const crypto = require('crypto');
const store = require('./lib/store');
const { scrapeCar } = require('./scraper');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, 'public')));

const ALLOWED_IMG_HOSTS = [/(^|\.)olx\.com\.br$/i, /(^|\.)webmotors\.com\.br$/i, /(^|\.)olxcdn\.com$/i];

function voterFromReq(req) {
  const ip =
    (req.headers['x-forwarded-for'] || '').split(',')[0].trim() ||
    req.headers['x-real-ip'] ||
    req.socket?.remoteAddress ||
    '';
  if (!ip) return null;
  return crypto.createHash('md5').update(ip).digest('hex').slice(0, 12);
}

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
  if (!ALLOWED_IMG_HOSTS.some((re) => re.test(parsed.hostname))) return res.status(403).end();

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
  } catch {
    res.status(502).end();
  }
});

app.post('/api/cars', async (req, res) => {
  const { url } = req.body || {};
  if (!url || typeof url !== 'string') return res.status(400).json({ error: 'URL inválida.' });

  const existing = await store.findByUrl(url);
  if (existing) return res.json({ car: existing, alreadyExists: true });

  // Local: tenta scrapear na hora se tiver Playwright; senão joga na fila.
  try {
    const data = await scrapeCar(url);
    const car = await store.insertCar(data);
    res.json({ car });
  } catch (err) {
    console.warn('scrape falhou, jogando na fila:', err.message);
    await store.pushPending(url);
    res.status(202).json({ queued: true, message: 'Adicionado à fila.' });
  }
});

app.get('/api/cars/random', async (req, res) => {
  const exclude = (req.query.exclude || '')
    .split(',')
    .map((x) => parseInt(x, 10))
    .filter(Number.isFinite);
  const car = await store.randomCar(exclude);
  res.json({ car: car || null });
});

app.post('/api/cars/:id/vote', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { type } = req.body || {};
  if (!['bomba', 'bom'].includes(type)) return res.status(400).json({ error: 'Voto inválido.' });

  const voter = voterFromReq(req);
  const car = await store.addVote(id, type, voter);
  if (!car) return res.status(404).json({ error: 'Carro não encontrado.' });
  if (car.alreadyVoted) return res.json({ car, alreadyVoted: true });
  res.json({ car });
});

app.get('/api/ranking', async (req, res) => {
  const type = req.query.type === 'bom' ? 'bom' : 'bomba';
  const limit = Math.min(parseInt(req.query.limit, 10) || 999, 999);
  res.json({ ranking: await store.ranking(type, limit) });
});

app.get('/api/stats', async (req, res) => {
  res.json(await store.stats());
});

app.listen(PORT, () => {
  console.log(`BombaCar rodando em http://localhost:${PORT}`);
});
