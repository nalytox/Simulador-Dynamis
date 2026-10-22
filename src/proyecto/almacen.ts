import type { Proyecto } from './proyecto';
import type { Pista } from '../pista/tipos';

/** Autoguardado en IndexedDB (spec §13): el proyecto, la pista y las preferencias. */
export interface Preferencias { velocidad: number; archivoAbierto?: string }
export interface DatosGuardados { proyecto: Proyecto; pista: Pista; preferencias: Preferencias }

export interface Almacen {
  leer<K extends keyof DatosGuardados>(clave: K): Promise<DatosGuardados[K] | undefined>;
  guardar<K extends keyof DatosGuardados>(clave: K, valor: DatosGuardados[K]): Promise<void>;
}

const BASE = 'simulador-dynamis';
const ALMACEN = 'datos';

function esperar<T>(pedido: IDBRequest<T>): Promise<T> {
  return new Promise((resolver, rechazar) => {
    pedido.onsuccess = () => resolver(pedido.result);
    pedido.onerror = () => rechazar(pedido.error);
  });
}

/** null si el navegador no deja usar IndexedDB (ventana privada, cuota llena…): la app sigue sin autoguardado. */
export async function abrirAlmacen(fabrica: IDBFactory | undefined = globalThis.indexedDB): Promise<Almacen | null> {
  if (!fabrica) return null;
  try {
    const db = await new Promise<IDBDatabase>((resolver, rechazar) => {
      const pedido = fabrica.open(BASE, 1);
      pedido.onupgradeneeded = () => pedido.result.createObjectStore(ALMACEN);
      pedido.onsuccess = () => resolver(pedido.result);
      pedido.onerror = () => rechazar(pedido.error);
      pedido.onblocked = () => rechazar(new Error('IndexedDB bloqueada'));
    });
    return {
      leer: clave => esperar(db.transaction(ALMACEN).objectStore(ALMACEN).get(clave)),
      guardar: async (clave, valor) => { await esperar(db.transaction(ALMACEN, 'readwrite').objectStore(ALMACEN).put(valor, clave)); },
    };
  } catch {
    return null;
  }
}

/** Junta varias llamadas seguidas en una sola, `ms` después de la última. */
export function conRetardo<A extends unknown[]>(f: (...a: A) => void, ms = 500): (...a: A) => void {
  let espera: ReturnType<typeof setTimeout> | null = null;
  return (...a: A) => {
    if (espera !== null) clearTimeout(espera);
    espera = setTimeout(() => { espera = null; f(...a); }, ms);
  };
}
