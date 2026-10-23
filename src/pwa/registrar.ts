const CLAVE = 'dynamis.recargado';
/** Lo más que se espera a que el service worker se active la primera vez (descarga ~2 MB de la app). */
const ESPERA_POR_DEFECTO_MS = 20_000;

export interface EntornoAislamiento {
  aislado: boolean;
  produccion: boolean;
  sw?: Pick<ServiceWorkerContainer, 'register' | 'ready'>;
  sesion: Pick<Storage, 'getItem' | 'setItem'>;
  recargar(): void;
  esperaMs?: number;
}

/**
 * `ready` no termina nunca si la instalación falla (un archivo que no bajó, wifi inestable): se espera
 * a que el service worker quede activo, a que se descarte (redundant) o a que pase el tiempo.
 */
function activado(registro: ServiceWorkerRegistration | undefined, ready: Promise<unknown>, esperaMs: number): Promise<boolean> {
  return new Promise(resolver => {
    const instalando = registro?.installing;
    instalando?.addEventListener('statechange', () => { if (instalando.state === 'redundant') resolver(false); });
    setTimeout(() => resolver(false), esperaMs);
    ready.then(() => resolver(true), () => resolver(false));
  });
}

/**
 * Antes de arrancar la app (spec §16): en la versión publicada registra el service worker. Si la
 * página todavía no está aislada (GitHub Pages no manda COOP/COEP), recarga una vez para que el
 * service worker agregue esas cabeceras; si ni así, la app explica que hay que usar otro navegador.
 */
export async function prepararAislamiento(e: EntornoAislamiento): Promise<'listo' | 'recargando' | 'sin-aislamiento'> {
  if (e.aislado) {
    if (e.produccion) e.sw?.register('./sw.js').catch(() => {});
    return 'listo';
  }
  if (!e.produccion || !e.sw || e.sesion.getItem(CLAVE) === '1') return 'sin-aislamiento';
  let registro: ServiceWorkerRegistration | undefined;
  try {
    registro = await e.sw.register('./sw.js');
  } catch {
    return 'sin-aislamiento';
  }
  if (!(await activado(registro, e.sw.ready, e.esperaMs ?? ESPERA_POR_DEFECTO_MS))) return 'sin-aislamiento';
  e.sesion.setItem(CLAVE, '1');
  e.recargar();
  return 'recargando';
}
