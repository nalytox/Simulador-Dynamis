import { it, expect, vi } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { conAislamiento, esDelCompilador, estrategia, paraPrecachear, sobrantes } from '../../src/pwa/cache';
import { prepararAislamiento } from '../../src/pwa/registrar';

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
