// El service worker de la app (spec §16), uno solo: agrega COOP/COEP a todas las respuestas
// (técnica de coi-serviceworker) y guarda la app para usarla sin internet. Lo arma el plugin de
// scripts/plugin-pwa.ts como sw.js, con la lista de archivos de esta versión.
import { estrategia, INICIO, paraPrecachear, sobrantes } from './cache';
import { cachePrimero, redPrimero } from './respuestas';

interface EventoExtensible extends Event { waitUntil(p: Promise<unknown>): void }
interface EventoFetch extends EventoExtensible { request: Request; respondWith(r: Promise<Response>): void }
interface AmbitoServicio {
  registration: { scope: string };
  location: Location;
  clients: { claim(): Promise<void> };
  skipWaiting(): Promise<void>;
  addEventListener(tipo: 'install' | 'activate', f: (e: EventoExtensible) => void): void;
  addEventListener(tipo: 'fetch', f: (e: EventoFetch) => void): void;
}

const sw = self as unknown as AmbitoServicio;
/** Los reemplaza el plugin al construir. */
const ARCHIVOS = '__ARCHIVOS__' as unknown as string[];
/** Cambia con cada versión publicada: así cambia sw.js y el navegador instala el nuevo. */
const VERSION = '__VERSION__';
const CACHE = 'dynamis';

const base = sw.registration.scope;
const absoluta = (ruta: string) => new URL(ruta, base).href;
const relativa = (url: string) => (url.startsWith(base) ? url.slice(base.length) || INICIO : url);

sw.addEventListener('install', e => {
  console.info(`Simulador Dynamis: instalando la versión ${VERSION}.`);
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(paraPrecachear(ARCHIVOS).map(absoluta))).then(() => sw.skipWaiting()));
});

sw.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    const guardadas = (await cache.keys()).map(r => relativa(r.url));
    await Promise.all(sobrantes(guardadas, [...ARCHIVOS, INICIO]).map(r => cache.delete(absoluta(r))));
    await sw.clients.claim();
  })());
});

sw.addEventListener('fetch', e => {
  const pedido = e.request;
  const tipo = estrategia({ url: new URL(pedido.url), origen: sw.location.origin, metodo: pedido.method, modo: pedido.mode });
  if (tipo === 'red') return;
  const d = { abrirCache: () => caches.open(CACHE), red: (r: Request) => fetch(r), enSegundoPlano: (p: Promise<unknown>) => e.waitUntil(p) };
  e.respondWith(tipo === 'red-primero' ? redPrimero(pedido, absoluta(INICIO), d) : cachePrimero(pedido, d));
});
