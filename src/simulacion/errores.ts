import { SalidaPrograma } from './puente';

export type TipoErrorEjecucion =
  | 'division-por-cero' | 'memoria' | 'pila' | 'sin-return' | 'salida' | 'simulador' | 'desconocido';

/** Falla del simulador o de los modelos del profe: no es un error del programa del estudiante. */
export class ErrorSimulador extends Error {
  constructor(origen: string, causa: unknown) {
    super(`Error en ${origen}: ${causa instanceof Error ? causa.message : String(causa)}`, { cause: causa });
    this.name = 'ErrorSimulador';
  }
}

export interface ErrorEjecucion {
  tipo: TipoErrorEjecucion;
  /** Explicación para estudiantes. */
  mensaje: string;
  /** Mensaje original, para el profesor. */
  tecnico: string;
}

const MENSAJES: Record<TipoErrorEjecucion, string> = {
  'division-por-cero': 'Tu programa dividió por cero. Revisa las divisiones (/) y los restos (%).',
  memoria: 'Tu programa usó memoria que no le pertenece: un arreglo fuera de sus límites o una función que se llama a sí misma sin parar.',
  pila: 'Una función se llama a sí misma sin parar.',
  'sin-return': 'Una función que debía devolver un valor terminó sin return.',
  salida: 'Tu programa terminó (se llamó a exit).',
  simulador: 'Algo falló en el simulador, avisa a tu profe.',
  desconocido: 'Tu programa se detuvo por un error inesperado.',
};

function tipoDe(e: unknown): TipoErrorEjecucion {
  if (e instanceof SalidaPrograma) return 'salida';
  if (e instanceof ErrorSimulador) return 'simulador';
  if (e instanceof RangeError) return 'pila';
  if (e instanceof WebAssembly.RuntimeError) {
    const m = e.message.toLowerCase();
    if (m.includes('divide by zero')) return 'division-por-cero';
    if (m.includes('out of bounds')) return 'memoria';
    if (m.includes('unreachable')) return 'sin-return';
  }
  return 'desconocido';
}

export function clasificarErrorEjecucion(e: unknown): ErrorEjecucion {
  const tipo = tipoDe(e);
  return { tipo, mensaje: MENSAJES[tipo], tecnico: e instanceof Error ? e.message : String(e) };
}
