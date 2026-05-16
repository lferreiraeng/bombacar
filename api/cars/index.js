/**
 * POST /api/cars — cadastro de novo carro.
 *
 * Em produção (Vercel), Playwright + Chromium não cabem nas funções serverless.
 * Para adicionar carros, rode localmente:
 *   1) npm start  (cadastra via UI ou seed)
 *   2) npm run sync  (envia data.json local pro Upstash)
 */
module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).end();

  return res.status(503).json({
    error:
      'Cadastro de carros novos está indisponível neste deploy. ' +
      'Rode o projeto localmente, cadastre por lá e use "npm run sync" para enviar pro banco.',
  });
};
