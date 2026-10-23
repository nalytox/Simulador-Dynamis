const CLAVE = 'dynamis.recargado';

export interface EntornoAislamiento {
  aislado: boolean;
  produccion: boolean;
  sw?: Pick<ServiceWorkerContainer, 'register' | 'ready'>;
  sesion: Pick<Storage, 'getItem' | 'setItem'>;
  recargar(): void;
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
  try {
    await e.sw.register('./sw.js');
    await e.sw.ready;
  } catch {
    return 'sin-aislamiento';
  }
  e.sesion.setItem(CLAVE, '1');
  e.recargar();
  return 'recargando';
}
