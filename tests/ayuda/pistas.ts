import { normalizarPista } from '../../src/pista/serializacion';
import type { Pista } from '../../src/pista/tipos';

/** Arma una pista de prueba completando los campos obligatorios; lanza si no es válida. */
export function pistaDe(datos: Record<string, unknown>): Pista {
  const r = normalizarPista({
    version: 1, nombre: 'prueba', tamanoBaldosa: 300, ambiente: { luz: 'normal' },
    baldosas: [], objetos: [], inicio: { x: 150, y: 150, yaw: 0 }, ...datos,
  });
  if (!r.ok) throw new Error(r.errores.join('\n'));
  return r.pista;
}
