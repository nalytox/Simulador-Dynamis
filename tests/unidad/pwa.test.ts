import { it, expect, vi } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { conAislamiento, esDelCompilador, estrategia, paraPrecachear, sobrantes } from '../../src/pwa/cache';
import { prepararAislamiento } from '../../src/pwa/registrar';
import { cachePrimero, redPrimero, type CacheMinima } from '../../src/pwa/respuestas';
import { escucharInstalacion } from '../../src/pwa/instalar';

/** Una caché de mentira y lo que la app manda a hacer en segundo plano. */
function cacheFalsa(o: { guardado?: Response; put?: () => Promise<void>; falla?: boolean } = {}) {
  const puestos: string[] = [];
  const segundoPlano: Promise<unknown>[] = [];
  const cache: CacheMinima = {
    match: async (r: RequestInfo | URL) => (o.guardado && String(r instanceof Request ? r.url : r).endsWith('/') ? o.guardado.clone() : o.guardado?.clone()),
    put: async (r: RequestInfo | URL) => { puestos.push(String(r instanceof Request ? r.url : r)); return o.put ? o.put() : undefined; },
  };
  return {
    puestos, segundoPlano,
    deps: (red: () => Promise<Response>) => ({
      abrirCache: async () => { if (o.falla) throw new Error('sin Cache Storage'); return cache; },
      red,
      enSegundoPlano: (p: Promise<unknown>) => { segundoPlano.push(p); },
    }),
  };
}
const pedido = (ruta: string, modo: RequestMode = 'cors') => Object.assign(new Request(`https://escuela.github.io/Simulador-Dynamis/${ruta}`), { modoPrueba: modo });

it('cachePrimero responde sin esperar a que termine de guardarse (la barra de progreso avanza)', async () => {
  const f = cacheFalsa({ put: () => new Promise(() => {}) });
  const r = await cachePrimero(pedido('assets/llvm.core-a.wasm'), f.deps(async () => new Response('wasm', { status: 200 })));
  expect(await r.text()).toBe('wasm');
  expect(r.headers.get('Cross-Origin-Embedder-Policy')).toBe('require-corp');
  expect(f.segundoPlano).toHaveLength(1);
});

it('cachePrimero no guarda una respuesta que no es 200', async () => {
  for (const status of [206, 404]) {
    const f = cacheFalsa();
    await cachePrimero(pedido('assets/x.js'), f.deps(async () => new Response('', { status })));
    expect(f.puestos, String(status)).toEqual([]);
  }
});

it('cachePrimero sigue con la red si la caché no funciona, y un error al guardar no rompe la respuesta', async () => {
  const sinCache = cacheFalsa({ falla: true });
  expect(await (await cachePrimero(pedido('assets/x.js'), sinCache.deps(async () => new Response('red')))).text()).toBe('red');
  const llena = cacheFalsa({ put: () => Promise.reject(new DOMException('lleno', 'QuotaExceededError')) });
  expect(await (await cachePrimero(pedido('assets/x.js'), llena.deps(async () => new Response('red')))).text()).toBe('red');
  await expect(Promise.all(llena.segundoPlano)).resolves.toBeDefined();
});

it('redPrimero guarda solo páginas HTML como inicio y, sin red, responde la guardada', async () => {
  const f = cacheFalsa();
  const html = await redPrimero(pedido(''), './', f.deps(async () => new Response('<p>app</p>', { headers: { 'Content-Type': 'text/html; charset=utf-8' } })));
  expect(html.headers.get('Cross-Origin-Opener-Policy')).toBe('same-origin');
  await redPrimero(pedido('iconos/mascota.svg'), './', f.deps(async () => new Response('<svg/>', { headers: { 'Content-Type': 'image/svg+xml' } })));
  expect(f.puestos).toEqual(['https://escuela.github.io/Simulador-Dynamis/']);
  const sinRed = cacheFalsa({ guardado: new Response('<p>guardada</p>', { headers: { 'Content-Type': 'text/html' } }) });
  const r = await redPrimero(pedido(''), './', sinRed.deps(async () => { throw new TypeError('Failed to fetch'); }));
  expect(await r.text()).toBe('<p>guardada</p>');
});

it('esDelCompilador reconoce LLVM, sus recursos y el núcleo', () => {
  expect(esDelCompilador('assets/llvm.core-CL0Hro1L.wasm')).toBe(true);
  expect(esDelCompilador('assets/llvm.core2-BFcv-Hg7.wasm')).toBe(true);
  expect(esDelCompilador('assets/llvm-resources-Dw9lbSQw.tar')).toBe(true);
  expect(esDelCompilador('assets/nucleo-DRZKWi8t.a')).toBe(true);
  expect(esDelCompilador('assets/index-CGc4rjVo.js')).toBe(false);
  expect(esDelCompilador('index.html')).toBe(false);
});

it('paraPrecachear deja afuera el compilador y agrega la página de inicio', () => {
  expect(paraPrecachear(['index.html', 'assets/index-a.js', 'assets/llvm.core-b.wasm', 'assets/nucleo-c.a', 'manifest.webmanifest']))
    .toEqual(['index.html', 'assets/index-a.js', 'manifest.webmanifest', './']);
});

it('sobrantes conserva el compilador vigente', () => {
  expect(sobrantes(['assets/llvm.core-A.wasm', 'assets/index-viejo.js'], ['assets/llvm.core-A.wasm', 'assets/index-nuevo.js']))
    .toEqual(['assets/index-viejo.js']);
  expect(sobrantes(['./', 'index.html'], ['index.html', './'])).toEqual([]);
});

it('una navegación usa la red primero', () => {
  const origen = 'https://escuela.github.io';
  const de = (ruta: string, extra: Partial<{ metodo: string; modo: RequestMode; origen: string }> = {}) =>
    estrategia({ url: new URL(ruta, origen), origen: extra.origen ?? origen, metodo: extra.metodo ?? 'GET', modo: extra.modo ?? 'cors' });
  expect(de('/Simulador-Dynamis/', { modo: 'navigate' })).toBe('red-primero');
  expect(de('/Simulador-Dynamis/assets/index-a.js')).toBe('cache-primero');
  expect(de('/Simulador-Dynamis/assets/index-a.js', { metodo: 'POST' })).toBe('red');
  expect(de('/Simulador-Dynamis/assets/index-a.js', { origen: 'https://otro.org' })).toBe('red');
});

it('conAislamiento agrega COOP y COEP sin perder las otras cabeceras', () => {
  const original = new Headers({ 'Content-Type': 'application/wasm', 'Cache-Control': 'max-age=600' });
  const h = conAislamiento(original);
  expect(h.get('Cross-Origin-Opener-Policy')).toBe('same-origin');
  expect(h.get('Cross-Origin-Embedder-Policy')).toBe('require-corp');
  expect(h.get('Content-Type')).toBe('application/wasm');
  expect(h.get('Cache-Control')).toBe('max-age=600');
  expect(original.get('Cross-Origin-Opener-Policy')).toBeNull();
});

function dobles(o: { registrarFalla?: boolean; recargado?: string } = {}) {
  const sesion = new Map<string, string>(o.recargado ? [['dynamis.recargado', o.recargado]] : []);
  const sw = {
    register: vi.fn(async () => {
      if (o.registrarFalla) throw new Error('no');
      return {} as ServiceWorkerRegistration;
    }),
    controller: null,
    ready: Promise.resolve({} as ServiceWorkerRegistration),
  };
  const recargar = vi.fn();
  return { sw, recargar, sesion: { getItem: (k: string) => sesion.get(k) ?? null, setItem: (k: string, v: string) => { sesion.set(k, v); } }, mapa: sesion };
}

it('prepararAislamiento: aislado en producción registra el service worker y sigue', async () => {
  const d = dobles();
  expect(await prepararAislamiento({ aislado: true, produccion: true, sw: d.sw, sesion: d.sesion, recargar: d.recargar })).toBe('listo');
  expect(d.sw.register).toHaveBeenCalledWith('./sw.js');
  expect(d.recargar).not.toHaveBeenCalled();
});

it('prepararAislamiento: en desarrollo no registra nada', async () => {
  const d = dobles();
  expect(await prepararAislamiento({ aislado: true, produccion: false, sw: d.sw, sesion: d.sesion, recargar: d.recargar })).toBe('listo');
  expect(d.sw.register).not.toHaveBeenCalled();
});

it('prepararAislamiento: sin aislamiento y sin service worker no se puede', async () => {
  const d = dobles();
  expect(await prepararAislamiento({ aislado: false, produccion: true, sesion: d.sesion, recargar: d.recargar })).toBe('sin-aislamiento');
  expect(d.recargar).not.toHaveBeenCalled();
});

it('prepararAislamiento: sin aislamiento la primera vez registra, marca la sesión y recarga', async () => {
  const d = dobles();
  expect(await prepararAislamiento({ aislado: false, produccion: true, sw: d.sw, sesion: d.sesion, recargar: d.recargar })).toBe('recargando');
  expect(d.sw.register).toHaveBeenCalledWith('./sw.js');
  expect(d.mapa.get('dynamis.recargado')).toBe('1');
  expect(d.recargar).toHaveBeenCalledTimes(1);
});

it('prepararAislamiento: sin aislamiento después de recargar no recarga otra vez', async () => {
  const d = dobles({ recargado: '1' });
  expect(await prepararAislamiento({ aislado: false, produccion: true, sw: d.sw, sesion: d.sesion, recargar: d.recargar })).toBe('sin-aislamiento');
  expect(d.recargar).not.toHaveBeenCalled();
});

it('prepararAislamiento: si no se puede registrar, explica que no hay aislamiento', async () => {
  const d = dobles({ registrarFalla: true });
  expect(await prepararAislamiento({ aislado: false, produccion: true, sw: d.sw, sesion: d.sesion, recargar: d.recargar })).toBe('sin-aislamiento');
  expect(d.recargar).not.toHaveBeenCalled();
});

it('prepararAislamiento: si el service worker falla al instalarse, no se queda esperando', async () => {
  const d = dobles();
  const trabajador = Object.assign(new EventTarget(), { state: 'installing' });
  d.sw.register = vi.fn(async () => ({ installing: trabajador }) as unknown as ServiceWorkerRegistration);
  (d.sw as { ready: Promise<ServiceWorkerRegistration> }).ready = new Promise(() => {});
  const resultado = prepararAislamiento({ aislado: false, produccion: true, sw: d.sw, sesion: d.sesion, recargar: d.recargar });
  await Promise.resolve();
  trabajador.state = 'redundant';
  trabajador.dispatchEvent(new Event('statechange'));
  expect(await resultado).toBe('sin-aislamiento');
  expect(d.recargar).not.toHaveBeenCalled();
  expect(d.mapa.get('dynamis.recargado')).toBeUndefined();
});

it('prepararAislamiento: si el service worker no se activa a tiempo, no se queda esperando', async () => {
  vi.useFakeTimers();
  try {
    const d = dobles();
    (d.sw as { ready: Promise<ServiceWorkerRegistration> }).ready = new Promise(() => {});
    const resultado = prepararAislamiento({ aislado: false, produccion: true, sw: d.sw, sesion: d.sesion, recargar: d.recargar });
    await vi.advanceTimersByTimeAsync(20_000);
    expect(await resultado).toBe('sin-aislamiento');
    expect(d.recargar).not.toHaveBeenCalled();
  } finally {
    vi.useRealTimers();
  }
});

it('Instalar: si el estudiante cancela el aviso, el botón se oculta (el aviso no se puede volver a pedir)', async () => {
  const ventana = new EventTarget() as unknown as Window;
  const avisos: ((() => Promise<boolean>) | null)[] = [];
  escucharInstalacion(ventana, f => avisos.push(f));
  ventana.dispatchEvent(Object.assign(new Event('beforeinstallprompt', { cancelable: true }), {
    prompt: async () => {}, userChoice: Promise.resolve({ outcome: 'dismissed' }),
  }));
  expect(await avisos[0]!()).toBe(false);
  expect(avisos.at(-1)).toBeNull();
});

/** Ancho y alto de un PNG, del bloque IHDR. */
function medidas(ruta: string): [number, number] {
  const b = readFileSync(ruta);
  expect(b.subarray(1, 4).toString('latin1')).toBe('PNG');
  return [b.readUInt32BE(16), b.readUInt32BE(20)];
}

it('el manifiesto tiene lo que pide la instalación', () => {
  const m = JSON.parse(readFileSync('public/manifest.webmanifest', 'utf8'));
  expect(m).toMatchObject({
    name: 'Simulador Dynamis', short_name: 'Dynamis', lang: 'es-CL', start_url: './', scope: './',
    display: 'standalone', theme_color: '#0B0F98', background_color: '#F4FAFF',
  });
  expect(m.icons).toEqual([
    { src: 'iconos/icono-192.png', sizes: '192x192', type: 'image/png' },
    { src: 'iconos/icono-512.png', sizes: '512x512', type: 'image/png' },
    { src: 'iconos/icono-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
  ]);
  expect(medidas('public/iconos/icono-192.png')).toEqual([192, 192]);
  expect(medidas('public/iconos/icono-512.png')).toEqual([512, 512]);
  expect(medidas('public/iconos/icono-512-maskable.png')).toEqual([512, 512]);
  expect(existsSync('public/iconos/mascota.svg')).toBe(true);
});
