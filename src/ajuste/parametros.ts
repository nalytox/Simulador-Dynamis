import type { Ajustable } from '../compilador/ajustables';
import type { ParametroAgente } from './contrato';

/** Grupos de @ajustar con nombre y sensor amigables (spec §11.1); cualquier otro es un "grupo propio". */
export const GRUPOS: { id: string; nombre: string; sensor: string }[] = [
  { id: 'siguelineas', nombre: 'Siguelíneas', sensor: 'QTR-MX-8A' },
  { id: 'giroscopio', nombre: 'Giroscopio', sensor: 'MPU6050' },
  { id: 'distancia', nombre: 'Distancia', sensor: 'VL53L0X' },
  { id: 'posicion', nombre: 'Posición', sensor: 'Posición del robot' },
];

const AYUDAS: Record<string, string> = {
  kp: 'Qué tan fuerte corrige',
  ki: 'Corrige el error que se va acumulando',
  kd: 'Frena los zigzags',
};

export const ayudaDe = (nombre: string): string => AYUDAS[nombre.toLowerCase()] ?? 'Valor ajustable';

/** El rango de la marca; si no tiene, de 0 a 4 veces el valor (decisión 4 de la fase 6). */
export function rangoPorDefecto(a: Ajustable): [number, number] {
  if (a.min !== null && a.max !== null) return [a.min, a.max];
  if (a.valor === 0) return [0, 1];
  const extremo = Number((4 * a.valor).toPrecision(6));
  return a.valor > 0 ? [0, extremo] : [extremo, 0];
}

/**
 * Lo que el estudiante eligió para un valor: si lo ajusta y en qué rango buscar. `base` es el rango
 * por defecto del que partió (el de la marca), para saber si lo cambió en la ventana.
 */
export interface EleccionParametro { id: string; ajustar: boolean; min: number; max: number; base?: [number, number] }

/**
 * Las elecciones para los valores de hoy: se conservan las de los ids que siguen y los nuevos parten
 * encendidos. Un rango que no se tocó en la ventana sigue al de la marca, aunque la marca haya cambiado.
 */
export function elecciones(parametros: Ajustable[], previas: EleccionParametro[]): EleccionParametro[] {
  return parametros.map(p => {
    const base = rangoPorDefecto(p);
    const previa = previas.find(e => e.id === p.id);
    if (!previa) return { id: p.id, ajustar: true, min: base[0], max: base[1], base };
    const sinTocar = previa.base !== undefined && previa.min === previa.base[0] && previa.max === previa.base[1];
    return sinTocar ? { ...previa, min: base[0], max: base[1], base } : { ...previa, base };
  });
}

/** Los parámetros para crearAgente, o el problema que impide empezar a entrenar. */
export function paraElAgente(parametros: Ajustable[], eleccion: EleccionParametro[]):
  { ok: true; parametros: ParametroAgente[] } | { ok: false; problema: string } {
  if (parametros.length === 0) return { ok: false, problema: 'Tu código no tiene valores marcados con @ajustar.' };
  const elegidos = parametros.flatMap(p => {
    const e = eleccion.find(x => x.id === p.id);
    return e?.ajustar ? [{ p, e }] : [];
  });
  if (elegidos.length === 0) return { ok: false, problema: 'Elige al menos un valor para ajustar.' };
  for (const { p, e } of elegidos) {
    if (!(Number.isFinite(e.min) && Number.isFinite(e.max) && e.min < e.max)) {
      return { ok: false, problema: `El rango de ${p.nombre} no sirve: el mínimo debe ser menor que el máximo.` };
    }
  }
  return { ok: true, parametros: elegidos.map(({ p, e }) => ({ id: p.id, grupo: p.grupo, nombre: p.nombre, valor: p.valor, entero: p.entero, min: e.min, max: e.max })) };
}
