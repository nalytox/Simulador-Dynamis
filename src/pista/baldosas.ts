import { TAMANO_BALDOSA, type Baldosa, type Lado, type Pista, type Rotacion } from './tipos';

/**
 * Transformaciones entre el marco del mundo y el marco local de una baldosa: u de 0 a 300 desde
 * el borde de entrada (oeste) y v de 0 a 300 hacia el norte. rot gira la pieza en sentido
 * antihorario alrededor de su centro.
 */
export type Ubicacion = { c: number; r: number; rot: Rotacion };

const MEDIO = TAMANO_BALDOSA / 2;
/** cos y sin exactos de cada rotación, para no arrastrar ruido de punto flotante. */
const COS_SIN: Record<Rotacion, [number, number]> = { 0: [1, 0], 90: [0, 1], 180: [-1, 0], 270: [0, -1] };
/** Bordes en sentido antihorario: girar 90° avanza un lugar. */
const LADOS_ANTIHORARIO: readonly Lado[] = ['este', 'norte', 'oeste', 'sur'];

export function aMundo(b: Ubicacion, u: number, v: number): { x: number; y: number } {
  const [c, s] = COS_SIN[b.rot];
  const du = u - MEDIO;
  const dv = v - MEDIO;
  return { x: b.c * TAMANO_BALDOSA + MEDIO + du * c - dv * s, y: b.r * TAMANO_BALDOSA + MEDIO + du * s + dv * c };
}

export function aLocal(b: Ubicacion, x: number, y: number): { u: number; v: number } {
  const [c, s] = COS_SIN[b.rot];
  const dx = x - (b.c * TAMANO_BALDOSA + MEDIO);
  const dy = y - (b.r * TAMANO_BALDOSA + MEDIO);
  return { u: MEDIO + dx * c + dy * s, v: MEDIO - dx * s + dy * c };
}

/** En qué borde del mundo queda un borde local de la baldosa. */
export function ladoEnMundo(b: Ubicacion, lado: Lado): Lado {
  return LADOS_ANTIHORARIO[(LADOS_ANTIHORARIO.indexOf(lado) + b.rot / 90) % 4];
}

/** Celda de la grilla que contiene (x, y); un punto en el borde pertenece a la celda siguiente. */
export function celdaDe(x: number, y: number): { c: number; r: number } {
  return { c: Math.floor(x / TAMANO_BALDOSA), r: Math.floor(y / TAMANO_BALDOSA) };
}

/** Búsqueda rápida de la baldosa en (c, r); null si la celda está vacía o fuera de la grilla. */
export function crearIndice(p: Pista): (c: number, r: number) => Baldosa | null {
  const celdas: (Baldosa | null)[] = new Array(p.columnas * p.filas).fill(null);
  for (const b of p.baldosas) celdas[b.r * p.columnas + b.c] = b;
  return (c, r) => (c >= 0 && r >= 0 && c < p.columnas && r < p.filas ? celdas[r * p.columnas + c] : null);
}
