import { ejecutarPruebaDeAjuste, type ResultadoPrueba } from './prueba';
import * as recompensa from './recompensa.js';
import type { ModuloRecompensa } from './contrato';
import { clasificarErrorEjecucion } from '../simulacion/errores';
import type { Pista } from '../pista/tipos';
import type { ConfigRobot } from '../robot/config';
import type { AmbitoTrabajador } from '../ui/ambito';

/** Worker del entrenamiento: recibe el programa una vez y corre pruebas de a una (spec §11.2). */
export type MensajeAlAjuste =
  | { tipo: 'iniciar'; modulo: WebAssembly.Module; pista: Pista; robot: ConfigRobot; duracionS: number; latidos: SharedArrayBuffer; indice: number }
  | { tipo: 'probar'; id: number; valores: Record<string, number>; semilla: number };

export type MensajeDelAjuste =
  | { tipo: 'resultado'; id: number; resultado: ResultadoPrueba }
  | { tipo: 'error'; id: number; error: { nombre: string; mensaje: string; tecnico: string } };

const ambito = self as unknown as AmbitoTrabajador;
let config: Extract<MensajeAlAjuste, { tipo: 'iniciar' }> | null = null;
let latidos: Int32Array | null = null;

ambito.onmessage = async ({ data }) => {
  const m = data as MensajeAlAjuste;
  if (m.tipo === 'iniciar') {
    config = m;
    latidos = new Int32Array(m.latidos);
    return;
  }
  if (!config || !latidos) return;
  const { modulo, pista, robot, duracionS, indice } = config;
  const contador = latidos;
  // El primer latido avisa que el worker ya cargó: desde aquí corre la espera del ciclo sin fin.
  Atomics.add(contador, indice, 1);
  let respuesta: MensajeDelAjuste;
  try {
    const resultado = await ejecutarPruebaDeAjuste({
      modulo, pista, robot, duracionS, valores: m.valores, semilla: m.semilla, recompensa: recompensa as ModuloRecompensa,
      alLatido: () => { Atomics.add(contador, indice, 1); },
    });
    respuesta = { tipo: 'resultado', id: m.id, resultado };
  } catch (e) {
    const error = e instanceof Error ? e : new Error(String(e));
    respuesta = { tipo: 'error', id: m.id, error: { nombre: error.name, mensaje: error.message, tecnico: clasificarErrorEjecucion(error).tecnico } };
  }
  ambito.postMessage(respuesta);
};
