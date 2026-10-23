import seguidor from './seguidor/seguidor.ino?raw';
import pines from './seguidor/pines.h?raw';
import practica from './pistas/practica.json';
import cruces from './pistas/cruces.json';
import rampa from './pistas/rampa.json';
import { normalizarPista } from '../pista/serializacion';
import type { Pista } from '../pista/tipos';
import type { Proyecto } from '../proyecto/proyecto';

export type IdPista = 'practica' | 'cruces' | 'rampa';
export interface EjemploPista { id: IdPista; nombre: string; descripcion: string; pista: Pista }
export interface EjemploProyecto { id: string; nombre: string; descripcion: string; pista: IdPista; proyecto: Proyecto }

function leerPista(datos: unknown): Pista {
  const lectura = normalizarPista(datos);
  if (!lectura.ok) throw new Error(`Una pista de ejemplo no es válida: ${lectura.errores.join(' ')}`);
  return lectura.pista;
}

/** Las pistas de la ventana Ejemplos (spec §12), en el orden en que se muestran. */
export const PISTAS_DE_EJEMPLO: EjemploPista[] = [
  { id: 'practica', descripcion: 'La pista para empezar: rectas, curvas suaves y la meta.', pista: leerPista(practica) },
  { id: 'cruces', descripcion: 'Cruces con marcas de color y una línea cortada.', pista: leerPista(cruces) },
  { id: 'rampa', descripcion: 'Una rampa para subir y bajar, baches y el obstáculo.', pista: leerPista(rampa) },
].map(e => ({ ...e, id: e.id as IdPista, nombre: e.pista.nombre }));

/** Con lo que abre la app la primera vez (spec §16): el seguidor de línea y la pista de práctica. */
export const PROYECTO_INICIAL: Proyecto = { nombre: 'seguidor', archivos: { 'seguidor.ino': seguidor, 'pines.h': pines } };
export const PISTA_INICIAL: Pista = PISTAS_DE_EJEMPLO[0].pista;

type Ficha = Omit<EjemploProyecto, 'proyecto'>;

/** Los proyectos de src/ejemplos/proyectos/<id>/, en el orden en que se muestran. Cada carpeta necesita su ficha. */
const FICHAS: Ficha[] = [
  { id: 'mover-motores', nombre: 'Mover los motores', descripcion: 'Avanza, gira y retrocede: así se mueven los motores.', pista: 'practica' },
  { id: 'leer-linea', nombre: 'Leer la línea', descripcion: 'Calibra el sensor de línea y muestra dónde ve la línea.', pista: 'practica' },
  { id: 'seguidor-pid', nombre: 'Seguidor de línea con PID', descripcion: 'Sigue la línea con un control PID: P, I y D.', pista: 'practica' },
  { id: 'leer-giroscopio', nombre: 'Leer el giroscopio', descripcion: 'Gira 90° midiendo el giro con el MPU6050.', pista: 'practica' },
];

const archivos = import.meta.glob('./proyectos/*/*', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;

function proyectoDe(id: string): Proyecto {
  const prefijo = `./proyectos/${id}/`;
  const propios = Object.entries(archivos).filter(([ruta]) => ruta.startsWith(prefijo));
  if (propios.length === 0) throw new Error(`El ejemplo ${id} no tiene archivos.`);
  return { nombre: id, archivos: Object.fromEntries(propios.map(([ruta, texto]) => [ruta.slice(prefijo.length), texto])) };
}

const carpetas = new Set(Object.keys(archivos).map(ruta => ruta.split('/')[2]));
for (const carpeta of carpetas) {
  if (!FICHAS.some(f => f.id === carpeta)) throw new Error(`Falta la ficha del ejemplo ${carpeta}.`);
}

/** Los proyectos de la ventana Ejemplos (spec §12): el del comienzo y los de src/ejemplos/proyectos/. */
export const PROYECTOS_DE_EJEMPLO: EjemploProyecto[] = [
  { id: 'seguidor', nombre: 'Seguidor de línea', descripcion: 'Calibra el sensor de línea y sigue la línea hasta la meta.', pista: 'practica', proyecto: PROYECTO_INICIAL },
  ...FICHAS.map(f => ({ ...f, proyecto: proyectoDe(f.id) })),
];
