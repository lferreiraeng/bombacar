# BombaCar 💣

Vote se um carro anunciado na **OLX** é uma **bomba** ou um **bom carro**.
Cole o link do anúncio, o sistema faz o scraping (fotos + atributos), e a galera vota estilo Tinder.

![stack](https://img.shields.io/badge/node-%E2%89%A518-339933?logo=node.js&logoColor=white)
![express](https://img.shields.io/badge/express-4-000000?logo=express)
![playwright](https://img.shields.io/badge/playwright-chromium-2EAD33?logo=playwright)

---

## ✨ Features

- **Scraping completo** de anúncios da OLX (título, preço, ~17 fotos por anúncio, ano, km, combustível, câmbio, cor, opcionais…)
- **Card estilo Tinder** com swipe animado, atalhos de teclado (← → ↑) e galeria navegável (chevrons + thumbnails)
- **Ranking lateral em tempo real** dos mais votados como bomba e como bom carro
- **Proxy de imagens** próprio pra contornar hotlink protection do OLX
- **Hot-reload de banco** — múltiplos processos (seed + server) ficam em sync via `fs.watchFile`
- **Seed em massa**: script que popula 100+ carros da OLX automaticamente, balanceado entre 17 marcas

---

## 🏗 Stack

- **Backend**: Node.js + Express
- **Scraping**: Playwright (Chromium headless) — único caminho confiável contra Cloudflare/Akamai
- **Banco**: JSON local com write atômico (`writeFile` + `rename`) e file-watch para sync entre processos
- **Frontend**: HTML/CSS/JS vanilla, fontes Inter + Space Grotesk, ícones Lucide inline

---

## 🚀 Como rodar local

Pré-requisitos: Node 18+ e ~500MB livres (Chromium).

```bash
git clone <seu-repo>
cd bombacar
npm install
npx playwright install chromium     # baixa o Chromium uma vez
npm start
```

Abre [http://localhost:3000](http://localhost:3000).

### Popular o banco com 100 carros

```bash
npm run seed              # 100 carros (padrão)
node seed.js 50           # quantidade customizada
```

O script abre listagens da OLX por marca, coleta URLs variadas, faz scrape sequencial e insere no `data.json`. Dura ~5 min para 100 carros. Se o servidor estiver rodando ao mesmo tempo, ele reflete os novos automaticamente (hot-reload).

---

## 📁 Estrutura

```
bombacar/
├── server.js          # Express + endpoints REST + proxy de imagens
├── db.js              # JSON store com persistência atômica e hot-reload
├── scraper.js         # Playwright + parser do <script id="initial-data">
├── seed.js            # Popular base via listagens de marca
├── public/
│   ├── index.html
│   ├── style.css      # dark theme com Inter/Space Grotesk
│   ├── app.js
│   └── icons.js       # SVGs do Lucide inline
└── data.json          # gerado em runtime (não vai pro Git)
```

---

## 🔌 API

| Método | Rota                    | Descrição                                                       |
|--------|-------------------------|-----------------------------------------------------------------|
| POST   | `/api/cars`             | Cadastra carro a partir de uma URL do OLX. Body: `{ url }`      |
| GET    | `/api/cars/random`      | Carro aleatório. Query `exclude=1,2,3` ignora IDs               |
| POST   | `/api/cars/:id/vote`    | Vota. Body: `{ type: 'bomba' \| 'bom' }`                        |
| GET    | `/api/ranking`          | Top votados. Query `type=bomba\|bom`, `limit=5`                 |
| GET    | `/api/stats`            | `{ total, bombas, bons }`                                       |
| GET    | `/api/img?u=<URL>`      | Proxy de imagens (whitelist de hosts do OLX/Webmotors)          |

---

## ⌨️ Atalhos

| Tecla            | Ação                |
|------------------|---------------------|
| `←`              | Voto: bomba         |
| `→`              | Voto: bom carro     |
| `↑` ou `Espaço`  | Pular               |
| `A` / `D`        | Navegar foto anterior / próxima |

---

## 🌐 Deploy

**Não é trivial.** O scraper depende de Chromium (~170MB) e o banco é em disco. Resumo dos caminhos viáveis:

- **Railway / Render / Fly.io** ✅ — roda como está, dá pra adicionar volume persistente. Recomendado.
- **VPS própria (Hetzner, Contabo, etc.)** ✅ — Node + PM2 + Nginx reverse-proxy.
- **Vercel / Netlify Functions** ❌ — Chromium estoura limite de tamanho, FS read-only.
- **Cloud Run / Lambda Container** ⚠️ — possível com imagem Docker customizada, mas custos podem subir.

Se for pra Railway, basta um `Dockerfile` baseado em `mcr.microsoft.com/playwright:v1.60.0-jammy` e expor a porta 3000.

---

## 📝 Roadmap

- [ ] Adaptar `scraper.js` pra Webmotors (estrutura própria, não usa `initial-data`)
- [ ] Anti-revote por IP (cookie/session)
- [ ] Filtros de busca no front (marca, faixa de preço, ano)
- [ ] Comentários nos votos
- [ ] Modo "duelo" — comparar 2 carros lado a lado
