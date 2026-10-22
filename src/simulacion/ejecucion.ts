import { Simulador, type LecturasVista, type Pose } from './simulador';
import { Ritmo, tomarPedido, type Reloj } from './control';
import { crearAzar } from './azar';
import type { Motores } from './motores';
import type { ErrorEjecucion } from './errores';
import { Juez, type EstadoJuez } from '../juez/juez';
import { crearMundo } from '../mundo/pista';
import { puntosDePartida } from '../pista/puntos';
import type { Pista } from '../pista/tipos';
import type { ConfigRobot } from '../robot/config';

/** Lo que la UI necesita para dibujar un cuadro. */
export interface Instantanea {
  /** 0 en la primera corrida; sube con cada reinicio del juez. */
  reinicio: number;
  /** Segundos de tiempo virtual de la corrida actual. */
  t: number;
  estado: { x: number; y: number; z: number; yaw: number; pitch: number; roll: number };
  motores: Motores;
  sensores: LecturasVista;
  juez: EstadoJuez;
  /** Texto del Serial desde la instantánea anterior. */
  serial: string;
  /** Avisos del simulador que aparecieron desde la instantánea anterior. */
  avisos: string[];
  /** Respuesta a un pedido que no se pudo hacer ("Ya usaste los 3 reinicios."). */
  mensaje: string | null;
}

export interface FinEjecucion { motivo: 'terminado' | 'error'; error?: ErrorEjecucion; juez: EstadoJuez }

export interface OpcionesPrueba {
  modulo: WebAssembly.Module;
  pista: Pista;
  robot: ConfigRobot;
  /** Id del punto de partida ('partida', 'hito-n' o 'desafio-F1'). */
  desde: string;
  semilla: number;
  control: Int32Array;
  publicar: (i: Instantanea) => void;
  /** Reloj real (por defecto, performance.now y Atomics.wait); las pruebas usan uno de mentira. */
  reloj?: Reloj;
  intervaloMs?: number;
}

/** Semilla del azar de la vista, distinta de las del programa y los modelos. */
const MEZCLA_VISTA = 0x5bd1e995;

/**
 * Una prueba completa: el programa en la pista con el juez virtual. Un reinicio del juez vuelve a
 * empezar el programa desde setup() en el punto elegido (decisión 3 de la fase 4); el juez sigue.
 * El ritmo, los pedidos y las instantáneas se atienden en cada paso de física, así el robot se ve
 * avanzar y se puede reiniciar también dentro de un delay largo.
 */
export async function ejecutarPrueba(o: OpcionesPrueba): Promise<FinEjecucion> {
  const mundo = crearMundo(o.pista);
  const juez = new Juez(mundo, o.robot, { desde: o.desde });
  const partida = puntosDePartida(o.pista).find(p => p.id === o.desde);
  if (!partida) throw new Error(`La pista no tiene el punto de partida "${o.desde}".`);
  const ritmo = new Ritmo(o.control, o.reloj);
  const ahora = o.reloj ? () => o.reloj!.ahora() : () => performance.now();
  const intervalo = o.intervaloMs ?? 16;
  const azarVista = crearAzar(o.semilla ^ MEZCLA_VISTA);

  let pose: Pose = partida.pose;
  let reinicio = 0;
  let mensaje: string | null = null;
  let ultima = -Infinity;
  for (;;) {
    let poseReinicio: Pose | null = null;
    let avisosVistos = 0;
    let sim!: Simulador;
    const publicar = () => {
      const { x, y, z, yaw, pitch, roll } = sim.estado;
      const avisos = sim.avisos;
      o.publicar({
        reinicio, t: sim.tiempoUs / 1e6, estado: { x, y, z, yaw, pitch, roll }, motores: sim.motores,
        sensores: sim.medirParaVista(azarVista), juez: juez.estado, serial: sim.tomarSerial(),
        avisos: avisos.slice(avisosVistos), mensaje,
      });
      avisosVistos = avisos.length;
      mensaje = null;
      ultima = ahora();
    };
    sim = await Simulador.crear({
      modulo: o.modulo, mundo, robot: o.robot, poseInicial: pose, semilla: o.semilla,
      alPasoFisica: (tUs, estado) => {
        juez.actualizar(tUs, estado);
        if (juez.termino) return sim.detener();
        ritmo.esperar(tUs);
        const pedido = tomarPedido(o.control);
        if (pedido) {
          const r = juez.reiniciar(pedido);
          if (r.ok) {
            poseReinicio = r.pose;
            return sim.detener();
          }
          mensaje = r.mensaje;
        }
        if (ahora() - ultima >= intervalo) publicar();
      },
    });
    publicar();
    const r = sim.ejecutar(Infinity);
    publicar();
    if (r.motivo === 'error') return { motivo: 'error', error: r.error, juez: juez.estado };
    if (poseReinicio) {
      pose = poseReinicio;
      reinicio++;
      continue;
    }
    return { motivo: 'terminado', juez: juez.estado };
  }
}
