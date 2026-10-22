import { celdaDe, crearIndice } from '../pista/baldosas';
import type { Baldosa, Pista } from '../pista/tipos';
import { crearObjetos } from './objetos';
import { crearRelieve } from './relieve';
import { crearSuperficie } from './superficie';
import type { Mundo } from './tipos';

/** El Mundo de una pista, más lo que necesita el juez (y que los modelos no usan). */
export interface MundoPista extends Mundo {
  readonly pista: Pista;
  /** true si (x, y) cae sobre la cinta de la línea (negra, o blanca en una baldosa invertida). */
  esLinea(x: number, y: number): boolean;
  /** La baldosa bajo (x, y), o null si la celda está vacía o fuera de la grilla. */
  baldosaEn(x: number, y: number): Baldosa | null;
}

export function crearMundo(p: Pista): MundoPista {
  const superficie = crearSuperficie(p);
  const relieve = crearRelieve(p);
  const objetos = crearObjetos(p, relieve);
  const indice = crearIndice(p);
  return {
    pista: p,
    muestrear: superficie.color,
    esLinea: superficie.esLinea,
    altura: relieve.altura,
    inclinacion: relieve.inclinacion,
    raycast: objetos.raycast,
    colisiona: objetos.colisiona,
    objetosCerca: objetos.objetosCerca,
    baldosaEn(x, y) {
      const { c, r } = celdaDe(x, y);
      return indice(c, r);
    },
  };
}
