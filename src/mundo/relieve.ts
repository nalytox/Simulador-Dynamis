import { aLocal, celdaDe, crearIndice } from '../pista/baldosas';
import { gradosARadianes } from '../pista/serializacion';
import type { Bache, Baldosa, Pista } from '../pista/tipos';

/**
 * Relieve analítico de la pista (spec §10.4): nivel de cada baldosa, subida de las rampas y
 * perfil de medio cilindro de los baches. No usa un raster.
 */
export interface Relieve {
  /** Altura del suelo en mm. */
  altura(x: number, y: number): number;
  /** Pendiente del suelo (mm/mm) hacia +x y hacia +y. */
  gradiente(x: number, y: number): { dx: number; dy: number };
  /** Inclinación de un robot con rumbo yaw (rad): pitch < 0 con la nariz arriba, roll > 0 con el lado izquierdo arriba (REP-103). */
  inclinacion(x: number, y: number, yaw: number): { pitch: number; roll: number };
}

const DELTA = 0.5;
/** Las pruebas comparan con toEqual, que distingue −0 de 0. */
const sinMenosCero = (x: number) => (x === 0 ? 0 : x);

/** Altura de una baldosa en su marco local: su nivel, más la subida si es una rampa (sube hacia +u). */
export function alturaBaldosa(b: Baldosa, u: number, _v: number): number {
  return b.tipo === 'rampa' ? b.nivel + u * Math.tan(gradosARadianes(b.props.angulo)) : b.nivel;
}

export function crearRelieve(p: Pista): Relieve {
  const indice = crearIndice(p);
  const baches = p.objetos
    .filter((o): o is Bache => o.tipo === 'bache')
    .map(b => {
      const angulo = gradosARadianes(b.rot);
      return { x: b.x, y: b.y, cos: Math.cos(angulo), sin: Math.sin(angulo), medioLargo: b.props.largo / 2, radio: b.props.radio };
    });

  const altura = (x: number, y: number): number => {
    const { c, r } = celdaDe(x, y);
    const baldosa = indice(c, r);
    let h = 0;
    if (baldosa) {
      const { u, v } = aLocal(baldosa, x, y);
      h = alturaBaldosa(baldosa, u, v);
    }
    for (const k of baches) {
      const dx = x - k.x;
      const dy = y - k.y;
      const a = dx * k.cos + dy * k.sin;
      const d = -dx * k.sin + dy * k.cos;
      if (Math.abs(a) <= k.medioLargo && Math.abs(d) < k.radio) h += Math.sqrt(k.radio * k.radio - d * d);
    }
    return h;
  };

  const gradiente = (x: number, y: number) => ({
    dx: sinMenosCero((altura(x + DELTA, y) - altura(x - DELTA, y)) / (2 * DELTA)),
    dy: sinMenosCero((altura(x, y + DELTA) - altura(x, y - DELTA)) / (2 * DELTA)),
  });

  const inclinacion = (x: number, y: number, yaw: number) => {
    const { dx, dy } = gradiente(x, y);
    const adelante = dx * Math.cos(yaw) + dy * Math.sin(yaw);
    const izquierda = -dx * Math.sin(yaw) + dy * Math.cos(yaw);
    return {
      pitch: sinMenosCero(-Math.atan(adelante)),
      roll: sinMenosCero(Math.asin(izquierda / Math.sqrt(1 + adelante * adelante + izquierda * izquierda))),
    };
  };

  return { altura, gradiente, inclinacion };
}
