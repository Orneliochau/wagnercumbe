# Máquina Oculta — VSL (estático, pronto para Vercel)

Página estática, tudo num único ficheiro HTML (CSS e JS inline). Sem framework, sem dependências, sem build tools externas.
`npm run build` copia `src/` para `dist/` e injecta o Pixel ID / checkout no HTML.

## Estrutura
```
src/index.html          página completa: CSS inline, Pixel no <head>, tracking (Meta CAPI) e
                         contador do VSL inline no final do <body>
src/assets/images/       favicon e imagem do og:image (únicos ficheiros à parte — não fazem
                         sentido inline: favicon é lido pelo browser por URL, og:image precisa
                         de ser uma URL absoluta para os crawlers do Facebook/Twitter)
api/capi.js              função serverless — Meta Conversions API (token só aqui)
scripts/build.mjs        build (sem dependências)
vercel.json              outputDirectory=dist, cabeçalhos de segurança
```

## Variáveis de ambiente (Vercel → Settings → Environment Variables)
| Nome | Onde é usada | Notas |
|---|---|---|
| `META_PIXEL_ID` | build + função | público; em produção o build falha se faltar |
| `META_ACCESS_TOKEN` | só a função `/api/capi` | **secreto** — nunca no código nem no chat |
| `CHECKOUT_URL` | build | URL do novo checkout (para elementos `[data-checkout]`) |
| `META_TEST_EVENT_CODE` | função | opcional, só para testar no Events Manager |

## Deploy sem GitHub (Vercel CLI)
```
npm i -g vercel
vercel login
vercel link
vercel env add META_PIXEL_ID production
vercel env add CHECKOUT_URL production
vercel env add META_ACCESS_TOKEN production   # cole o token no prompt
vercel --prod
```

## Ligar botões de checkout
Qualquer link/botão de compra: `<a data-checkout href="#">Comprar</a>`.
O `href` é preenchido com `CHECKOUT_URL` e o clique dispara `InitiateCheckout` (browser + servidor, mesmo `event_id`).
Eventos manuais: `window.moTrack('Lead', {content_name: '...'})`.
