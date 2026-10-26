import type { LecturasVista } from '../simulacion/simulador';
import type { Motores } from '../simulacion/motores';
import type { EstadoJuez } from '../juez/juez';
import type { Mundo } from '../mundo/tipos';

/**
 * Contrato entre el motor de pruebas (lo implementa este proyecto) y el agente y la recompensa del
 * profesor (src/ajuste/agente.js y src/ajuste/recompensa.js). Ver src/ajuste/README.md.
 */

/** Un valor marcado con @ajustar que el estudiante eligió ajustar, con su rango de búsqueda. */
export interface ParametroAgente {
  /** `grupo.nombre`, por ejemplo 'siguelineas.kp'. */
  id: string;
  grupo: string;
  nombre: string;
  /** El valor que tiene hoy en el código. */
  valor: number;
  /** Si es entero (un `int`, o un `#define` sin decimales): sus valores propuestos se redondean. */
  entero: boolean;
  min: number;
  max: number;
}

export interface Agente {
  /** Valores para una prueba nueva, por id. Puede llamarse varias veces antes de recibir resultados. */
  proponer(): Record<string, number>;
  /** El resultado de una prueba con esos valores. */
  aprender(valores: Record<string, number>, recompensa: number, resumen: ResumenPrueba): void;
}

export type CrearAgente = (o: { parametros: ParametroAgente[]; presupuesto: number }) => Agente;

/** Un paso del registro de una prueba (cada 10 ms de tiempo virtual). */
export interface PasoRegistro {
  /** Segundos de tiempo virtual. */
  t: number;
  /** mm y rad, en el marco del mundo. */
  estado: { x: number; y: number; z: number; yaw: number; pitch: number; roll: number };
  /** Lo que miden los sensores en ese instante (como las tarjetas de la vista Programar). */
  lecturas: LecturasVista;
  motores: Motores;
  /**
   * Lo que pasó desde el paso anterior: los eventos del juez ('hito', 'meta', 'perdio-linea',
   * 'toco-obstaculo', 'camino-equivocado', 'fin-tiempo'), 'colision' y 'fuera-de-pista'.
   */
  eventos: string[];
}

/**
 * Por qué terminó una prueba: se acabó el tiempo, lo pidió debeTerminar, el juez la dio por
 * terminada, el programa tuvo un error, o el programa se quedó en un ciclo sin fin.
 */
export type MotivoFin = 'tiempo' | 'termino' | 'juez' | 'error' | 'ciclo-sin-fin';

export interface RegistroPrueba {
  valores: Record<string, number>;
  semilla: number;
  /** La duración máxima elegida en la ventana, en segundos. */
  duracionS: number;
  pasos: PasoRegistro[];
  /** El juez virtual al final; null si la prueba no llegó a correr (ciclo sin fin). */
  juez: EstadoJuez | null;
  /** detalle: el motivo de debeTerminar o el mensaje del error. */
  fin: { motivo: MotivoFin; detalle: string | null };
}

/** Lo que el agente recibe de cada prueba, además de la recompensa. */
export interface ResumenPrueba {
  motivo: MotivoFin;
  detalle: string | null;
  /** Segundos que duró la prueba. */
  t: number;
  /** Puntaje del juez virtual (0 si no corrió). */
  puntaje: number;
  /** Hitos alcanzados. */
  hitos: number;
  meta: boolean;
}

export interface ModuloRecompensa {
  calcularRecompensa(registro: RegistroPrueba): number;
  debeTerminar(paso: PasoRegistro, mundo: Mundo): false | string;
}

/** Lo que lanzan los archivos del profe mientras no estén programados. */
export class FaltaImplementar extends Error {
  constructor(pieza: 'el agente' | 'la recompensa', archivo: string) {
    super(`Para entrenar falta que tu profe programe ${pieza} (${archivo}).`);
    this.name = 'FaltaImplementar';
  }
}

/** Reconoce FaltaImplementar por su nombre, que sobrevive al pasar de un worker al hilo principal. */
export function esFaltaImplementar(e: unknown): boolean {
  return typeof e === 'object' && e !== null && (e as { name?: unknown }).name === 'FaltaImplementar';
}
