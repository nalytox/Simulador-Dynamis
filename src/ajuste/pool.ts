import { puntosDePartida } from '../pista/puntos';
import type { Pista } from '../pista/tipos';
import type { ConfigRobot } from '../robot/config';
import type { RegistroPrueba } from './contrato';
import { registroDeCicloSinFin, resumirRegistro, type ResultadoPrueba } from './prueba';
import type { MensajeAlAjuste, MensajeDelAjuste } from './trabajador';

/** Corre pruebas de entrenamiento en varios workers a la vez. */
export interface PoolPruebas {
  readonly tamano: number;
  probar(valores: Record<string, number>, semilla: number): Promise<ResultadoPrueba>;
  cerrar(): void;
}

export interface OpcionesPool {
  modulo: WebAssembly.Module;
  pista: Pista;
  robot: ConfigRobot;
  duracionS: number;
  tamano: number;
  crearTrabajador: () => Worker;
  /** La recompensa del profe, para una prueba cortada por ciclo sin fin (el worker ya no existe). */
  recompensaPrincipal: (r: RegistroPrueba) => number;
  /** Tiempo real sin latidos antes de dar una prueba por colgada (2 s por defecto). */
  esperaCicloSinFinMs?: number;
}

interface Pendiente {
  id: number;
  valores: Record<string, number>;
  semilla: number;
  resolver(r: ResultadoPrueba): void;
  rechazar(e: Error): void;
}

/** `arranco`: el worker ya latió en la prueba actual (cargar el worker no cuenta como ciclo sin fin). */
interface Espacio { trabajador: Worker; actual: Pendiente | null; ultimoLatido: number; ultimoCambio: number; arranco: boolean }

const REVISAR_CADA_MS = 500;
const ESPERA_POR_DEFECTO_MS = 2000;
/** Lo más que puede tardar un worker en cargar y tomar su prueba, incluso en un Chromebook lento. */
const ESPERA_CARGA_MS = 20_000;

/** El detalle técnico de un worker que no cargó: el error, el archivo y la línea (spec §14). */
function detalleDeCarga(e: unknown): string {
  const { message, filename, lineno } = (e ?? {}) as Partial<ErrorEvent>;
  const donde = filename ? ` (${filename}${lineno ? `:${lineno}` : ''})` : '';
  return `El worker de la prueba se detuvo: ${message || 'error al cargar'}${donde}`;
}

function errorCon(nombre: string, mensaje: string, tecnico?: string): Error {
  return Object.assign(new Error(mensaje), { name: nombre }, tecnico === undefined ? {} : { tecnico });
}

/**
 * Pool de workers (spec §11.2): cada uno recibe el módulo una vez y después pruebas, de a una. Un worker
 * cuyo programa deja de avanzar (sin latidos) se termina y se reemplaza; esa prueba vale como
 * 'ciclo-sin-fin' y su recompensa se calcula aquí.
 */
export function crearPool(o: OpcionesPool): PoolPruebas {
  const espera = o.esperaCicloSinFinMs ?? ESPERA_POR_DEFECTO_MS;
  const latidosBuffer = new SharedArrayBuffer(4 * o.tamano);
  const latidos = new Int32Array(latidosBuffer);
  const partida = puntosDePartida(o.pista)[0].pose;
  const cola: Pendiente[] = [];
  let siguienteId = 1;
  let cerrado = false;

  const iniciar = (indice: number): Worker => {
    const trabajador = o.crearTrabajador();
    trabajador.onmessage = e => recibir(indice, trabajador, e.data as MensajeDelAjuste);
    trabajador.onerror = e => reemplazar(indice, errorCon('ErrorSimulador', 'El worker de la prueba se detuvo.', detalleDeCarga(e)));
    const mensaje: MensajeAlAjuste = { tipo: 'iniciar', modulo: o.modulo, pista: o.pista, robot: o.robot, duracionS: o.duracionS, latidos: latidosBuffer, indice };
    trabajador.postMessage(mensaje);
    return trabajador;
  };
  const espacios: Espacio[] = Array.from({ length: o.tamano }, (_, i) => ({ trabajador: iniciar(i), actual: null, ultimoLatido: 0, ultimoCambio: 0, arranco: false }));

  const despachar = () => {
    espacios.forEach((espacio, indice) => {
      if (cerrado || espacio.actual || cola.length === 0) return;
      const p = cola.shift()!;
      espacio.actual = p;
      espacio.ultimoLatido = Atomics.load(latidos, indice);
      espacio.ultimoCambio = Date.now();
      espacio.arranco = false;
      const mensaje: MensajeAlAjuste = { tipo: 'probar', id: p.id, valores: p.valores, semilla: p.semilla };
      espacio.trabajador.postMessage(mensaje);
    });
  };

  const recibir = (indice: number, origen: Worker, m: MensajeDelAjuste) => {
    const espacio = espacios[indice];
    if (origen !== espacio.trabajador || !espacio.actual || m.id !== espacio.actual.id) return;
    const p = espacio.actual;
    espacio.actual = null;
    if (m.tipo === 'resultado') p.resolver(m.resultado);
    else p.rechazar(errorCon(m.error.nombre, m.error.mensaje, m.error.tecnico));
    despachar();
  };

  /** Termina el worker de un espacio y pone uno nuevo; la prueba en curso termina con `error`, o como ciclo sin fin. */
  function reemplazar(indice: number, error: Error | null): void {
    const espacio = espacios[indice];
    if (cerrado) return;
    espacio.trabajador.terminate();
    espacio.trabajador = iniciar(indice);
    const p = espacio.actual;
    espacio.actual = null;
    if (p) {
      if (error) {
        p.rechazar(error);
      } else {
        const registro = registroDeCicloSinFin(p.valores, p.semilla, o.duracionS);
        try {
          const recompensa = o.recompensaPrincipal(registro);
          if (typeof recompensa !== 'number' || !Number.isFinite(recompensa)) {
            throw errorCon('ErrorSimulador', `calcularRecompensa devolvió ${String(recompensa)}, que no es un número finito.`);
          }
          p.resolver({ valores: p.valores, recompensa, resumen: resumirRegistro(registro, 0), trayectoria: [{ x: partida.x, y: partida.y }], semilla: p.semilla });
        } catch (e) {
          p.rechazar(e instanceof Error ? e : errorCon('ErrorSimulador', String(e)));
        }
      }
    }
    despachar();
  }

  const vigilante = setInterval(() => {
    espacios.forEach((espacio, indice) => {
      if (!espacio.actual) return;
      const latido = Atomics.load(latidos, indice);
      if (latido !== espacio.ultimoLatido) {
        espacio.ultimoLatido = latido;
        espacio.ultimoCambio = Date.now();
        espacio.arranco = true;
      } else if (espacio.arranco && Date.now() - espacio.ultimoCambio >= espera) {
        reemplazar(indice, null);
      } else if (!espacio.arranco && Date.now() - espacio.ultimoCambio >= ESPERA_CARGA_MS) {
        reemplazar(indice, errorCon('ErrorSimulador', 'El worker de la prueba no arrancó.'));
      }
    });
  }, REVISAR_CADA_MS);

  return {
    tamano: o.tamano,
    probar(valores, semilla) {
      if (cerrado) return Promise.reject(errorCon('Cancelado', 'El entrenamiento se detuvo.'));
      return new Promise<ResultadoPrueba>((resolver, rechazar) => {
        cola.push({ id: siguienteId++, valores, semilla, resolver, rechazar });
        despachar();
      });
    },
    cerrar() {
      if (cerrado) return;
      cerrado = true;
      clearInterval(vigilante);
      const cancelado = errorCon('Cancelado', 'El entrenamiento se detuvo.');
      for (const espacio of espacios) {
        espacio.trabajador.terminate();
        espacio.actual?.rechazar(cancelado);
        espacio.actual = null;
      }
      for (const p of cola.splice(0)) p.rechazar(cancelado);
    },
  };
}
