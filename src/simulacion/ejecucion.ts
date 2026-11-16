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
import { memoriaVacia, type ClaveEscrita, type MemoriaNvs } from './memoria';

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
  /**
   * La memoria del robot (Preferences), solo si cambió desde la instantánea anterior (y en la
   * primera); `ultima` es la última clave escrita.
   */
  memoria: { datos: MemoriaNvs; ultima: ClaveEscrita | null } | null;
}

export interface FinEjecucion {
  motivo: 'terminado' | 'error';
  error?: ErrorEjecucion;
  /** null si la prueba no alcanzó a empezar (por ejemplo, el worker falló al instanciar el programa). */
  juez: EstadoJuez | null;
  /** La memoria del robot al terminar, también si terminó con error; null si la prueba no alcanzó a empezar. */
  memoria: MemoriaNvs | null;
}

export interface OpcionesPrueba {
  modulo: WebAssembly.Module;
  pista: Pista;
  robot: ConfigRobot;
  /** Id del punto de partida ('partida', 'hito-n' o 'desafio-F1'). */
  desde: string;
  semilla: number;
  /** Valores de los parámetros @ajustar (para "Ver esta prueba en la pista"). */
  ajustes?: Record<string, number>;
  /** La memoria del robot (Preferences) con que parte; por defecto, vacía. No se modifica. */
  memoria?: MemoriaNvs;
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
 * empezar el programa desde setup() en el punto elegido; el juez sigue.
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
  /** Avisos ya publicados: el simulador los lista por origen, no en el orden en que aparecen. */
  const publicados = new Set<string>();
  /** La memoria pasa de una corrida a la siguiente cuando el juez reinicia el programa. */
  let memoria = o.memoria ?? memoriaVacia();
  let memoriaPublicada = false;
  for (;;) {
    let poseReinicio: Pose | null = null;
    let sim!: Simulador;
    let escriturasPublicadas = 0;
    const publicar = () => {
      const escrituras = sim.memoria.escrituras;
      const cambioMemoria = !memoriaPublicada || escrituras !== escriturasPublicadas;
      memoriaPublicada = true;
      escriturasPublicadas = escrituras;
      const { x, y, z, yaw, pitch, roll } = sim.estado;
      const avisos = sim.avisos.filter(a => !publicados.has(a));
      for (const a of avisos) publicados.add(a);
      o.publicar({
        reinicio, t: sim.tiempoUs / 1e6, estado: { x, y, z, yaw, pitch, roll }, motores: sim.motores,
        sensores: sim.medirParaVista(azarVista), juez: juez.estado, serial: sim.tomarSerial(),
        avisos, mensaje,
        memoria: cambioMemoria ? { datos: sim.memoria.instantanea(), ultima: sim.memoria.ultima } : null,
      });
      mensaje = null;
      ultima = ahora();
    };
    sim = await Simulador.crear({
      modulo: o.modulo, mundo, robot: o.robot, poseInicial: pose, semilla: o.semilla, ajustes: o.ajustes,
      ambiente: o.pista.ambiente, memoria,
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
    memoria = sim.memoria.instantanea();
    if (r.motivo === 'error') return { motivo: 'error', error: r.error, juez: juez.estado, memoria };
    if (poseReinicio) {
      pose = poseReinicio;
      reinicio++;
      continue;
    }
    return { motivo: 'terminado', juez: juez.estado, memoria };
  }
}
