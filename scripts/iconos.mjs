// Hace los íconos de la app (PWA) desde la mascota de index.html. Se corre una vez y los
// archivos quedan en public/iconos/: node scripts/iconos.mjs
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { chromium } from '@playwright/test';

const html = readFileSync('index.html', 'utf8');
const simbolo = html.match(/<symbol id="mascota" viewBox="0 0 64 64">([\s\S]*?)<\/symbol>/);
if (!simbolo) throw new Error('No encontré la mascota en index.html.');
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">${simbolo[1].trim()}</svg>\n`;
writeFileSync('public/iconos/mascota.svg', svg);

const CHROMIUM_LOCAL = '/opt/pw-browsers/chromium';
const navegador = await chromium.launch({ executablePath: existsSync(CHROMIUM_LOCAL) ? CHROMIUM_LOCAL : undefined });
const pagina = await navegador.newPage();

/** La mascota en un cuadrado de `lado` px; `margen` es la fracción libre en cada borde. */
async function icono(archivo, lado, { fondo = 'transparent', margen = 0.04 } = {}) {
  await pagina.setViewportSize({ width: lado, height: lado });
  const adentro = Math.round(lado * (1 - 2 * margen));
  await pagina.setContent(`<body style="margin:0;width:${lado}px;height:${lado}px;display:grid;place-items:center;background:${fondo}">
    <div style="width:${adentro}px;height:${adentro}px">${svg.replace('<svg ', '<svg width="100%" height="100%" ')}</div></body>`);
  writeFileSync(archivo, await pagina.screenshot({ omitBackground: fondo === 'transparent' }));
}

await icono('public/iconos/icono-192.png', 192);
await icono('public/iconos/icono-512.png', 512);
// Un ícono "maskable" puede recortarse en círculo: la mascota queda dentro del 80 % central.
await icono('public/iconos/icono-512-maskable.png', 512, { fondo: '#F4FAFF', margen: 0.16 });
await navegador.close();
console.log('Íconos listos en public/iconos/.');
