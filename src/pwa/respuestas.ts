import { conAislamiento } from './cache';

/** Lo que el service worker usa de una caché (Cache Storage), para poder probarlo con una de mentira. */
export interface CacheMinima {
  match(r: RequestInfo | URL, o?: CacheQueryOptions): Promise<Response | undefined>;
  put(r: RequestInfo | URL, resp: Response): Promise<void>;
}

export interface DependenciasRespuesta {
  abrirCache(): Promise<CacheMinima>;
  red(r: Request): Promise<Response>;
  /** Trabajo que sigue después de responder (event.waitUntil en el service worker). */
  enSegundoPlano(p: Promise<unknown>): void;
}

/** Una respuesta con las cabeceras de aislamiento (una respuesta opaca no se puede tocar). */
export function aislada(r: Response): Response {
  if (r.type === 'opaque' || r.status === 0) return r;
  return new Response(r.body, { status: r.status, statusText: r.statusText, headers: conAislamiento(r.headers) });
}

async function abrir(d: DependenciasRespuesta): Promise<CacheMinima | null> {
  try {
    return await d.abrirCache();
  } catch {
    return null;
  }
}

/** Guarda una copia sin hacer esperar la respuesta: la página lee el cuerpo mientras llega (y la barra de progreso avanza). */
function guardarDespues(d: DependenciasRespuesta, cache: CacheMinima | null, clave: RequestInfo | URL, r: Response): void {
  if (!cache || r.status !== 200) return;
  d.enSegundoPlano(cache.put(clave, r.clone()).catch(() => {}));
}

/**
 * Los archivos con hash en el nombre (y el compilador): la copia guardada si hay; si no, la red, y se
 * guarda en segundo plano. Si la caché no funciona (modo invitado, disco lleno), igual responde la red.
 */
export async function cachePrimero(pedido: Request, d: DependenciasRespuesta): Promise<Response> {
  const cache = await abrir(d);
  try {
    const guardada = await cache?.match(pedido, { ignoreSearch: true });
    if (guardada) return aislada(guardada);
  } catch {
    // Una caché que falla al leer es como no tenerla.
  }
  const respuesta = await d.red(pedido);
  guardarDespues(d, cache, pedido, respuesta);
  return aislada(respuesta);
}

/**
 * Las navegaciones: primero la red, para que una versión nueva llegue apenas se publica. Una página
 * HTML se guarda como la de inicio; sin red, responde la guardada.
 */
export async function redPrimero(pedido: Request, inicio: string, d: DependenciasRespuesta): Promise<Response> {
  try {
    const respuesta = await d.red(pedido);
    if (respuesta.headers.get('Content-Type')?.startsWith('text/html')) guardarDespues(d, await abrir(d), new URL(inicio, pedido.url).href, respuesta);
    return aislada(respuesta);
  } catch (e) {
    const cache = await abrir(d);
    const guardada = (await cache?.match(pedido, { ignoreSearch: true }).catch(() => undefined))
      ?? (await cache?.match(new URL(inicio, pedido.url).href).catch(() => undefined));
    if (guardada) return aislada(guardada);
    throw e;
  }
}
