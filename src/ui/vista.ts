import { TAMANO_BALDOSA } from '../pista/tipos';

/** Cómo se ve la pista en el lienzo: px = x0 + x · escala, py = y0 − y · escala (la pantalla invierte y). */
export interface Vista { escala: number; x0: number; y0: number }

const MARGEN_PX = 16;
const ZOOM_MAXIMO = 8;

/** Toda la pista centrada, con 16 px de margen. */
export function vistaInicial(anchoPx: number, altoPx: number, columnas: number, filas: number): Vista {
  const ancho = columnas * TAMANO_BALDOSA;
  const alto = filas * TAMANO_BALDOSA;
  const escala = Math.min((anchoPx - 2 * MARGEN_PX) / ancho, (altoPx - 2 * MARGEN_PX) / alto);
  return { escala, x0: (anchoPx - ancho * escala) / 2, y0: (altoPx + alto * escala) / 2 };
}

export function aPantalla(v: Vista, x: number, y: number): { px: number; py: number } {
  return { px: v.x0 + x * v.escala, py: v.y0 - y * v.escala };
}

export function aMundoDesde(v: Vista, px: number, py: number): { x: number; y: number } {
  return { x: (px - v.x0) / v.escala, y: (v.y0 - py) / v.escala };
}

/** Acerca o aleja dejando fijo el punto bajo el cursor; la escala queda entre `minima` y 8 veces `minima`. */
export function acercar(v: Vista, factor: number, px: number, py: number, minima: number): Vista {
  const escala = Math.min(minima * ZOOM_MAXIMO, Math.max(minima, v.escala * factor));
  const fijo = aMundoDesde(v, px, py);
  return { escala, x0: px - fijo.x * escala, y0: py + fijo.y * escala };
}

export function desplazar(v: Vista, dx: number, dy: number): Vista {
  return { ...v, x0: v.x0 + dx, y0: v.y0 + dy };
}
