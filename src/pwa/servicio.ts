// El service worker de la app (spec §16), uno solo: agrega COOP/COEP a todas las respuestas
// (técnica de coi-serviceworker) y guarda la app para usarla sin internet. Lo arma el plugin de
// scripts/plugin-pwa.ts como sw.js, con la lista de archivos de esta versión.
import { conAislamiento, estrategia, INICIO, paraPrecachear, sobrantes } from './cache';

interface EventoExtensible extends Event { waitUntil(p: Promise<unknown>): void }
interface EventoFetch extends Event { request: Request; respondWith(r: Promise<Response>): void }
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
const VERSION = '__VERSION__';
const CACHE = 'dynamis';

const base = sw.registration.scope;
const absoluta = (ruta: string) => new URL(ruta, base).href;
const relativa = (url: string) => (url.startsWith(base) ? url.slice(base.length) || INICIO : url);

/** Una respuesta con las cabeceras de aislamiento (una respuesta opaca no se puede tocar). */
function aislada(r: Response): Response {
  if (r.type === 'opaque' || r.status === 0) return r;
  return new Response(r.body, { status: r.status, statusText: r.statusText, headers: conAislamiento(r.headers) });
}

sw.addEventListener('install', e => {
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
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    if (tipo === 'red-primero') {
      try {
        const respuesta = await fetch(pedido);
        if (respuesta.ok) await cache.put(absoluta(INICIO), respuesta.clone());
        return aislada(respuesta);
      } catch {
        const guardada = (await cache.match(pedido, { ignoreSearch: true })) ?? (await cache.match(absoluta(INICIO)));
        if (guardada) return aislada(guardada);
        throw new Error(`Sin conexión y sin una copia guardada (versión ${VERSION}).`);
      }
    }
    const guardada = await cache.match(pedido, { ignoreSearch: true });
    if (guardada) return aislada(guardada);
    const respuesta = await fetch(pedido);
    if (respuesta.ok && respuesta.type === 'basic') await cache.put(pedido, respuesta.clone());
    return aislada(respuesta);
  })());
});
