import { Simulador } from '../simulacion/simulador';
import { ErrorSimulador } from '../simulacion/errores';
import { crearAzar } from '../simulacion/azar';
import { Juez } from '../juez/juez';
import { crearMundo } from '../mundo/pista';
import { puntosDePartida } from '../pista/puntos';
import { huellaRobot, type ConfigRobot } from '../robot/config';
import { TAMANO_BALDOSA, type Pista } from '../pista/tipos';
import { esFaltaImplementar, type ModuloRecompensa, type MotivoFin, type PasoRegistro, type RegistroPrueba, type ResumenPrueba } from './contrato';

/** Lo que vuelve al hilo principal de cada prueba (spec §11.2): sin el registro completo. */
export interface ResultadoPrueba {
  valores: Record<string, number>;
  recompensa: number;
  resumen: ResumenPrueba;
  /** Posiciones del robot (mm), a lo más MAXIMO_TRAYECTORIA, con la primera y la última. */
  trayectoria: { x: number; y: number }[];
  semilla: number;
}

export interface OpcionesPruebaAjuste {
  modulo: WebAssembly.Module;
  pista: Pista;
  robot: ConfigRobot;
  valores: Record<string, number>;
  semilla: number;
  duracionS: number;
  recompensa: ModuloRecompensa;
  /** Cada cuánto se registra un paso (10 ms por defecto). */
  intervaloMs?: number;
  /** Se llama en cada paso de física: el pool lo usa para saber que el worker sigue vivo. */
  alLatido?: () => void;
}

const MAXIMO_TRAYECTORIA = 200;
/** Las lecturas del registro usan su propio azar, como la vista: así no cambian lo que lee el programa. */
const MEZCLA_LECTURAS = 0x5bd1e995;
const EPSILON_US = 1e-3;

export function resumirRegistro(r: RegistroPrueba, t: number): ResumenPrueba {
  return {
    motivo: r.fin.motivo, detalle: r.fin.detalle, t,
    puntaje: r.juez?.puntaje ?? 0,
    hitos: r.juez?.hitos.filter(h => h === 'alcanzado').length ?? 0,
    meta: r.juez?.meta ?? false,
  };
}

/** El registro de una prueba que se cortó porque el programa no avanzaba el tiempo. */
export function registroDeCicloSinFin(valores: Record<string, number>, semilla: number, duracionS: number): RegistroPrueba {
  return { valores, semilla, duracionS, pasos: [], juez: null, fin: { motivo: 'ciclo-sin-fin', detalle: null } };
}

function diezmar<T>(lista: T[], maximo: number): T[] {
  if (lista.length <= maximo) return lista;
  return Array.from({ length: maximo }, (_, i) => lista[Math.round((i * (lista.length - 1)) / (maximo - 1))]);
}

/** Ejecuta código del profe: FaltaImplementar pasa tal cual; lo demás es un error del simulador, no del estudiante. */
function delProfe<T>(f: () => T): T {
  try {
    return f();
  } catch (e) {
    throw esFaltaImplementar(e) ? e : new ErrorSimulador('la recompensa del profe', e);
  }
}

/**
 * Una prueba del entrenamiento (spec §11.2): una instancia nueva del programa con los valores dados,
 * en la partida, sin ritmo de tiempo real, hasta la duración, hasta que debeTerminar lo pida o hasta
 * que el juez la termine. Registra un paso cada 10 ms y calcula la recompensa del profe.
 */
export async function ejecutarPruebaDeAjuste(o: OpcionesPruebaAjuste): Promise<ResultadoPrueba> {
  const mundo = crearMundo(o.pista);
  const juez = new Juez(mundo, o.robot, { desde: 'partida' });
  const partida = puntosDePartida(o.pista).find(p => p.id === 'partida')!;
  const azarLecturas = crearAzar(o.semilla ^ MEZCLA_LECTURAS);
  const intervaloUs = (o.intervaloMs ?? 10) * 1000;
  const ancho = o.pista.columnas * TAMANO_BALDOSA;
  const alto = o.pista.filas * TAMANO_BALDOSA;

  const pasos: PasoRegistro[] = [];
  let proximoUs = intervaloUs;
  let eventosVistos = 0;
  let chocando = false;
  let afuera = false;
  let fin: { motivo: MotivoFin; detalle: string | null } | null = null;
  let errorProfe: unknown = null;
  let sim!: Simulador;

  const registrar = (tUs: number) => {
    const { x, y, z, yaw, pitch, roll } = sim.estado;
    const eventos = juez.estado.eventos.slice(eventosVistos).map(e => e.tipo as string);
    eventosVistos += eventos.length;
    const choca = mundo.colisiona(huellaRobot(x, y, yaw, o.robot)) !== null;
    if (choca && !chocando) eventos.push('colision');
    chocando = choca;
    const fuera = x < 0 || y < 0 || x >= ancho || y >= alto;
    if (fuera && !afuera) eventos.push('fuera-de-pista');
    afuera = fuera;
    const paso: PasoRegistro = {
      t: tUs / 1e6, estado: { x, y, z, yaw, pitch, roll }, lecturas: sim.medirParaVista(azarLecturas), motores: sim.motores, eventos,
    };
    pasos.push(paso);
    return paso;
  };

  sim = await Simulador.crear({
    modulo: o.modulo, mundo, robot: o.robot, poseInicial: partida.pose, semilla: o.semilla, ajustes: o.valores,
    ambiente: o.pista.ambiente,
    alPasoFisica: (tUs, estado) => {
      o.alLatido?.();
      juez.actualizar(tUs, estado);
      if (tUs + EPSILON_US >= proximoUs) {
        proximoUs += intervaloUs;
        const paso = registrar(tUs);
        try {
          const motivo = delProfe(() => o.recompensa.debeTerminar(paso, mundo));
          // false o nada (undefined, null) es seguir; un texto (u otro valor) es el motivo para terminar.
          if (motivo !== false && motivo !== undefined && motivo !== null) {
            fin = { motivo: 'termino', detalle: String(motivo) };
            return sim.detener();
          }
        } catch (e) {
          errorProfe = e;
          return sim.detener();
        }
      }
      if (juez.termino) {
        fin = { motivo: 'juez', detalle: null };
        sim.detener();
      }
    },
  });
  const r = sim.ejecutar(o.duracionS * 1e6);
  if (errorProfe) throw errorProfe;
  if (r.motivo === 'error') {
    // Una falla de los modelos o del simulador no es del estudiante: detiene el entrenamiento.
    if (r.error!.tipo === 'simulador') throw new ErrorSimulador('el simulador', new Error(r.error!.tecnico));
    fin = { motivo: 'error', detalle: r.error!.mensaje };
  }

  const registro: RegistroPrueba = {
    valores: o.valores, semilla: o.semilla, duracionS: o.duracionS, pasos, juez: juez.estado,
    fin: fin ?? { motivo: 'tiempo', detalle: null },
  };
  const recompensa = delProfe(() => o.recompensa.calcularRecompensa(registro));
  if (typeof recompensa !== 'number' || !Number.isFinite(recompensa)) {
    throw new ErrorSimulador('la recompensa del profe', new Error(`calcularRecompensa devolvió ${String(recompensa)}, que no es un número finito.`));
  }
  const trayectoria = pasos.length > 0
    ? diezmar(pasos.map(p => ({ x: p.estado.x, y: p.estado.y })), MAXIMO_TRAYECTORIA)
    : [{ x: partida.pose.x, y: partida.pose.y }];
  return { valores: o.valores, recompensa, resumen: resumirRegistro(registro, r.tiempoUs / 1e6), trayectoria, semilla: o.semilla };
}
