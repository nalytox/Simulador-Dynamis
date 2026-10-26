import { aLocal, celdaDe, ladoEnMundo } from './baldosas';
import { alturaBaldosa } from '../mundo/relieve';
import { gradosARadianes, normalizarPista } from './serializacion';
import { TAMANO_BALDOSA, type Baldosa, type Lado, type ObjetoDePista, type Pista, type Rotacion, type TipoBaldosa } from './tipos';

/**
 * Edición de la pista para el editor: funciones puras que devuelven una pista nueva
 * sin tocar la original. Los ángulos van en grados, como en el JSON.
 */
export type TipoObjetoNuevo = 'obstaculo' | 'bache-recto' | 'bache-diagonal' | 'hito' | 'desafio';

export const COLUMNAS = { min: 2, max: 16 };
export const FILAS = { min: 2, max: 12 };
/** Los objetos y el inicio se ubican en pasos de 1 cm. */
const PASO_MM = 10;
const MEDIO = TAMANO_BALDOSA / 2;
const VECINO: Record<Lado, [number, number]> = { este: [1, 0], oeste: [-1, 0], norte: [0, 1], sur: [0, -1] };
/** Una baldosa cuyo borde está a menos de esto de la parte alta de una rampa se considera subida por ella (mm). */
const TOLERANCIA_MM = 0.5;

const ajustar = (mm: number) => Math.round(mm / PASO_MM) * PASO_MM;
const acotar = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));
const girar = (grados: number, delta: number) => (((grados + delta) % 360) + 360) % 360;
const enCelda = (c: number, r: number) => (b: Baldosa) => b.c === c && b.r === r;

/** Propiedades completas de una baldosa: las dadas más las por defecto de la lectura del JSON. */
function propsCompletas(tipo: TipoBaldosa, props: Record<string, unknown>): Baldosa['props'] | null {
  const r = normalizarPista({
    version: 1, nombre: '', tamanoBaldosa: TAMANO_BALDOSA, columnas: 1, filas: 1, inicio: { x: 0, y: 0 },
    baldosas: [{ c: 0, r: 0, tipo, props }],
  });
  return r.ok ? r.pista.baldosas[0].props : null;
}

export function baldosaEn(p: Pista, c: number, r: number): Baldosa | null {
  return p.baldosas.find(enCelda(c, r)) ?? null;
}

/** Cuánto sube una rampa de punta a punta (mm); 0 si la baldosa no es una rampa. */
export function subidaRampa(b: Baldosa): number {
  return b.tipo === 'rampa' ? TAMANO_BALDOSA * Math.tan(gradosARadianes(b.props.angulo)) : 0;
}

type Celda = { c: number; r: number };

/** La celda hacia donde sube una rampa y el punto medio del borde que comparten. */
function arribaDe(rampa: Baldosa): Celda & { x: number; y: number } {
  const [dc, dr] = VECINO[ladoEnMundo(rampa, 'este')];
  return { c: rampa.c + dc, r: rampa.r + dr, x: (rampa.c + 0.5 + dc / 2) * TAMANO_BALDOSA, y: (rampa.r + 0.5 + dr / 2) * TAMANO_BALDOSA };
}

/** Cuánto está el suelo de la baldosa por sobre su nivel en el punto (x, y) de su borde. */
function sobreNivelEn(b: Baldosa, x: number, y: number): number {
  const { u, v } = aLocal(b, x, y);
  return alturaBaldosa(b, acotar(u, 0, TAMANO_BALDOSA), acotar(v, 0, TAMANO_BALDOSA)) - b.nivel;
}

/** El nivel que deja el borde de `b` a la altura de la parte alta de `rampa` (en su borde común). */
function nivelJuntoA(rampa: Baldosa, b: Baldosa): number {
  const borde = arribaDe(rampa);
  return rampa.nivel + subidaRampa(rampa) - sobreNivelEn(b, borde.x, borde.y);
}

/**
 * Continuidad de las rampas (§10.4): la baldosa que sigue a una rampa en la dirección de subida
 * queda con su borde a la altura de la parte alta. Si esa también es una rampa, sigue con la
 * próxima; se detiene al volver a una celda ya vista (dos rampas enfrentadas forman un pico).
 */
function conRampasContinuas(baldosas: Baldosa[], desde: Baldosa): Baldosa[] {
  const resultado = [...baldosas];
  const vistas = new Set<string>();
  let actual = desde;
  while (actual.tipo === 'rampa') {
    vistas.add(`${actual.c},${actual.r}`);
    const arriba = arribaDe(actual);
    if (vistas.has(`${arriba.c},${arriba.r}`)) break;
    const i = resultado.findIndex(enCelda(arriba.c, arriba.r));
    if (i < 0) break;
    resultado[i] = { ...resultado[i], nivel: nivelJuntoA(actual, resultado[i]) } as Baldosa;
    actual = resultado[i];
  }
  return resultado;
}

function conBaldosa(p: Pista, b: Baldosa): Pista {
  const resto = p.baldosas.filter(o => !enCelda(b.c, b.r)(o));
  return { ...p, baldosas: conRampasContinuas([...resto, b], b) };
}

/** La rampa que sube hacia la celda de `b`, si hay una. */
function rampaHacia(p: Pista, b: Celda): Baldosa | null {
  return p.baldosas.find(o => {
    if (o.tipo !== 'rampa') return false;
    const arriba = arribaDe(o);
    return arriba.c === b.c && arriba.r === b.r;
  }) ?? null;
}

/** El nivel para una pieza nueva en una celda a la que sube una rampa, si hay una. */
function nivelAlFinalDeRampa(p: Pista, b: Baldosa): number | null {
  const rampa = rampaHacia(p, b);
  return rampa ? nivelJuntoA(rampa, b) : null;
}

/**
 * Antes de girar una rampa: la baldosa que tenía arriba vuelve a la altura de su parte baja, si
 * seguía a la altura de su parte alta (si el estudiante le puso otra altura, no se toca).
 */
function sinLoQueSubio(p: Pista, rampa: Baldosa): Pista {
  if (rampa.tipo !== 'rampa') return p;
  const arriba = arribaDe(rampa);
  const b = baldosaEn(p, arriba.c, arriba.r);
  if (!b || Math.abs(b.nivel - nivelJuntoA(rampa, b)) > TOLERANCIA_MM) return p;
  const bajada = { ...b, nivel: b.nivel - subidaRampa(rampa) } as Baldosa;
  return { ...p, baldosas: p.baldosas.map(o => (o === b ? bajada : o)) };
}

/**
 * Pone una pieza en (c, r). Si ya había una baldosa, la reemplaza y conserva su nivel; si no, y una
 * rampa sube hacia esa celda, la pieza queda al nivel de la parte alta de la rampa.
 */
export function colocarBaldosa(p: Pista, c: number, r: number, tipo: TipoBaldosa, rot: Rotacion = 0, props: Record<string, unknown> = {}): Pista {
  const completas = propsCompletas(tipo, props) ?? propsCompletas(tipo, {})!;
  const nueva = { c, r, rot, nivel: 0, tipo, props: completas } as Baldosa;
  nueva.nivel = baldosaEn(p, c, r)?.nivel ?? nivelAlFinalDeRampa(p, nueva) ?? 0;
  return conBaldosa(p, nueva);
}

/** sentido 1: 90° antihorario; -1: 90° horario. */
export function girarBaldosa(p: Pista, c: number, r: number, sentido: 1 | -1): Pista {
  const b = baldosaEn(p, c, r);
  if (!b) return p;
  const girada = { ...b, rot: girar(b.rot, 90 * sentido) as Rotacion } as Baldosa;
  const sinSubida = sinLoQueSubio(p, b);
  // Una rampa girada cambia la altura de su borde: si otra rampa sube hacia ella, se vuelve a ajustar a esa.
  const anterior = girada.tipo === 'rampa' ? rampaHacia(sinSubida, girada) : null;
  if (anterior) girada.nivel = nivelJuntoA(anterior, girada);
  return conBaldosa(sinSubida, girada);
}

export function vaciarCelda(p: Pista, c: number, r: number): Pista {
  return { ...p, baldosas: p.baldosas.filter(b => !enCelda(c, r)(b)) };
}

export function cambiarBaldosa(p: Pista, c: number, r: number, cambios: { nivel?: number; props?: Record<string, unknown> }): Pista {
  const b = baldosaEn(p, c, r);
  if (!b) return p;
  const props = cambios.props ? propsCompletas(b.tipo, { ...b.props, ...cambios.props }) ?? b.props : b.props;
  return conBaldosa(p, { ...b, nivel: cambios.nivel ?? b.nivel, props } as Baldosa);
}

/** La dirección de la línea bajo (x, y): el rot de la baldosa, o 0 si no hay baldosa. */
function direccionEn(p: Pista, x: number, y: number): number {
  const { c, r } = celdaDe(x, y);
  return baldosaEn(p, c, r)?.rot ?? 0;
}

function objetoNuevo(p: Pista, tipo: TipoObjetoNuevo, x: number, y: number): ObjetoDePista {
  const direccion = direccionEn(p, x, y);
  switch (tipo) {
    case 'obstaculo':
      return { tipo: 'obstaculo', x, y, rot: 0, props: { ancho: 100, largo: 100, alto: 100 } };
    case 'bache-recto':
      return { tipo: 'bache', x, y, rot: girar(direccion, 90), props: { largo: 300, radio: 6 } };
    case 'bache-diagonal':
      return { tipo: 'bache', x, y, rot: girar(direccion, 45), props: { largo: 300, radio: 6 } };
    case 'hito':
      return { tipo: 'hito', x, y, rot: 0, props: { numero: mayorHito(p) + 1, yaw: direccion } };
    case 'desafio': {
      const nombres = new Set(p.objetos.flatMap(o => (o.tipo === 'desafio' ? [o.props.nombre] : [])));
      let n = nombres.size + 1;
      while (nombres.has(`F${n}`)) n++;
      return { tipo: 'desafio', x, y, rot: 0, props: { nombre: `F${n}`, yaw: direccion, hitoSiguiente: mayorHito(p) + 1 } };
    }
  }
}

function mayorHito(p: Pista): number {
  return Math.max(0, ...p.objetos.map(o => (o.tipo === 'hito' ? o.props.numero : 0)));
}

/** Agrega un objeto en (x, y), ajustado a 1 cm y dentro de la grilla, numerado y orientado según la baldosa de abajo. */
export function agregarObjeto(p: Pista, tipo: TipoObjetoNuevo, x: number, y: number): { pista: Pista; indice: number } {
  const punto = enLaGrilla(p, x, y);
  const objeto = objetoNuevo(p, tipo, punto.x, punto.y);
  return { pista: { ...p, objetos: [...p.objetos, objeto] }, indice: p.objetos.length };
}

/** (x, y) ajustado a 1 cm y dentro de la grilla, para que nada quede fuera de la pista. */
function enLaGrilla(p: Pista, x: number, y: number): { x: number; y: number } {
  return {
    x: acotar(ajustar(x), 0, p.columnas * TAMANO_BALDOSA - PASO_MM),
    y: acotar(ajustar(y), 0, p.filas * TAMANO_BALDOSA - PASO_MM),
  };
}

function conObjeto(p: Pista, i: number, cambiar: (o: ObjetoDePista) => ObjetoDePista): Pista {
  if (!p.objetos[i]) return p;
  return { ...p, objetos: p.objetos.map((o, j) => (j === i ? cambiar(o) : o)) };
}

export function moverObjeto(p: Pista, i: number, x: number, y: number): Pista {
  return conObjeto(p, i, o => ({ ...o, ...enLaGrilla(p, x, y) }));
}

/** Gira 90° un obstáculo, 45° un bache, y 90° la dirección (yaw) de un hito o un desafío. */
export function girarObjeto(p: Pista, i: number): Pista {
  return conObjeto(p, i, o => {
    switch (o.tipo) {
      case 'obstaculo': return { ...o, rot: girar(o.rot, 90) };
      case 'bache': return { ...o, rot: girar(o.rot, 45) };
      default: return { ...o, props: { ...o.props, yaw: girar(o.props.yaw, 90) } } as ObjetoDePista;
    }
  });
}

/** x, y y rot cambian la posición o el giro; cualquier otra clave es una propiedad del objeto. */
export function cambiarObjeto(p: Pista, i: number, cambios: Record<string, unknown>): Pista {
  return conObjeto(p, i, o => {
    const { x, y, rot, ...props } = cambios;
    return {
      ...o,
      x: typeof x === 'number' ? x : o.x,
      y: typeof y === 'number' ? y : o.y,
      rot: typeof rot === 'number' ? rot : o.rot,
      props: { ...o.props, ...props },
    } as ObjetoDePista;
  });
}

export function quitarObjeto(p: Pista, i: number): Pista {
  return { ...p, objetos: p.objetos.filter((_, j) => j !== i) };
}

export function moverInicio(p: Pista, x: number, y: number, yaw: number = p.inicio.yaw): Pista {
  return { ...p, inicio: { ...enLaGrilla(p, x, y), yaw } };
}

/**
 * Cambia el tamaño de la grilla (2–16 × 2–12). Quita las baldosas y los objetos que quedan fuera
 * (`quitados` cuenta cuántos) y, si el inicio queda fuera, lo trae a la celda más cercana.
 */
export function redimensionar(p: Pista, columnas: number, filas: number): { pista: Pista; quitados: number } {
  const cols = acotar(Math.round(columnas), COLUMNAS.min, COLUMNAS.max);
  const fils = acotar(Math.round(filas), FILAS.min, FILAS.max);
  const ancho = cols * TAMANO_BALDOSA;
  const alto = fils * TAMANO_BALDOSA;
  const baldosas = p.baldosas.filter(b => b.c < cols && b.r < fils);
  const objetos = p.objetos.filter(o => o.x >= 0 && o.y >= 0 && o.x < ancho && o.y < alto);
  const { x, y, yaw } = p.inicio;
  const dentro = x >= 0 && y >= 0 && x < ancho && y < alto;
  const inicio = dentro ? p.inicio : { x: acotar(x, MEDIO, ancho - MEDIO), y: acotar(y, MEDIO, alto - MEDIO), yaw };
  const quitados = p.baldosas.length - baldosas.length + p.objetos.length - objetos.length;
  return { pista: { ...p, columnas: cols, filas: fils, baldosas, objetos, inicio }, quitados };
}
