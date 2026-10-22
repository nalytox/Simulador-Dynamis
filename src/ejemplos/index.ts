import seguidor from './seguidor/seguidor.ino?raw';
import pines from './seguidor/pines.h?raw';
import practica from './pistas/practica.json';
import { normalizarPista } from '../pista/serializacion';
import type { Pista } from '../pista/tipos';
import type { Proyecto } from '../proyecto/proyecto';

/** Con lo que abre la app la primera vez (spec §16): el seguidor de línea y la pista de práctica. */
export const PROYECTO_INICIAL: Proyecto = { nombre: 'seguidor', archivos: { 'seguidor.ino': seguidor, 'pines.h': pines } };

const lectura = normalizarPista(practica);
if (!lectura.ok) throw new Error(`La pista de práctica no es válida: ${lectura.errores.join(' ')}`);
export const PISTA_INICIAL: Pista = lectura.pista;
