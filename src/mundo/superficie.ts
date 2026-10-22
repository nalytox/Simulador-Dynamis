import { aLocal, celdaDe, crearIndice } from '../pista/baldosas';
import { figurasDe, type Figura } from '../pista/catalogo';
import { COLOR_CINTA, COLOR_FONDO, type Baldosa, type Pista } from '../pista/tipos';

export interface Rgb { r: number; g: number; b: number }

export interface Superficie {
  /** Color 0–255 del suelo en (x, y). */
  color(x: number, y: number): Rgb;
  /** true si (x, y) cae sobre la cinta de la línea (negra, o blanca en una baldosa invertida). */
  esLinea(x: number, y: number): boolean;
}

export function hexARgb(hex: string): Rgb {
  const n = Number.parseInt(hex.slice(1), 16);
  return { r: (n >> 16) & 0xff, g: (n >> 8) & 0xff, b: n & 0xff };
}

function contiene(f: Figura, u: number, v: number): boolean {
  if (f.forma === 'rect') return u >= f.u0 && u < f.u1 && v >= f.v0 && v < f.v1;
  const d = Math.hypot(u - f.cu, v - f.cv);
  if (d < f.r0 || d >= f.r1) return false;
  const a = Math.atan2(v - f.cv, u - f.cu);
  return a >= f.a0 && a <= f.a1;
}

/**
 * Superficie de la pista: evalúa las figuras del catálogo, las mismas que se dibujan en pantalla.
 * Fuera de la grilla y en celdas sin baldosa hay fondo blanco.
 */
export function crearSuperficie(p: Pista): Superficie {
  const indice = crearIndice(p);
  const figuras = new Map<Baldosa, Figura[]>(p.baldosas.map(b => [b, figurasDe(b, p.colorMarcas)]));
  const fondo = hexARgb(COLOR_FONDO);
  const cinta = hexARgb(COLOR_CINTA);
  const colores = new Map<string, Rgb>();
  const colorDe = (hex: string) => {
    let rgb = colores.get(hex);
    if (!rgb) colores.set(hex, (rgb = hexARgb(hex)));
    return rgb;
  };

  /** La baldosa bajo (x, y) y la figura visible en ese punto (null = fondo de la baldosa). */
  const consultar = (x: number, y: number): { baldosa: Baldosa; figura: Figura | null } | null => {
    const { c, r } = celdaDe(x, y);
    const baldosa = indice(c, r);
    if (!baldosa) return null;
    const { u, v } = aLocal(baldosa, x, y);
    const lista = figuras.get(baldosa)!;
    for (let i = lista.length - 1; i >= 0; i--) if (contiene(lista[i], u, v)) return { baldosa, figura: lista[i] };
    return { baldosa, figura: null };
  };

  return {
    color(x, y) {
      const q = consultar(x, y);
      if (!q) return { ...fondo };
      const invertida = q.baldosa.props.invertida;
      const { figura } = q;
      if (figura === null) return { ...(invertida ? cinta : fondo) };
      if (figura.rol === 'linea') return { ...(invertida ? fondo : cinta) };
      return { ...colorDe(figura.forma === 'rect' && figura.color ? figura.color : COLOR_CINTA) };
    },
    esLinea(x, y) {
      return consultar(x, y)?.figura?.rol === 'linea';
    },
  };
}
