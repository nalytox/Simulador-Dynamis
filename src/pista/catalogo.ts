import { ANCHO_CINTA, COLOR_MARCA, TAMANO_BALDOSA, type Accion, type Baldosa, type Lado, type Marcas } from './tipos';

/**
 * Catálogo de piezas como listas de figuras en el marco local de la baldosa.
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

/** Marcas de color de 25 × 25 mm pegadas a la esquina de la intersección (antes/después, izquierda/derecha). */
const POSICION_MARCAS: Record<keyof Marcas, [number, number]> = {
  ai: [V0 - 25, V1], ad: [V0 - 25, V0 - 25], di: [V1, V1], dd: [V1, V0 - 25],
};

function marcas(m: Marcas, color: string): Figura[] {
  return (Object.keys(POSICION_MARCAS) as (keyof Marcas)[])
    .filter(clave => m[clave])
    .map(clave => {
      const [u0, v0] = POSICION_MARCAS[clave];
      return { forma: 'rect', u0, v0, u1: u0 + 25, v1: v0 + 25, rol: 'marca', color };
    });
}

/** F2: L1 cruza la línea y después una barra corta por decisión, hacia el lado del giro (máximo 3). */
function indicadorF2(decisiones: ('izq' | 'der')[]): Figura[] {
  const figuras = [tramo(0, T), rect(50.5, 90, 69.5, 210)];
  decisiones.slice(0, 3).forEach((lado, i) => {
    const u = 60 + 60 * (i + 1);
    figuras.push(lado === 'izq' ? rect(u - 9.5, CENTRO, u + 9.5, 210) : rect(u - 9.5, 90, u + 9.5, CENTRO));
  });
  return figuras;
}

/** F1: cuadrado de 210 mm (al centro de la cinta) con entrada y salida centradas. */
function cuadradoF1(): Figura[] {
  const a = 35.5, b = 54.5, c = 245.5, d = 264.5;
  return [tramo(0, 45), tramo(255, T), rect(a, a, d, b), rect(a, c, d, d), rect(a, a, b, d), rect(c, a, d, d)];
}

function guiones(guion: number, espacio: number): Figura[] {
  const figuras: Figura[] = [];
  if (guion <= 0) return figuras;
  const paso = guion + Math.max(espacio, 0);
  for (let u = 0; u < T; u += paso) figuras.push(tramo(u, Math.min(u + guion, T)));
  return figuras;
}

/** Figuras de una pieza, en orden de pintado (la última que contiene un punto es la que se ve). */
export function figurasDe(b: Baldosa, colorMarcas?: string): Figura[] {
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
    case 'cruce':
      return [tramo(0, T), rect(V0, 0, V1, T), ...marcas(b.props.marcas, b.props.colorMarca ?? colorMarcas ?? COLOR_MARCA)];
    case 'unionT': {
      const rama = b.props.rama === 'izq' ? rect(V0, V0, V1, T) : rect(V0, 0, V1, V1);
      return [tramo(0, T), rama, ...marcas(b.props.marcas, b.props.colorMarca ?? colorMarcas ?? COLOR_MARCA)];
    }
    case 'indicadorF2':
      return indicadorF2(b.props.decisiones);
    case 'cuadradoF1':
      return cuadradoF1();
    case 'vacia':
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
    case 'indicadorF2':
    case 'cuadradoF1':
      return ['oeste', 'este'];
    case 'cruce':
      return ['oeste', 'este', 'norte', 'sur'];
    case 'unionT':
      return ['oeste', 'este', b.props.rama === 'izq' ? 'norte' : 'sur'];
    case 'giroSuave':
    case 'giroL':
      return ['oeste', 'norte'];
    case 'meta':
      return ['oeste'];
    case 'vacia':
      return [];
  }
}

/** Convención RoboCup: marcas a ambos lados = vuelta, solo un lado = girar hacia él, ninguna = recto. */
function accionPorMarcas(izquierda: boolean, derecha: boolean): Accion {
  if (izquierda && derecha) return 'vuelta';
  if (izquierda) return 'izq';
  if (derecha) return 'der';
  return 'recto';
}

/**
 * Qué debe hacer el robot al entrar por la flecha de un cruce o unión en T: solo cuentan las
 * marcas de antes del cruce. null si la pieza no pide una decisión.
 */
export function accionEsperada(b: Baldosa): Accion | null {
  if (b.tipo !== 'cruce' && b.tipo !== 'unionT') return null;
  return b.props.accion ?? accionPorMarcas(b.props.marcas.ai, b.props.marcas.ad);
}

/** Según por dónde entra el robot: qué marcas quedan antes del cruce y por dónde sale con cada acción. */
const DESDE: Record<Lado, { izquierda: keyof Marcas; derecha: keyof Marcas; salida: Record<Accion, Lado> }> = {
  oeste: { izquierda: 'ai', derecha: 'ad', salida: { recto: 'este', izq: 'norte', der: 'sur', vuelta: 'oeste' } },
  sur: { izquierda: 'ad', derecha: 'dd', salida: { recto: 'norte', izq: 'oeste', der: 'este', vuelta: 'sur' } },
  este: { izquierda: 'dd', derecha: 'di', salida: { recto: 'oeste', izq: 'sur', der: 'norte', vuelta: 'este' } },
  norte: { izquierda: 'di', derecha: 'ai', salida: { recto: 'sur', izq: 'este', der: 'oeste', vuelta: 'norte' } },
};

/**
 * Por dónde debe salir el robot de un cruce o unión en T si entró por `entrada` (borde local). Las
 * marcas se leen desde ese lado; entrando por la flecha se respeta la acción elegida a mano.
 * null si la pieza no pide una decisión o si la salida esperada no tiene línea.
 */
export function salidaEsperada(b: Baldosa, entrada: Lado): Lado | null {
  if (b.tipo !== 'cruce' && b.tipo !== 'unionT') return null;
  const desde = DESDE[entrada];
  const accion = entrada === 'oeste'
    ? accionEsperada(b)!
    : accionPorMarcas(b.props.marcas[desde.izquierda], b.props.marcas[desde.derecha]);
  const salida = desde.salida[accion];
  return bocasDe(b).includes(salida) ? salida : null;
}
