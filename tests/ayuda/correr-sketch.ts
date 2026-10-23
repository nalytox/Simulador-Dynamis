import { cargarNucleoDesdeDisco } from '../../src/compilador/nucleo-node';
import type { ArchivosNucleo } from '../../src/compilador/compilar';
import { Simulador, type Pose, type ResultadoEjecucion } from '../../src/simulacion/simulador';
import type { ModelosSensores } from '../../src/simulacion/sensores';
import { crearMundo } from '../../src/mundo/pista';
import { poseInicial } from '../../src/pista/serializacion';
import type { Pista } from '../../src/pista/tipos';
import type { ConfigRobot } from '../../src/robot/config';
import { compilarParaPrueba } from './compilar-prueba';
import { pistaDe } from './pistas';

let nucleo: Promise<ArchivosNucleo> | null = null;

export interface OpcionesSketch {
  pista?: Pista;
  robot?: ConfigRobot;
  modelos?: Partial<ModelosSensores>;
  pose?: Pose;
  duracionUs?: number;
}

/**
 * Compila un sketch con el núcleo real y lo ejecuta en una pista (por defecto, 6 × 1 rectas con el
 * robot en (150, 150) mirando a +x). Devuelve el simulador, el texto del Serial y el resultado.
 */
export async function correrSketch(codigo: string, o: OpcionesSketch = {}): Promise<{ sim: Simulador; texto: string; resultado: ResultadoEjecucion }> {
  nucleo ??= cargarNucleoDesdeDisco();
  const pista = o.pista ?? pistaDe({ columnas: 6, filas: 1, baldosas: [0, 1, 2, 3, 4, 5].map(c => ({ c, r: 0, tipo: 'recta' })) });
  const modulo = await compilarParaPrueba({ 'p.ino': codigo }, await nucleo, 'p');
  const sim = await Simulador.crear({
    modulo, mundo: crearMundo(pista), robot: o.robot, modelos: o.modelos, ambiente: pista.ambiente,
    poseInicial: o.pose ?? poseInicial(pista),
  });
  const resultado = sim.ejecutar(o.duracionUs ?? 100_000);
  return { sim, texto: sim.tomarSerial(), resultado };
}
