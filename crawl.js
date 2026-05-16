/**
 * BombaCar crawler contínuo.
 * Loop infinito: rastreia listagens da OLX por marca/página, cadastra anúncios novos
 * e empurra cada novo carro pro Upstash em tempo real (se KV configurado).
 *
 * Uso: node crawl.js
 * Para: Ctrl+C
 */
const { chromium } = require('playwright');
const db = require('./lib/store');
const { scrapeCar, closeBrowser } = require('./scraper');
const { syncCar, isConfigured } = require('./lib/upstash-sync');

const BRANDS = [
  'vw-volkswagen', 'chevrolet-gm', 'fiat', 'ford', 'toyota', 'honda',
  'hyundai', 'renault', 'jeep', 'nissan', 'peugeot', 'citroen',
  'mitsubishi', 'kia', 'bmw', 'mercedes-benz', 'audi', 'subaru',
  'land-rover', 'volvo', 'chery', 'caoa-chery', 'byd', 'gwm',
  'troller', 'mini', 'porsche', 'lexus',
];

const PAGES_PER_BRAND = 5;
const CYCLE_REST_MIN = 30; // espera entre ciclos completos
const SCRAPE_DELAY_MS = 500;

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const fmt = (n) => String(n).padStart(4, ' ');

let totalNew = 0;
let totalSkip = 0;
let totalFail = 0;
let cycleNum = 0;
let stopping = false;
process.on('SIGINT', () => {
  console.log('\n⏹  Recebido SIGINT, encerrando após o item atual...');
  stopping = true;
});

async function collectUrls(page, brand, pg) {
  const url =
    `https://www.olx.com.br/autos-e-pecas/carros-vans-e-utilitarios/${brand}` +
    (pg > 1 ? `?o=${pg}` : '');
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(700);
    await page.evaluate(async () => {
      await new Promise((resolve) => {
        let total = 0;
        const step = 900;
        const timer = setInterval(() => {
          window.scrollBy(0, step);
          total += step;
          if (total >= document.body.scrollHeight - window.innerHeight - 200) {
            clearInterval(timer);
            resolve();
          }
        }, 110);
      });
    });
    await page.waitForTimeout(400);
    const hrefs = await page.$$eval('a[href]', (as) =>
      as
        .map((a) => a.href)
        .filter((h) =>
          /olx\.com\.br\/.*\/autos-e-pecas\/carros-vans-e-utilitarios\/.+-\d{6,}/i.test(h)
        )
        .map((h) => h.split('?')[0])
    );
    return [...new Set(hrefs)];
  } catch (e) {
    return [];
  }
}

async function runCycle(page) {
  cycleNum++;
  console.log(`\n♻️  Ciclo #${cycleNum}  ·  ${new Date().toLocaleString('pt-BR')}\n`);

  // embaralha marcas a cada ciclo
  const order = [...BRANDS].sort(() => Math.random() - 0.5);

  for (const brand of order) {
    if (stopping) return;
    for (let pg = 1; pg <= PAGES_PER_BRAND; pg++) {
      if (stopping) return;
      const urls = await collectUrls(page, brand, pg);
      if (!urls.length) break;
      for (const url of urls) {
        if (stopping) return;
        if (await db.findByUrl(url)) {
          totalSkip++;
          continue;
        }
        try {
          const data = await scrapeCar(url);
          if (!data.title) {
            totalFail++;
            continue;
          }
          const car = await db.insertCar(data);
          totalNew++;
          const synced = await syncCar(car).catch(() => false);
          const tag = synced ? '☁' : '·';
          console.log(
            `[+${fmt(totalNew)}] ${tag} ${(data.price || '—').padEnd(11)} ${data.title.slice(0, 70)}`
          );
        } catch (e) {
          totalFail++;
        }
        await sleep(SCRAPE_DELAY_MS);
      }
    }
  }

  console.log(
    `\n📊 Ciclo #${cycleNum} fim · novos: ${totalNew} · já tinha: ${totalSkip} · falhas: ${totalFail}`
  );
}

(async () => {
  console.log('🚗 BombaCar crawler contínuo');
  console.log(`   Upstash: ${isConfigured() ? '☁ conectado' : '✗ desativado (rodando só local)'}`);
  console.log('   Press Ctrl+C pra parar.\n');

  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({
    userAgent: UA,
    viewport: { width: 1366, height: 800 },
    locale: 'pt-BR',
  });
  await ctx.addInitScript(() =>
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined })
  );
  const page = await ctx.newPage();

  try {
    while (!stopping) {
      await runCycle(page);
      if (stopping) break;
      console.log(`\n💤 Dormindo ${CYCLE_REST_MIN} min antes do próximo ciclo...\n`);
      for (let i = 0; i < CYCLE_REST_MIN * 60 && !stopping; i++) await sleep(1000);
    }
  } finally {
    await browser.close().catch(() => {});
    await closeBrowser().catch(() => {});
    console.log(
      `\n✅ Fim. Total da sessão: ${totalNew} novos · ${totalSkip} já existiam · ${totalFail} falhas.`
    );
  }
})().catch((e) => {
  console.error('FATAL:', e);
  process.exit(1);
});
