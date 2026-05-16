const cardArea = document.getElementById('cardArea');
const voteBombaBtn = document.getElementById('voteBomba');
const voteBomBtn = document.getElementById('voteBom');
const skipBtn = document.getElementById('skip');
const rankBomba = document.getElementById('rankBomba');
const rankBom = document.getElementById('rankBom');
const bombaSummary = document.getElementById('bombaSummary');
const bomSummary = document.getElementById('bomSummary');
const statCars = document.getElementById('statCars');
const statBombas = document.getElementById('statBombas');
const statBons = document.getElementById('statBons');

const modal = document.getElementById('modal');
const openCadastro = document.getElementById('openCadastro');
const closeModal = document.getElementById('closeModal');
const formCadastro = document.getElementById('formCadastro');
const urlInput = document.getElementById('urlInput');
const formMsg = document.getElementById('formMsg');
const submitBtn = document.getElementById('submitBtn');

const cookieBanner = document.getElementById('cookieBanner');
const acceptCookies = document.getElementById('acceptCookies');

const drawer = document.getElementById('drawer');
const drawerTitle = document.getElementById('drawerTitle');
const drawerList = document.getElementById('drawerList');
const drawerClose = document.getElementById('drawerClose');
const driverWarning = document.getElementById('driverWarning');

const { ICONS, PROP_ICONS, init: initIcons } = window.BombaIcons;

let currentCar = null;
let currentPhotoIdx = 0;

const SEEN_KEY = 'bombacar.seen.v1';
const COOKIE_KEY = 'bombacar.cookies.v1';

function loadSeen() {
  try { return new Set(JSON.parse(localStorage.getItem(SEEN_KEY) || '[]')); }
  catch { return new Set(); }
}
function saveSeen() {
  try { localStorage.setItem(SEEN_KEY, JSON.stringify([...seen])); } catch {}
}
const seen = loadSeen();

const escapeHtml = (s) =>
  String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const proxyImg = (url) => (url ? '/api/img?u=' + encodeURIComponent(url) : '');
const iconSvg = (n) => ICONS[n] || ICONS.info;
const propIcon = (label) => iconSvg(PROP_ICONS[label] || 'info');

/* ============================================================ COOKIE BANNER */
if (!localStorage.getItem(COOKIE_KEY)) cookieBanner.classList.remove('hidden');
acceptCookies.addEventListener('click', () => {
  localStorage.setItem(COOKIE_KEY, '1');
  cookieBanner.classList.add('hidden');
});

/* ============================================================ TABS */
const tabs = document.querySelectorAll('.tab');
function setView(view) {
  document.body.dataset.view = view;
  tabs.forEach((t) => t.classList.toggle('active', t.dataset.view === view));
  if (view === 'bomba' || view === 'bom') loadRanking();
  if (view === 'vote' && !currentCar) loadCar();
}
tabs.forEach((t) => t.addEventListener('click', () => setView(t.dataset.view)));
setView('vote');

/* ============================================================ CARD */
function renderCard(car) {
  if (!car) {
    cardArea.innerHTML = `
      <div class="empty">
        <i data-icon="car-empty"></i>
        <p>Nenhum carro disponível.<br/>Cadastre o primeiro!</p>
      </div>`;
    initIcons(cardArea);
    voteBombaBtn.disabled = true;
    voteBomBtn.disabled = true;
    skipBtn.disabled = true;
    return;
  }
  voteBombaBtn.disabled = false;
  voteBomBtn.disabled = false;
  skipBtn.disabled = false;
  currentPhotoIdx = 0;

  const photos = (car.images && car.images.length ? car.images : [car.image]).filter(Boolean);
  const props = car.properties || [];

  const propsHtml = props
    .map((p) => {
      const isFull = p.name === 'car_features';
      return `
        <div class="prop${isFull ? ' full' : ''}">
          <span class="prop-ico">${propIcon(p.label)}</span>
          <span class="prop-text">
            <span class="label">${escapeHtml(p.label)}</span>
            <span class="value">${escapeHtml(p.value)}</span>
          </span>
        </div>`;
    })
    .join('');

  const thumbsHtml =
    photos.length > 1
      ? `<div class="thumbs">${photos
          .map(
            (src, i) =>
              `<div class="thumb ${i === 0 ? 'active' : ''}" data-idx="${i}" style="background-image:url('${escapeHtml(proxyImg(src))}')"></div>`
          )
          .join('')}</div>`
      : '';

  cardArea.innerHTML = `
    <article class="card" id="card-${car.id}">
      <div class="gallery" data-total="${photos.length}">
        ${photos
          .map(
            (src, i) =>
              `<div class="slide ${i === 0 ? 'active' : ''}" style="background-image:url('${escapeHtml(proxyImg(src))}')"></div>`
          )
          .join('')}
        <span class="source">${escapeHtml(car.source || 'web')}</span>
        ${car.price ? `<div class="price-tag"><span class="price">${escapeHtml(car.price)}</span></div>` : ''}
        ${
          photos.length > 1
            ? `<button class="nav prev" data-nav="-1" aria-label="Anterior">${iconSvg('chevronLeft')}</button>
               <button class="nav next" data-nav="1" aria-label="Próxima">${iconSvg('chevronRight')}</button>
               <div class="counter"><span id="photoIdx">1</span>/${photos.length}</div>`
            : ''
        }
      </div>
      ${thumbsHtml}
      <div class="body">
        <h3 class="title">${escapeHtml(car.title)}</h3>
        ${propsHtml ? `<div class="props">${propsHtml}</div>` : ''}
        ${car.description ? `<details class="desc-wrap"><summary>Descrição</summary><div class="desc">${escapeHtml(car.description)}</div></details>` : ''}
        <div class="tally">
          <span class="pill b">${iconSvg('bomb')} ${car.votes_bomba}</span>
          <span class="pill g">${iconSvg('star')} ${car.votes_bom}</span>
        </div>
        <div class="card-meta">
          <a href="${escapeHtml(car.url)}" target="_blank" rel="noopener">${iconSvg('external')} Ver anúncio</a>
        </div>
      </div>
    </article>
  `;

  initIcons(cardArea);
  cardArea.querySelectorAll('.nav').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      navigatePhoto(parseInt(btn.dataset.nav, 10), photos.length);
    });
  });
  cardArea.querySelectorAll('.thumb').forEach((t) => {
    t.addEventListener('click', (e) => {
      e.stopPropagation();
      goToPhoto(parseInt(t.dataset.idx, 10), photos.length);
    });
  });
  enableSwipe(cardArea.querySelector('.gallery'), photos.length);
}

function enableSwipe(el, total) {
  if (!el || total <= 1) return;
  let startX = 0, startY = 0, active = false;
  el.addEventListener('touchstart', (e) => {
    if (e.touches.length !== 1) return;
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    active = true;
  }, { passive: true });
  el.addEventListener('touchend', (e) => {
    if (!active) return;
    active = false;
    const dx = e.changedTouches[0].clientX - startX;
    const dy = e.changedTouches[0].clientY - startY;
    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) {
      navigatePhoto(dx < 0 ? 1 : -1, total);
    }
  });
}

function goToPhoto(idx, total) {
  if (total <= 1) return;
  currentPhotoIdx = ((idx % total) + total) % total;
  syncSlides();
}
function navigatePhoto(dir, total) {
  if (total <= 1) return;
  currentPhotoIdx = (currentPhotoIdx + dir + total) % total;
  syncSlides();
}
function syncSlides() {
  cardArea.querySelectorAll('.slide').forEach((s, i) => s.classList.toggle('active', i === currentPhotoIdx));
  cardArea.querySelectorAll('.thumb').forEach((t, i) => t.classList.toggle('active', i === currentPhotoIdx));
  const idxEl = document.getElementById('photoIdx');
  if (idxEl) idxEl.textContent = currentPhotoIdx + 1;
}

/* ============================================================ FLOW */
async function loadCar() {
  const excludeParam = currentCar ? `?exclude=${[...seen, currentCar.id].join(',')}` : '';
  const res = await fetch('/api/cars/random' + excludeParam);
  const { car } = await res.json();
  if (!car) {
    if (seen.size > 0) { seen.clear(); saveSeen(); return loadCar(); }
    currentCar = null;
    renderCard(null);
    return;
  }
  currentCar = car;
  renderCard(car);
}

async function vote(type) {
  if (!currentCar) return;
  const cardEl = document.getElementById('card-' + currentCar.id);
  if (cardEl) cardEl.classList.add('swipe-' + type);
  seen.add(currentCar.id);
  saveSeen();
  const id = currentCar.id;
  setTimeout(async () => {
    try {
      const r = await fetch(`/api/cars/${id}/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type }),
      });
      const data = await r.json();
      if (data.alreadyVoted) {
        // sem alarde — usuário já votou nesse, segue
      }
    } catch {}
    await Promise.all([loadCar(), loadRanking(), loadStats()]);
  }, 380);
}

function skip() {
  if (!currentCar) return;
  const cardEl = document.getElementById('card-' + currentCar.id);
  if (cardEl) cardEl.classList.add('swipe-skip');
  seen.add(currentCar.id);
  saveSeen();
  setTimeout(loadCar, 380);
}

/* ============================================================ STATS */
async function loadStats() {
  try {
    const r = await fetch('/api/stats').then((r) => r.json());
    statCars.textContent = r.total;
    statBombas.textContent = r.bombas;
    statBons.textContent = r.bons;
    if (r.driver && r.driver !== 'kv') {
      driverWarning.classList.remove('hidden');
    } else {
      driverWarning.classList.add('hidden');
    }
  } catch {}
}

/* ============================================================ DRAWER (lista clicável) */
async function openDrawer(kind) {
  drawer.classList.remove('hidden');
  drawerList.innerHTML = '<li class="empty">Carregando...</li>';

  let title, url, type;
  if (kind === 'all') {
    title = 'Todos os carros';
    url = '/api/ranking?type=bomba&all=true&limit=999';
    type = 'bomba';
  } else if (kind === 'bomba') {
    title = 'Top Bombas';
    url = '/api/ranking?type=bomba&limit=999';
    type = 'bomba';
  } else {
    title = 'Top Bons';
    url = '/api/ranking?type=bom&limit=999';
    type = 'bom';
  }
  drawerTitle.textContent = title;
  drawerList.className = 'rank rank-' + type;

  try {
    const r = await fetch(url).then((r) => r.json());
    const list = r.ranking || [];
    if (!list.length) {
      drawerList.innerHTML = '<li class="empty">Nenhum modelo</li>';
      return;
    }
    renderRankInto(drawerList, list, type, kind === 'all');
  } catch {
    drawerList.innerHTML = '<li class="empty">Erro ao carregar</li>';
  }
}

function renderRankInto(el, list, type, showCountOnly) {
  const emoji = type === 'bomba' ? '💣' : '⭐';
  const voteKey = type === 'bomba' ? 'votes_bomba' : 'votes_bom';

  el.innerHTML = list
    .map((g, i) => {
      const img = g.image
        ? `<img src="${escapeHtml(proxyImg(g.image))}" alt="" loading="lazy" />`
        : `<div class="img-placeholder"></div>`;
      const adsHtml = (g.cars || [])
        .filter((c) => showCountOnly ? true : (c[voteKey] || 0) > 0)
        .map((c) => {
          const adImg = c.image
            ? `<img src="${escapeHtml(proxyImg(c.image))}" alt="" loading="lazy" />`
            : `<div class="img-placeholder"></div>`;
          return `
            <a class="ad" href="${escapeHtml(c.url)}" target="_blank" rel="noopener">
              ${adImg}
              <div class="ad-info">
                <div class="ad-title">${escapeHtml(c.title)}</div>
                <div class="ad-meta">
                  ${c.price ? `<span class="price">${escapeHtml(c.price)}</span>` : ''}
                  ${(c[voteKey] || 0) > 0 ? `<span class="votes">${emoji} ${c[voteKey]}</span>` : ''}
                </div>
              </div>
            </a>`;
        })
        .join('');
      const metaRight = showCountOnly
        ? `<span class="c">${g.count} anúncio${g.count > 1 ? 's' : ''}</span>`
        : `<span class="v">${emoji} ${g.votes}</span><span class="c">· ${g.count} anúncio${g.count > 1 ? 's' : ''}</span>`;
      return `
        <li class="group" data-key="${escapeHtml(g.key)}">
          <div class="group-head">
            <span class="rank-pos">#${i + 1}</span>
            ${img}
            <div class="info">
              <div class="title">${escapeHtml(g.label)}</div>
              <div class="meta">${metaRight}</div>
            </div>
            <span class="chev">›</span>
          </div>
          <div class="group-body">${adsHtml || '<div style="color:var(--muted);font-size:12px;padding:6px">—</div>'}</div>
        </li>`;
    })
    .join('');

  el.querySelectorAll('li.group .group-head').forEach((head) => {
    head.addEventListener('click', () => head.parentElement.classList.toggle('open'));
  });
}

document.querySelectorAll('.stat-pill[data-list]').forEach((btn) => {
  btn.addEventListener('click', () => openDrawer(btn.dataset.list));
});
drawerClose.addEventListener('click', () => drawer.classList.add('hidden'));
drawer.addEventListener('click', (e) => { if (e.target === drawer) drawer.classList.add('hidden'); });

/* ============================================================ RANKING (por modelo, expansível) */
async function loadRanking() {
  const [bombas, bons] = await Promise.all([
    fetch('/api/ranking?type=bomba&limit=999').then((r) => r.json()),
    fetch('/api/ranking?type=bom&limit=999').then((r) => r.json()),
  ]);
  renderRank(rankBomba, bombas.ranking, 'bomba', bombaSummary);
  renderRank(rankBom, bons.ranking, 'bom', bomSummary);
}

function renderRank(el, list, type, summaryEl) {
  if (summaryEl) {
    const totalVotes = list.reduce((s, g) => s + g.votes, 0);
    summaryEl.textContent = list.length
      ? `${list.length} modelo${list.length > 1 ? 's' : ''} · ${totalVotes} voto${totalVotes > 1 ? 's' : ''}`
      : '';
  }
  if (!list || list.length === 0) {
    el.innerHTML = '<li class="empty">Sem votos ainda</li>';
    return;
  }
  const emoji = type === 'bomba' ? '💣' : '⭐';
  const voteKey = type === 'bomba' ? 'votes_bomba' : 'votes_bom';

  el.innerHTML = list
    .map((g, i) => {
      const img = g.image
        ? `<img src="${escapeHtml(proxyImg(g.image))}" alt="" loading="lazy" />`
        : `<div class="img-placeholder"></div>`;
      const adsHtml = (g.cars || [])
        .filter((c) => (c[voteKey] || 0) > 0)
        .map((c) => {
          const adImg = c.image
            ? `<img src="${escapeHtml(proxyImg(c.image))}" alt="" loading="lazy" />`
            : `<div class="img-placeholder"></div>`;
          return `
            <a class="ad" href="${escapeHtml(c.url)}" target="_blank" rel="noopener">
              ${adImg}
              <div class="ad-info">
                <div class="ad-title">${escapeHtml(c.title)}</div>
                <div class="ad-meta">
                  ${c.price ? `<span class="price">${escapeHtml(c.price)}</span>` : ''}
                  <span class="votes">${emoji} ${c[voteKey]}</span>
                </div>
              </div>
            </a>`;
        })
        .join('');
      return `
        <li class="group" data-key="${escapeHtml(g.key)}">
          <div class="group-head">
            <span class="rank-pos">#${i + 1}</span>
            ${img}
            <div class="info">
              <div class="title">${escapeHtml(g.label)}</div>
              <div class="meta">
                <span class="v">${emoji} ${g.votes}</span>
                <span class="c">· ${g.count} anúncio${g.count > 1 ? 's' : ''}</span>
              </div>
            </div>
            <span class="chev">›</span>
          </div>
          <div class="group-body">${adsHtml || '<div style="color:var(--muted);font-size:12px;padding:6px">Nenhum anúncio com voto</div>'}</div>
        </li>`;
    })
    .join('');

  el.querySelectorAll('li.group .group-head').forEach((head) => {
    head.addEventListener('click', () => {
      head.parentElement.classList.toggle('open');
    });
  });
}

/* ============================================================ EVENTS */
voteBombaBtn.addEventListener('click', () => vote('bomba'));
voteBomBtn.addEventListener('click', () => vote('bom'));
skipBtn.addEventListener('click', skip);

document.addEventListener('keydown', (e) => {
  if (!modal.classList.contains('hidden')) return;
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
  if (document.body.dataset.view !== 'vote') return;
  if (e.key === 'ArrowLeft') vote('bomba');
  else if (e.key === 'ArrowRight') vote('bom');
  else if (e.key === 'ArrowUp' || e.key === ' ') { e.preventDefault(); skip(); }
  else if (e.key === 'a' || e.key === 'A') navigatePhoto(-1, (currentCar?.images || []).length || 1);
  else if (e.key === 'd' || e.key === 'D') navigatePhoto(1, (currentCar?.images || []).length || 1);
});

openCadastro.addEventListener('click', () => {
  modal.classList.remove('hidden');
  urlInput.focus();
});
closeModal.addEventListener('click', () => modal.classList.add('hidden'));
modal.addEventListener('click', (e) => { if (e.target === modal) modal.classList.add('hidden'); });

formCadastro.addEventListener('submit', async (e) => {
  e.preventDefault();
  const url = urlInput.value.trim();
  if (!url) return;
  submitBtn.disabled = true;
  formMsg.textContent = 'Enviando...';
  formMsg.className = 'msg';
  try {
    const res = await fetch('/api/cars', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    });
    const data = await res.json();
    if (!res.ok) {
      formMsg.textContent = data.error || 'Erro.';
      formMsg.className = 'msg error';
    } else if (data.alreadyExists) {
      formMsg.textContent = `✓ Já estava cadastrado: ${data.car.title}`;
      formMsg.className = 'msg success';
    } else if (data.queued) {
      formMsg.textContent = `✓ Na fila! (${data.pending || 1} aguardando)`;
      formMsg.className = 'msg success';
    } else if (data.car) {
      formMsg.textContent = `✓ Cadastrado: ${data.car.title}`;
      formMsg.className = 'msg success';
    }
    urlInput.value = '';
    setTimeout(() => modal.classList.add('hidden'), 1500);
  } catch {
    formMsg.textContent = 'Erro de rede.';
    formMsg.className = 'msg error';
  } finally {
    submitBtn.disabled = false;
  }
});

/* ============================================================ INIT */
loadCar();
loadRanking();
loadStats();

// auto-refresh
setInterval(() => { loadRanking(); loadStats(); }, 20000);
