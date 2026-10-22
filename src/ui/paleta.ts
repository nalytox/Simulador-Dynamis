import type { TipoObjetoNuevo } from '../pista/edicion';
import type { TipoBaldosa } from '../pista/tipos';

/** Una pieza de la paleta del editor: una baldosa (con propiedades iniciales), un objeto o el inicio. */
export type Pieza =
  | { clase: 'baldosa'; nombre: string; tipo: TipoBaldosa; props?: Record<string, unknown> }
  | { clase: 'objeto'; nombre: string; tipo: TipoObjetoNuevo }
  | { clase: 'inicio'; nombre: 'Inicio del robot' };

export const NOMBRE_TIPO: Record<TipoBaldosa, string> = {
  vacia: 'Vacía', recta: 'Recta', giroSuave: 'Giro suave', giroL: 'Giro en L', cortes: 'Línea con cortes',
  cruce: 'Cruce', unionT: 'Unión en T', rampa: 'Rampa', indicadorF2: 'Indicador F2', cuadradoF1: 'Cuadrado F1',
  partida: 'Partida', meta: 'Meta',
};

const baldosa = (tipo: TipoBaldosa, nombre = NOMBRE_TIPO[tipo], props?: Record<string, unknown>): Pieza =>
  (props ? { clase: 'baldosa', nombre, tipo, props } : { clase: 'baldosa', nombre, tipo });
const cruce = (nombre: string, marcas: Record<string, boolean>) => baldosa('cruce', nombre, { marcas });
const objeto = (tipo: TipoObjetoNuevo, nombre: string): Pieza => ({ clase: 'objeto', nombre, tipo });

/** La paleta del editor, agrupada como en la spec (§10.5). */
export const PALETA: { grupo: string; piezas: Pieza[] }[] = [
  { grupo: 'Líneas', piezas: [baldosa('vacia'), baldosa('recta'), baldosa('giroSuave'), baldosa('giroL'), baldosa('cortes'), baldosa('rampa')] },
  {
    grupo: 'Cruces y marcas de color',
    piezas: [
      cruce('Cruce sin marcas', {}),
      cruce('Marca a la izquierda', { ai: true }),
      cruce('Marca a la derecha', { ad: true }),
      cruce('Marcas a ambos lados', { ai: true, ad: true }),
      cruce('Marcas en las 4 puntas', { ai: true, ad: true, di: true, dd: true }),
      baldosa('unionT', 'Unión en T (rama a la izquierda)', { rama: 'izq' }),
      baldosa('unionT', 'Unión en T (rama a la derecha)', { rama: 'der' }),
    ],
  },
  { grupo: 'Desafíos', piezas: [baldosa('indicadorF2'), baldosa('cuadradoF1'), objeto('desafio', 'Punto de desafío (F)')] },
  { grupo: 'Partida y meta', piezas: [baldosa('partida'), baldosa('meta'), { clase: 'inicio', nombre: 'Inicio del robot' }] },
  {
    grupo: 'Objetos',
    piezas: [objeto('obstaculo', 'Obstáculo de 10 cm'), objeto('bache-recto', 'Bache recto'), objeto('bache-diagonal', 'Bache diagonal'), objeto('hito', 'Hito')],
  },
];
