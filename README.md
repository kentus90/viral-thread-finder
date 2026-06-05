# 🔥 Viral Thread Finder

Trova i thread più virali del web per qualsiasi argomento.

## Deploy su Vercel (5 minuti)

### 1. Crea un account Vercel
Vai su [vercel.com](https://vercel.com) e registrati gratis con GitHub/Google.

### 2. Carica il progetto

**Opzione A — Via browser (più semplice):**
1. Vai su [vercel.com/new](https://vercel.com/new)
2. Clicca "Browse" o trascina questa cartella
3. Vercel rileva tutto automaticamente → clicca **Deploy**

**Opzione B — Via CLI:**
```bash
npm i -g vercel
cd viral-thread-finder-vercel
vercel
```

### 3. Aggiungi la variabile d'ambiente
Dopo il deploy, vai su:
**Project → Settings → Environment Variables**

Aggiungi:
- **Name:** `ANTHROPIC_API_KEY`
- **Value:** `sk-ant-api03-...` (la tua chiave)
- **Environment:** Production ✓

Poi clicca **Redeploy** (Settings → Deployments → tre puntini → Redeploy).

### 4. Apri l'URL su iPhone
Vercel ti dà un URL tipo `https://viral-thread-finder-xxx.vercel.app` — aprilo su qualsiasi dispositivo!

## Struttura
```
├── api/
│   └── search.js       ← Serverless function (proxy Anthropic)
├── public/
│   └── index.html      ← Frontend
├── vercel.json         ← Config routing
└── package.json
```

## Costo
- Vercel: **gratis** (piano Hobby, più che sufficiente)
- Anthropic: ~$0.001-0.002 per ricerca con claude-haiku-4-5
