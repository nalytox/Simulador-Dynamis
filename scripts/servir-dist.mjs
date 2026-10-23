// Sirve dist/ en /Simulador-Dynamis/ como GitHub Pages: archivos estáticos y SIN las cabeceras
// COOP/COEP, para probar que el service worker aísla la página solo.
// Uso: node scripts/servir-dist.mjs dist 5180
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';

const [carpeta = 'dist', puerto = '5180'] = process.argv.slice(2);
const RAIZ = resolve(carpeta);
const PREFIJO = '/Simulador-Dynamis/';
const TIPOS = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.webmanifest': 'application/manifest+json', '.wasm': 'application/wasm', '.tar': 'application/x-tar',
  '.a': 'application/octet-stream', '.woff2': 'font/woff2', '.woff': 'font/woff', '.png': 'image/png', '.svg': 'image/svg+xml',
};

createServer(async (pedido, respuesta) => {
  const ruta = decodeURIComponent(new URL(pedido.url ?? '/', 'http://x').pathname);
  if (!ruta.startsWith(PREFIJO)) {
    respuesta.writeHead(404).end('No está aquí.');
    return;
  }
  let archivo = normalize(join(RAIZ, ruta.slice(PREFIJO.length)));
  if (!archivo.startsWith(RAIZ)) {
    respuesta.writeHead(403).end();
    return;
  }
  try {
    if ((await stat(archivo)).isDirectory()) archivo = join(archivo, 'index.html');
    const cuerpo = await readFile(archivo);
    respuesta.writeHead(200, { 'Content-Type': TIPOS[extname(archivo)] ?? 'application/octet-stream', 'Cache-Control': 'no-cache' }).end(cuerpo);
  } catch {
    respuesta.writeHead(404).end('No existe.');
  }
}).listen(Number(puerto), () => console.log(`dist/ en http://localhost:${puerto}${PREFIJO}`));
