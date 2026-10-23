import { cargarNucleoDesdeDisco } from '../../src/compilador/nucleo-node';
import type { ArchivosNucleo } from '../../src/compilador/compilar';
import { PISTAS_DE_EJEMPLO, PROYECTOS_DE_EJEMPLO } from '../../src/ejemplos';
import { Juez, type EstadoJuez, type TipoEvento } from '../../src/juez/juez';
import { crearMundo } from '../../src/mundo/pista';
import { puntosDePartida } from '../../src/pista/puntos';
import { ROBOT_POR_DEFECTO } from '../../src/robot/config';
import { Simulador } from '../../src/simulacion/simulador';
import type { ErrorEjecucion } from '../../src/simulacion/errores';
import type { Instantanea } from '../../src/simulacion/ejecucion';
import { compilarParaPrueba } from './compilar-prueba';

let nucleo: Promise<ArchivosNucleo> | null = null;

const INTERVALO_US = 10_000;
/** El límite de las bases: el juez termina la prueba a los 5 minutos. */
const SEGUNDOS_MAXIMOS = 300;

export interface CorridaEjemplo {
  fin: { motivo: 'terminado' | 'error'; error?: ErrorEjecucion; juez: EstadoJuez };
  serial: string;
  avisos: string[];
  /** Un estado cada 10 ms de tiempo virtual; yaw y pitch en radianes. */
  estados: Instantanea['estado'][];
  eventos: TipoEvento[];
}

/**
 * Corre un proyecto de ejemplo en su pista, desde la partida, con el juez, la semilla 1 y sin ritmo de
 * tiempo real. Termina cuando el juez la termina, o a los `segundos` de tiempo virtual.
 */
export async function correrEjemplo(id: string, o: { segundos?: number } = {}): Promise<CorridaEjemplo> {
  const ejemplo = PROYECTOS_DE_EJEMPLO.find(e => e.id === id);
  if (!ejemplo) throw new Error(`No hay un ejemplo ${id}.`);
  const pista = PISTAS_DE_EJEMPLO.find(p => p.id === ejemplo.pista)!.pista;
  nucleo ??= cargarNucleoDesdeDisco();
  const modulo = await compilarParaPrueba(ejemplo.proyecto.archivos, await nucleo, ejemplo.proyecto.nombre);
  const mundo = crearMundo(pista);
  const juez = new Juez(mundo, ROBOT_POR_DEFECTO, { desde: 'partida' });
  const limiteUs = (o.segundos ?? SEGUNDOS_MAXIMOS) * 1e6;
  const estados: Instantanea['estado'][] = [];
  let proximoUs = 0;
  let serial = '';
  let sim!: Simulador;
  sim = await Simulador.crear({
    modulo, mundo, robot: ROBOT_POR_DEFECTO, poseInicial: puntosDePartida(pista).find(p => p.id === 'partida')!.pose,
    semilla: 1, ambiente: pista.ambiente,
    alPasoFisica: (tUs, estado) => {
      juez.actualizar(tUs, estado);
      if (tUs >= proximoUs) {
        const { x, y, z, yaw, pitch, roll } = sim.estado;
        estados.push({ x, y, z, yaw, pitch, roll });
        serial += sim.tomarSerial();
        proximoUs += INTERVALO_US;
      }
      if (juez.termino || tUs >= limiteUs) sim.detener();
    },
  });
  const r = sim.ejecutar(Infinity);
  serial += sim.tomarSerial();
  const fin = r.motivo === 'error'
    ? { motivo: 'error' as const, error: r.error, juez: juez.estado }
    : { motivo: 'terminado' as const, juez: juez.estado };
  return { fin, serial, avisos: sim.avisos, estados, eventos: juez.estado.eventos.map(e => e.tipo) };
}
