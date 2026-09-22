// Build sem dependências: copia src/ para dist/ e injecta configuração pública no HTML.
// Variáveis lidas no build — todas opcionais: META_PIXEL_ID, CHECKOUT_URL, SITE_URL.
// Se estiverem ausentes o build passa na mesma; só falha se o valor dado for inválido.
import { cp, readFile, writeFile, rm, mkdir, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = path.join(root, 'src');
const dist = path.join(root, 'dist');

const pixelId = (process.env.META_PIXEL_ID || '').trim();
const checkoutUrl = (process.env.CHECKOUT_URL || '').trim();

if (pixelId && !/^\d{5,20}$/.test(pixelId)) {
  console.error('META_PIXEL_ID inválido: deve conter apenas dígitos.');
  process.exit(1);
}
if (!pixelId) {
  console.warn('AVISO: META_PIXEL_ID não definido — o Meta Pixel ficará DESACTIVADO nesta build.');
}
if (checkoutUrl) {
  try {
    if (!/^https?:$/.test(new URL(checkoutUrl).protocol)) throw new Error();
  } catch {
    console.error('CHECKOUT_URL inválido: use uma URL completa (https://...).');
    process.exit(1);
  }
}

let siteUrl = (process.env.SITE_URL || '').trim().replace(/\/+$/, '');
if (!siteUrl && process.env.VERCEL_PROJECT_PRODUCTION_URL) siteUrl = 'https://' + process.env.VERCEL_PROJECT_PRODUCTION_URL;

await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });
await cp(src, dist, { recursive: true });

const config = JSON.stringify({ pixelId, checkoutUrl }).replace(/</g, '\\u003c');
const htmlFiles = (await readdir(dist)).filter((f) => f.endsWith('.html'));
for (const name of htmlFiles) {
  const file = path.join(dist, name);
  let html = await readFile(file, 'utf8');
  html = html.replace('/*MO_CONFIG*/{}', config).replaceAll('{{SITE_URL}}', siteUrl);
  await writeFile(file, html);
}

console.log(`Build concluída → dist/  (pixel: ${pixelId ? 'activo' : 'desactivado'}, checkout: ${checkoutUrl ? 'definido' : 'não definido'}, site: ${siteUrl || 'relativo'}, páginas: ${htmlFiles.join(', ')})`);
