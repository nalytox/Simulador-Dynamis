/**
 * Modelo de una pista Rescue Line FIRVI.
 * Unidades: mm. Los ángulos del JSON (rot, yaw, angulo) van en grados; el simulador usa radianes.
 * La fila r cuenta desde abajo: la baldosa (c, r) ocupa x ∈ [c·300, c·300 + 300), y ∈ [r·300, r·300 + 300).
 */
export const TAMANO_BALDOSA = 300;
export const ANCHO_CINTA = 19;
export const COLOR_FONDO = '#FFFFFF';
export const COLOR_CINTA = '#000000';
export const COLOR_MARCA = '#00A651';

export type Luz = 'normal' | 'fuerte' | 'tenue';
export type Rotacion = 0 | 90 | 180 | 270;
/** Bordes de una baldosa en su marco local: el robot entra por el oeste y la izquierda es el norte. */
export type Lado = 'oeste' | 'este' | 'norte' | 'sur';
export type Accion = 'izq' | 'der' | 'recto' | 'vuelta';
/** Marcas de color: antes (a) o después (d) del cruce, a la izquierda (i) o a la derecha (d). */
export type Marcas = { ai: boolean; ad: boolean; di: boolean; dd: boolean };

type Base<T extends string, P> = {
  c: number; r: number; rot: Rotacion; nivel: number; tipo: T; props: { invertida: boolean } & P;
};

export type Baldosa =
  | Base<'vacia' | 'recta' | 'giroSuave' | 'giroL' | 'partida' | 'meta', {}>
  | Base<'cortes', { guion: number; espacio: number }>
  | Base<'cruce', { marcas: Marcas; colorMarca?: string; accion?: Accion }>
  | Base<'unionT', { marcas: Marcas; colorMarca?: string; accion?: Accion; rama: 'izq' | 'der' }>
  | Base<'rampa', { angulo: number }>
  | Base<'indicadorF2', { decisiones: ('izq' | 'der')[] }>
  | Base<'cuadradoF1', { correcto: 'izq' | 'der' }>;

export type TipoBaldosa = Baldosa['tipo'];

// Alias de tipo (no interfaces) para que sean asignables al ObjetoPista genérico de src/mundo/tipos.ts.
export type Obstaculo = { tipo: 'obstaculo'; x: number; y: number; rot: number; props: { ancho: number; largo: number; alto: number } };
export type Bache = { tipo: 'bache'; x: number; y: number; rot: number; props: { largo: number; radio: number } };
export type Hito = { tipo: 'hito'; x: number; y: number; rot: number; props: { numero: number; yaw: number } };
/** Dónde empieza un desafío (F1, F2, F4…): punto de partida elegible. hitoSiguiente: el hito que viene después (n + 1 = la meta). */
export type Desafio = { tipo: 'desafio'; x: number; y: number; rot: number; props: { nombre: string; yaw: number; hitoSiguiente: number } };
export type ObjetoDePista = Obstaculo | Bache | Hito | Desafio;

export interface Pista {
  version: 1;
  nombre: string;
  tamanoBaldosa: 300;
  columnas: number;
  filas: number;
  ambiente: { luz: Luz };
  /** Color de las marcas de toda la pista; cada cruce puede tener el suyo. */
  colorMarcas?: string;
  baldosas: Baldosa[];
  objetos: ObjetoDePista[];
  inicio: { x: number; y: number; yaw: number };
}
