/**
 * Las decisiones del service worker (spec §16), sin APIs del navegador para poder probarlas.
 * Rutas relativas a la carpeta de la app (por ejemplo, 'assets/index-a.js').
 */
const DEL_COMPILADOR = /(^|\/)(llvm[^/]*\.wasm|llvm-resources[^/]*\.tar|nucleo[^/]*\.a)$/;
/** La página de inicio, como la pide el navegador al abrir la app. */
export const INICIO = './';

/** LLVM, sus recursos y el núcleo: unos 105 MB que se guardan recién cuando se usan. */
export const esDelCompilador = (ruta: string): boolean => DEL_COMPILADOR.test(ruta);

/** Lo que se guarda al instalar el service worker: toda la app menos el compilador. */
export function paraPrecachear(archivos: string[]): string[] {
  return [...archivos.filter(a => !esDelCompilador(a)), INICIO];
}

/** Lo guardado que ya no es de esta versión. El compilador se queda si su nombre no cambió. */
export function sobrantes(enCache: string[], vigentes: string[]): string[] {
  const lista = new Set(vigentes);
  return enCache.filter(r => !lista.has(r));
}

/**
 * Las navegaciones van primero a la red, para que una versión nueva llegue apenas se publica; si no
 * hay red, sale la guardada. Lo demás del mismo sitio tiene el nombre con su hash: primero la caché.
 */
export function estrategia(p: { url: URL; origen: string; metodo: string; modo: RequestMode }): 'red-primero' | 'cache-primero' | 'red' {
  if (p.metodo !== 'GET' || p.url.origin !== p.origen) return 'red';
  return p.modo === 'navigate' ? 'red-primero' : 'cache-primero';
}

/** Las cabeceras que habilitan SharedArrayBuffer (técnica de coi-serviceworker). */
export function conAislamiento(h: Headers): Headers {
  const nuevas = new Headers(h);
  nuevas.set('Cross-Origin-Opener-Policy', 'same-origin');
  nuevas.set('Cross-Origin-Embedder-Policy', 'require-corp');
  return nuevas;
}
