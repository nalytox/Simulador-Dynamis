import { celdaDe, ladoEnMundo } from './baldosas';
import { gradosARadianes, normalizarPista } from './serializacion';
import { TAMANO_BALDOSA, type Baldosa, type Lado, type ObjetoDePista, type Pista, type Rotacion, type TipoBaldosa } from './tipos';

/**
 * Edición de la pista para el editor (spec §10.5): funciones puras que devuelven una pista nueva
 * sin tocar la original. Los ángulos van en grados, como en el JSON.
 */
export type TipoObjetoNuevo = 'obstaculo' | 'bache-recto' | 'bache-diagonal' | 'hito' | 'desafio';

export const COLUMNAS = { min: 2, max: 16 };
export const FILAS = { min: 2, max: 12 };
/** Los objetos y el inicio se ubican en pasos de 1 cm. */
const PASO_MM = 10;
const MEDIO = TAMANO_BALDOSA / 2;
const VECINO: Record<Lado, [number, number]> = { este: [1, 0], oeste: [-1, 0], norte: [0, 1], sur: [0, -1] };

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

/**
 * Continuidad de las rampas (§10.4): la baldosa que sigue a una rampa en la dirección de subida
 * queda al nivel de su parte alta. Si esa también es una rampa, sigue con la próxima.
 */
function conRampasContinuas(baldosas: Baldosa[], desde: Baldosa): Baldosa[] {
  const resultado = [...baldosas];
  const vistas = new Set<Baldosa>();
  let actual = desde;
  while (actual.tipo === 'rampa' && !vistas.has(actual)) {
    vistas.add(actual);
    const [dc, dr] = VECINO[ladoEnMundo(actual, 'este')];
    const i = resultado.findIndex(enCelda(actual.c + dc, actual.r + dr));
    if (i < 0) break;
    resultado[i] = { ...resultado[i], nivel: actual.nivel + subidaRampa(actual) } as Baldosa;
    actual = resultado[i];
  }
  return resultado;
}

function conBaldosa(p: Pista, b: Baldosa): Pista {
  const resto = p.baldosas.filter(o => !enCelda(b.c, b.r)(o));
  return { ...p, baldosas: conRampasContinuas([...resto, b], b) };
}

/** El nivel de la parte alta de una rampa que sube hacia (c, r), si hay una. */
function nivelDeRampaHacia(p: Pista, c: number, r: number): number | null {
  const rampa = p.baldosas.find(b => {
    if (b.tipo !== 'rampa') return false;
    const [dc, dr] = VECINO[ladoEnMundo(b, 'este')];
    return b.c + dc === c && b.r + dr === r;
  });
  return rampa ? rampa.nivel + subidaRampa(rampa) : null;
}

/**
 * Pone una pieza en (c, r). Si ya había una baldosa, la reemplaza y conserva su nivel; si no, y una
 * rampa sube hacia esa celda, la pieza queda al nivel de la parte alta de la rampa.
 */
export function colocarBaldosa(p: Pista, c: number, r: number, tipo: TipoBaldosa, rot: Rotacion = 0, props: Record<string, unknown> = {}): Pista {
  const completas = propsCompletas(tipo, props) ?? propsCompletas(tipo, {})!;
  const nivel = baldosaEn(p, c, r)?.nivel ?? nivelDeRampaHacia(p, c, r) ?? 0;
  return conBaldosa(p, { c, r, rot, nivel, tipo, props: completas } as Baldosa);
}

/** sentido 1: 90° antihorario; -1: 90° horario. */
export function girarBaldosa(p: Pista, c: number, r: number, sentido: 1 | -1): Pista {
  const b = baldosaEn(p, c, r);
  if (!b) return p;
  return conBaldosa(p, { ...b, rot: girar(b.rot, 90 * sentido) as Rotacion });
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

/** Agrega un objeto en (x, y), ajustado a 1 cm, numerado y orientado según la baldosa de abajo. */
export function agregarObjeto(p: Pista, tipo: TipoObjetoNuevo, x: number, y: number): { pista: Pista; indice: number } {
  const objeto = objetoNuevo(p, tipo, ajustar(x), ajustar(y));
  return { pista: { ...p, objetos: [...p.objetos, objeto] }, indice: p.objetos.length };
}

function conObjeto(p: Pista, i: number, cambiar: (o: ObjetoDePista) => ObjetoDePista): Pista {
  if (!p.objetos[i]) return p;
  return { ...p, objetos: p.objetos.map((o, j) => (j === i ? cambiar(o) : o)) };
}

export function moverObjeto(p: Pista, i: number, x: number, y: number): Pista {
  return conObjeto(p, i, o => ({ ...o, x: ajustar(x), y: ajustar(y) }));
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
  return { ...p, inicio: { x: ajustar(x), y: ajustar(y), yaw } };
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
