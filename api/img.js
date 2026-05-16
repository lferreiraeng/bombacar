const axios = require('axios');

const ALLOWED = [/(^|\.)olx\.com\.br$/i, /(^|\.)webmotors\.com\.br$/i, /(^|\.)olxcdn\.com$/i];

module.exports = async (req, res) => {
  const target = req.query.u;
  if (!target || typeof target !== 'string') return res.status(400).end();

  let parsed;
  try {
    parsed = new URL(target);
  } catch {
    return res.status(400).end();
  }
  if (!/^https?:$/.test(parsed.protocol)) return res.status(400).end();
  if (!ALLOWED.some((re) => re.test(parsed.hostname))) return res.status(403).end();

  try {
    const upstream = await axios.get(target, {
      responseType: 'arraybuffer',
      timeout: 15000,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        Accept: 'image/webp,image/*,*/*;q=0.8',
      },
    });
    res.setHeader('Cache-Control', 'public, max-age=86400, immutable');
    res.setHeader('Content-Type', upstream.headers['content-type'] || 'image/jpeg');
    res.send(Buffer.from(upstream.data));
  } catch {
    res.status(502).end();
  }
};
