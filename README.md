# BombaCar 💣

Vote se um carro anunciado na **OLX** é uma **bomba** ou um **bom carro**.
Cole o link do anúncio (modo local), o sistema faz o scraping (fotos + atributos), e a galera vota estilo Tinder.

![stack](https://img.shields.io/badge/node-%E2%89%A518-339933?logo=node.js&logoColor=white)
![express](https://img.shields.io/badge/express-4-000000?logo=express)
![playwright](https://img.shields.io/badge/playwright-chromium-2EAD33?logo=playwright)
![vercel](https://img.shields.io/badge/deploy-vercel-000000?logo=vercel)
![upstash](https://img.shields.io/badge/db-upstash%20redis-00E9A3?logo=redis&logoColor=white)

---

## ✨ Features

- **Scraping completo** de anúncios da OLX (título, preço, ~17 fotos por anúncio, ano, km, combustível, câmbio, cor, opcionais…)
- **Card estilo Tinder** com swipe, atalhos de teclado e galeria navegável
- **Ranking lateral em tempo real** dos mais votados
- **Proxy de imagens** próprio (contorna hotlink protection do OLX)
- **Driver dual de banco**: arquivo local em dev, Upstash Redis em produção
- **Seed em massa**: 100+ carros automaticamente, balanceado entre 17 marcas

---

## 🏗 Stack

| Camada | Tecnologia |
|---|---|
| Backend (local) | Node.js + Express |
| Backend (produção) | Vercel Serverless Functions |
| Scraping | Playwright (Chromium headless) — só roda local |
| Banco (local) | JSON em arquivo com write atômico + file-watch |
| Banco (produção) | Upstash Redis (cliente HTTP) |
| Frontend | HTML/CSS/JS vanilla + Inter/Space Grotesk + Lucide icons |

---

## 🚀 Rodando local

```bash
git clone https://github.com/lferreiraeng/bombacar.git
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

Dura ~5 min para 100 carros. Os carros vão pro `data.json` local.

---

## ☁️ Deploy no Vercel + Upstash

### 1) Crie o Upstash Redis (grátis)

1. Acessa [console.upstash.com](https://console.upstash.com) → login com GitHub
2. **Create Database** → tipo **Redis**, região mais perto (us-east-1 ou sa-east-1)
3. Plano **Free** (10.000 commands/dia)
4. Na aba do DB criado, role até **REST API** e copie:
   - `UPSTASH_REDIS_REST_URL` → vira `KV_REST_API_URL`
   - `UPSTASH_REDIS_REST_TOKEN` → vira `KV_REST_API_TOKEN`

### 2) Suba os 106 carros do seed pro Upstash

Crie um `.env` local copiando `.env.example` e cole os 2 valores:

```bash
cp .env.example .env
# edita o .env e preenche
npm run sync
```

Deve mostrar `✅ 106 carros sincronizados.`

### 3) Conecta na Vercel

1. [vercel.com/new](https://vercel.com/new) → importa o repo `bombacar`
2. **Environment Variables** → adicione as duas:
   - `KV_REST_API_URL`
   - `KV_REST_API_TOKEN`
3. **Deploy**

A Vercel detecta `vercel.json` + `/api/*.js` automaticamente.

### 4) Como adicionar carros depois

Cadastro via interface **não funciona em produção** (Chromium não cabe em serverless). Fluxo:

```bash
# Local
npm start                         # cadastra novos pela UI
# ou
node seed.js 20                   # popula em massa
# depois
npm run sync                      # empurra pro Upstash → reflete na prod
```

---

## 📁 Estrutura

```
bombacar/
├── api/                       # Vercel serverless functions
│   ├── stats.js
│   ├── ranking.js
│   ├── img.js                 # proxy de imagens do OLX
│   └── cars/
│       ├── index.js           # POST → 503 (use modo local)
│       ├── random.js
│       └── [id]/vote.js
├── lib/
│   ├── store.js               # seletor: file ou kv
│   ├── store-file.js          # local (data.json + watchFile)
│   └── store-kv.js            # produção (Upstash Redis)
├── scripts/
│   └── push-to-kv.js          # sincronização local → Upstash
├── public/                    # frontend
├── server.js                  # Express (dev local — Vercel ignora)
├── scraper.js                 # Playwright + parser OLX
├── seed.js                    # popular base em massa
├── data.json                  # seed commitado
├── vercel.json
└── .env.example
```

---

## 🔌 API

| Método | Rota | Descrição |
|---|---|---|
| POST | `/api/cars` | Cadastra carro (apenas dev local) |
| GET | `/api/cars/random` | Carro aleatório. Query `exclude=1,2,3` |
| POST | `/api/cars/:id/vote` | Vota. Body: `{ type: 'bomba' \| 'bom' }` |
| GET | `/api/ranking` | Top votados. Query `type=bomba\|bom`, `limit=5` |
| GET | `/api/stats` | `{ total, bombas, bons }` |
| GET | `/api/img?u=<URL>` | Proxy de imagens (whitelist OLX/Webmotors) |

---

## ⌨️ Atalhos

| Tecla | Ação |
|---|---|
| `←` | Voto: bomba |
| `→` | Voto: bom carro |
| `↑` ou `Espaço` | Pular |
| `A` / `D` | Foto anterior / próxima |
