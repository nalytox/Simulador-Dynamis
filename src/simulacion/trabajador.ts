import { ejecutarPrueba, type FinEjecucion, type Instantanea } from './ejecucion';
import { clasificarErrorEjecucion, ErrorSimulador } from './errores';
import type { Pista } from '../pista/tipos';
import type { ConfigRobot } from '../robot/config';
import type { AmbitoTrabajador } from '../ui/ambito';

/** Worker de simulación: corre una prueba completa y envía instantáneas (spec §3). */
export interface MensajeAlSimulador {
  tipo: 'iniciar';
  modulo: WebAssembly.Module;
  pista: Pista;
  robot: ConfigRobot;
  desde: string;
  semilla: number;
  control: SharedArrayBuffer;
}
export type MensajeDelSimulador = { tipo: 'instantanea'; datos: Instantanea } | { tipo: 'fin'; datos: FinEjecucion };

const ambito = self as unknown as AmbitoTrabajador;
const enviar = (m: MensajeDelSimulador) => ambito.postMessage(m);

ambito.onmessage = async ({ data }) => {
  const m = data as MensajeAlSimulador;
  try {
    const fin = await ejecutarPrueba({
      modulo: m.modulo, pista: m.pista, robot: m.robot, desde: m.desde, semilla: m.semilla,
      control: new Int32Array(m.control), publicar: datos => enviar({ tipo: 'instantanea', datos }),
    });
    enviar({ tipo: 'fin', datos: fin });
  } catch (e) {
    enviar({ tipo: 'fin', datos: { motivo: 'error', error: clasificarErrorEjecucion(new ErrorSimulador('el simulador', e)), juez: null } });
  }
};
