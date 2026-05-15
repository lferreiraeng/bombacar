const { chromium } = require('playwright');

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

let browserPromise = null;
function getBrowser() {
  if (!browserPromise) {
    browserPromise = chromium.launch({ headless: true });
  }
  return browserPromise;
}

function detectSource(url) {
  if (/olx\.com\.br/i.test(url)) return 'olx';
  if (/webmotors\.com\.br/i.test(url)) return 'webmotors';
  return 'web';
}

function normalizePrice(p) {
  if (p == null) return null;
  if (typeof p === 'number') return 'R$ ' + p.toLocaleString('pt-BR');
  const s = String(p).trim();
  if (/^R\$/i.test(s)) return s;
  const onlyNumber = s.replace(/\D/g, '');
  if (onlyNumber) return 'R$ ' + Number(onlyNumber).toLocaleString('pt-BR');
  return s;
}

function pickFromAd(ad) {
  const title = ad.subject || ad.title || '';
  const description = ad.body || ad.description || '';
  const priceRaw = ad.priceValue || ad.price || null;

  const images = (ad.images || [])
    .map((i) => i.original || i.url || i.originalMobile || i.webpFormat || i)
    .filter((u) => typeof u === 'string' && u.startsWith('http'));

  const ALLOWED = new Set([
    'vehicle_model',
    'vehicle_brand',
    'regdate',
    'mileage',
    'motorpower',
    'fuel',
    'gearbox',
    'car_steering',
    'carcolor',
    'doors',
    'end_tag',
    'car_features',
    'has_gnv_kit',
    'has_auction',
    'has_paid_ipva',
    'has_with_fine',
    'is_settled',
    'is_funded',
  ]);

  const properties = (ad.properties || [])
    .filter((p) => p && p.label && p.value && ALLOWED.has(p.name))
    .map((p) => {
      let value = Array.isArray(p.values)
        ? p.values.map((v) => v.label || v.value || v).join(', ')
        : String(p.value || '');
      if (p.name === 'mileage' && /^\d+$/.test(value)) {
        value = Number(value).toLocaleString('pt-BR') + ' km';
      }
      return { name: p.name, label: p.label, value };
    });

  return {
    title: String(title).slice(0, 240),
    description: String(description).slice(0, 2000),
    price: normalizePrice(priceRaw),
    images,
    properties,
  };
}

async function scrapeOlx(page, url) {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });

  const dataJson = await page
    .locator('#initial-data')
    .first()
    .getAttribute('data-json', { timeout: 10000 })
    .catch(() => null);

  if (!dataJson) throw new Error('Não achei dados estruturados no anúncio OLX');

  const parsed = JSON.parse(dataJson);
  const ad = parsed.ad;
  if (!ad) throw new Error('Estrutura do anúncio OLX mudou');

  return pickFromAd(ad);
}

async function scrapeGeneric(page, url) {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(1500);

  const data = await page.evaluate(() => {
    const meta = (names) => {
      for (const n of names) {
        const el =
          document.querySelector(`meta[property="${n}"]`) ||
          document.querySelector(`meta[name="${n}"]`);
        if (el && el.content) return el.content.trim();
      }
      return null;
    };

    const title = meta(['og:title', 'twitter:title']) || document.title || '';
    const description = meta(['og:description', 'twitter:description', 'description']) || '';
    const ogImage = meta(['og:image', 'twitter:image', 'og:image:secure_url']);

    const images = new Set();
    if (ogImage) images.add(ogImage);
    document.querySelectorAll('img').forEach((img) => {
      const src = img.currentSrc || img.src;
      if (
        src &&
        src.startsWith('http') &&
        /\.(jpg|jpeg|png|webp)/i.test(src) &&
        img.naturalWidth >= 300
      ) {
        images.add(src);
      }
    });

    const priceMatch = (document.body.innerText || '').match(/R\$\s?[\d\.\,]+/);

    return {
      title,
      description,
      images: [...images].slice(0, 30),
      price: priceMatch ? priceMatch[0] : null,
    };
  });

  return {
    title: data.title.slice(0, 240),
    description: data.description.slice(0, 2000),
    price: normalizePrice(data.price),
    images: data.images,
    properties: [],
  };
}

async function scrapeCar(url) {
  if (!/^https?:\/\//i.test(url)) throw new Error('URL inválida');

  const source = detectSource(url);
  const browser = await getBrowser();
  const context = await browser.newContext({
    userAgent: UA,
    viewport: { width: 1366, height: 800 },
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
    extraHTTPHeaders: { 'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8' },
  });

  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
  });

  const page = await context.newPage();
  page.setDefaultTimeout(30000);

  try {
    let result;
    if (source === 'olx') result = await scrapeOlx(page, url);
    else result = await scrapeGeneric(page, url);

    return {
      url,
      source,
      title: result.title || 'Carro',
      description: result.description || '',
      price: result.price || null,
      image: result.images[0] || null,
      images: result.images || [],
      properties: result.properties || [],
    };
  } finally {
    await context.close().catch(() => {});
  }
}

async function closeBrowser() {
  if (browserPromise) {
    const b = await browserPromise;
    await b.close().catch(() => {});
    browserPromise = null;
  }
}

module.exports = { scrapeCar, closeBrowser };
