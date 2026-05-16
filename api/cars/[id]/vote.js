const crypto = require('crypto');
const store = require('../../../lib/store');

function voterFromReq(req) {
  const ip =
    (req.headers['x-forwarded-for'] || '').split(',')[0].trim() ||
    req.headers['x-real-ip'] ||
    req.socket?.remoteAddress ||
    '';
  if (!ip) return null;
  return crypto.createHash('md5').update(ip).digest('hex').slice(0, 12);
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).end();

  const id = parseInt(req.query.id, 10);
  if (!Number.isFinite(id)) return res.status(400).json({ error: 'ID inválido.' });

  const { type } = req.body || {};
  if (!['bomba', 'bom'].includes(type)) {
    return res.status(400).json({ error: 'Voto inválido.' });
  }

  try {
    const voter = voterFromReq(req);
    const car = await store.addVote(id, type, voter);
    if (!car) return res.status(404).json({ error: 'Carro não encontrado.' });
    if (car.alreadyVoted) {
      return res.status(200).json({ car, alreadyVoted: true });
    }
    res.json({ car });
  } catch (e) {
    console.error('vote err:', e);
    res.status(500).json({ error: 'Falha ao registrar voto', detail: e.message });
  }
};
