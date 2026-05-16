/**
 * POST /api/cars — adiciona URL à fila pendente.
 * O crawler local processa a fila quando rodando.
 */
const store = require('../../lib/store');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).end();

  const { url } = req.body || {};
  if (!url || typeof url !== 'string' || !/^https?:\/\//i.test(url)) {
    return res.status(400).json({ error: 'URL inválida.' });
  }
  if (!/olx\.com\.br|webmotors\.com\.br/i.test(url)) {
    return res.status(400).json({ error: 'Só aceita links de OLX ou Webmotors.' });
  }

  try {
    const existing = await store.findByUrl(url);
    if (existing) {
      return res.json({ car: existing, alreadyExists: true });
    }
    await store.pushPending(url);
    const pending = await store.pendingCount();
    res.status(202).json({
      queued: true,
      pending,
      message: 'Adicionado à fila! O crawler vai processar em breve.',
    });
  } catch (e) {
    console.error('queue err:', e);
    res.status(500).json({ error: 'Falha ao adicionar à fila' });
  }
};
