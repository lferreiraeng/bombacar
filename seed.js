/*
 * BombaCar seed
 * --------------------------------
 * Coleta URLs de anúncios variados da OLX e cadastra via scrapeCar.
 *
 * Uso: node seed.js [N]   (default 100)
 */
const { chromium } = require('playwright');
const db = require('./db');
const { scrapeCar, closeBrowser } = require('./scraper');

const TARGET = parseInt(process.argv[2], 10) || 100;

const BRANDS = [
  'vw-volkswagen',
  'chevrolet-gm',
  'fiat',
  'ford',
  'toyota',
  'honda',
  'hyundai',
  'renault',
  'jeep',
  'nissan',
  'peugeot',
  'citroen',
  'mitsubishi',
  'kia',
  'bmw',
  'mercedes-benz',
  'audi',
];

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

const listingUrl = (brand, page = 1) =>
  `https://www.olx.com.br/autos-e-pecas/carros-vans-e-utilitarios/${brand}` +
  (page > 1 ? `?o=${page}` : '');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function fmtTime(ms) {
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)}m${String(s % 60).padStart(2, '0')}s`;
}

async function collectFromListing(page, brand, maxPerBrand) {
  const found = new Set();
  for (let pg = 1; pg <= 3 && found.size < maxPerBrand; pg++) {
    const url = listingUrl(brand, pg);
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(800);

      // Scroll incremental pra disparar lazy loading
      await page.evaluate(async () => {
        await new Promise((resolve) => {
          let total = 0;
          const step = 800;
          const timer = setInterval(() => {
            window.scrollBy(0, step);
            total += step;
            if (total >= document.body.scrollHeight - window.innerHeight - 200) {
              clearInterval(timer);
              resolve();
            }
          }, 120);
        });
      });
      await page.waitForTimeout(500);

      const hrefs = await page.$$eval('a[href]', (as) =>
        as
          .map((a) => a.href)
          .filter((h) =>
            /olx\.com\.br\/.*\/autos-e-pecas\/carros-vans-e-utilitarios\/.+-\d{6,}/i.test(h)
          )
      );
      hrefs.forEach((h) => found.add(h.split('?')[0]));
    } catch (e) {
      console.warn(`  [skip] ${brand} pg${pg}: ${e.message.slice(0, 80)}`);
    }
  }
  return [...found].slice(0, maxPerBrand);
}

async function main() {
  console.log(`\n🚗 BombaCar seed — alvo: ${TARGET} carros\n`);
  const t0 = Date.now();

  // 1) Coleta URLs de anúncios variados
  console.log('[1/2] Coletando URLs de anúncios por marca...');
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({
    userAgent: UA,
    viewport: { width: 1366, height: 800 },
    locale: 'pt-BR',
  });
  await ctx.addInitScript(() => Object.defineProperty(navigator, 'webdriver', { get: () => undefined }));
  const page = await ctx.newPage();

  const perBrand = Math.ceil((TARGET * 1.6) / BRANDS.length);
  const allUrls = [];
  for (const brand of BRANDS) {
    const urls = await collectFromListing(page, brand, perBrand);
    console.log(`  ${brand.padEnd(18)} ${urls.length} URLs`);
    allUrls.push(...urls.map((u) => ({ url: u, brand })));
  }
  await browser.close();

  const existingUrls = new Set(db.listCars().map((c) => c.url));
  const fresh = allUrls.filter((x) => !existingUrls.has(x.url));

  // Embaralha e mantém diversidade de marca (round-robin por marca)
  const byBrand = {};
  for (const x of fresh) (byBrand[x.brand] = byBrand[x.brand] || []).push(x.url);
  Object.values(byBrand).forEach((list) => list.sort(() => Math.random() - 0.5));

  const ordered = [];
  let added = true;
  while (added && ordered.length < TARGET * 2) {
    added = false;
    for (const brand of BRANDS) {
      const list = byBrand[brand];
      if (list && list.length) {
        ordered.push(list.shift());
        added = true;
        if (ordered.length >= TARGET * 2) break;
      }
    }
  }

  console.log(`\n  Total coletado: ${fresh.length} URLs únicas`);
  console.log(`  Já no banco:    ${existingUrls.size}`);
  console.log(`  Vou tentar:     ${Math.min(ordered.length, TARGET * 2)} (até ${TARGET} sucessos)\n`);

  if (!ordered.length) {
    console.log('Nada novo pra cadastrar.');
    await closeBrowser();
    return;
  }

  // 2) Scrape sequencial
  console.log('[2/2] Cadastrando carros (sequencial)...\n');
  let ok = 0;
  let failed = 0;
  for (let i = 0; i < ordered.length && ok < TARGET; i++) {
    const url = ordered[i];
    const idx = `[${String(ok + 1).padStart(3, ' ')}/${TARGET}]`;
    try {
      const data = await scrapeCar(url);
      if (!data.title || data.title === 'Carro') {
        console.log(`${idx} ⚠  sem dados | ${url.slice(0, 90)}`);
        failed++;
        continue;
      }
      db.insertCar(data);
      ok++;
      const photos = (data.images || []).length;
      console.log(
        `${idx} ✓ ${data.price || '—'} | ${photos}fotos | ${data.title.slice(0, 70)}`
      );
    } catch (e) {
      failed++;
      console.log(`${idx} ✗ erro: ${e.message.slice(0, 80)}`);
    }
    await sleep(400);
  }

  await closeBrowser();
  console.log(
    `\n✅ Pronto. ${ok} cadastrados, ${failed} falhas em ${fmtTime(Date.now() - t0)}.\n` +
      `   Total no banco: ${db.listCars().length}`
  );
}

main().catch((e) => {
  console.error('FATAL:', e);
  closeBrowser().finally(() => process.exit(1));
});
