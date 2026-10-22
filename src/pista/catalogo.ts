import { ANCHO_CINTA, TAMANO_BALDOSA, type Baldosa, type Lado } from './tipos';

/**
 * Catálogo de piezas (spec §10.3) como listas de figuras en el marco local de la baldosa.
 * Las mismas figuras dibujan la pista en pantalla y son lo que sienten los sensores.
 */
export type RolFigura = 'linea' | 'marca';

/** rect: [u0, u1) × [v0, v1). arco: r0 ≤ d < r1 y a0 ≤ atan2(v − cv, u − cu) ≤ a1. */
export type Figura =
  | { forma: 'rect'; u0: number; v0: number; u1: number; v1: number; rol: RolFigura; color?: string }
  | { forma: 'arco'; cu: number; cv: number; r0: number; r1: number; a0: number; a1: number; rol: RolFigura };

const T = TAMANO_BALDOSA;
const CENTRO = T / 2;
const V0 = CENTRO - ANCHO_CINTA / 2;
const V1 = CENTRO + ANCHO_CINTA / 2;

/** Barra de la meta: la línea perpendicular donde el robot debe detenerse. */
export const BARRA_META = { u0: 140.5, v0: 90, u1: 159.5, v1: 210 };

const rect = (u0: number, v0: number, u1: number, v1: number): Figura => ({ forma: 'rect', u0, v0, u1, v1, rol: 'linea' });
/** Tramo de la línea principal, que va de oeste a este por el centro. */
const tramo = (u0: number, u1: number): Figura => rect(u0, V0, u1, V1);

function guiones(guion: number, espacio: number): Figura[] {
  const figuras: Figura[] = [];
  if (guion <= 0) return figuras;
  const paso = guion + Math.max(espacio, 0);
  for (let u = 0; u < T; u += paso) figuras.push(tramo(u, Math.min(u + guion, T)));
  return figuras;
}

/** Figuras de una pieza, en orden de pintado (la última que contiene un punto es la que se ve). */
export function figurasDe(b: Baldosa, _colorMarcas?: string): Figura[] {
  switch (b.tipo) {
    case 'recta':
    case 'rampa':
      return [tramo(0, T)];
    case 'giroSuave':
      return [{ forma: 'arco', cu: 0, cv: T, r0: V0, r1: V1, a0: -Math.PI / 2, a1: 0, rol: 'linea' }];
    case 'giroL':
      return [tramo(0, V1), rect(V0, V0, V1, T)];
    case 'cortes':
      return guiones(b.props.guion, b.props.espacio);
    case 'partida':
      return [tramo(0, T), rect(281, 90, T, 210)];
    case 'meta':
      return [tramo(0, CENTRO), rect(BARRA_META.u0, BARRA_META.v0, BARRA_META.u1, BARRA_META.v1)];
    default:
      // TODO(Tarea 3): cruce, unionT, indicadorF2 y cuadradoF1.
      return [];
  }
}

/** Bordes locales por donde la línea sale de la pieza. */
export function bocasDe(b: Baldosa): Lado[] {
  switch (b.tipo) {
    case 'recta':
    case 'rampa':
    case 'cortes':
    case 'partida':
      return ['oeste', 'este'];
    case 'giroSuave':
    case 'giroL':
      return ['oeste', 'norte'];
    case 'meta':
      return ['oeste'];
    default:
      // TODO(Tarea 3): cruce, unionT, indicadorF2 y cuadradoF1.
      return [];
  }
}
