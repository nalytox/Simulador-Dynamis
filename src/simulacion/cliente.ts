import { crearControl, fijarVelocidad, pausar, pedir, IDX, type Pedido } from './control';
import type { FinEjecucion, Instantanea } from './ejecucion';
import type { MensajeAlSimulador, MensajeDelSimulador } from './trabajador';
import type { Pista } from '../pista/tipos';
import type { ConfigRobot } from '../robot/config';

export interface EventosSimulacion {
  alInstantanea(i: Instantanea): void;
  alTerminar(f: FinEjecucion): void;
  /** Más de 2 s reales sin latido mientras corre: el programa quedó en un ciclo sin puntos de sincronización. */
  alAtascarse(): void;
}

export interface OpcionesInicio {
  modulo: WebAssembly.Module;
  pista: Pista;
  robot: ConfigRobot;
  desde: string;
  semilla: number;
  /** Centésimas de la velocidad real (100 = ×1). */
  velocidad: number;
}

const REVISAR_CADA_MS = 500;
const SIN_LATIDO_MS = 2000;

/**
 * Controla el worker de simulación desde la UI: lo inicia, lo pausa y le pide reinicios por el
 * bloque de control, y lo termina al detener (así un while(1){} nunca congela la página).
 */
export class ClienteSimulacion {
  private trabajador: Worker | null = null;
  private control: Int32Array | null = null;
  private vigilante: ReturnType<typeof setInterval> | null = null;
  private ultimoLatido = 0;
  private ultimoCambio = 0;
  private avisado = false;
  private pausado = false;

  constructor(
    private readonly eventos: EventosSimulacion,
    private readonly crearTrabajador: () => Worker = () => new Worker(new URL('./trabajador.ts', import.meta.url), { type: 'module' }),
  ) {}

  get corriendo(): boolean { return this.trabajador !== null; }
  get enPausa(): boolean { return this.pausado; }

  iniciar(o: OpcionesInicio): void {
    if (this.trabajador) this.detener();
    const control = crearControl();
    fijarVelocidad(control, o.velocidad);
    const trabajador = this.crearTrabajador();
    trabajador.onmessage = e => this.recibir(trabajador, e.data as MensajeDelSimulador);
    const mensaje: MensajeAlSimulador = {
      tipo: 'iniciar', modulo: o.modulo, pista: o.pista, robot: o.robot, desde: o.desde, semilla: o.semilla,
      control: control.buffer as SharedArrayBuffer,
    };
    trabajador.postMessage(mensaje);
    this.trabajador = trabajador;
    this.control = control;
    this.pausado = false;
    this.avisado = false;
    this.ultimoLatido = Atomics.load(control, IDX.latido);
    this.ultimoCambio = Date.now();
    this.vigilante = setInterval(() => this.vigilar(), REVISAR_CADA_MS);
  }

  pausar(): void {
    if (!this.control) return;
    pausar(this.control, true);
    this.pausado = true;
  }

  seguir(): void {
    if (!this.control) return;
    pausar(this.control, false);
    this.pausado = false;
  }

  fijarVelocidad(centesimas: number): void {
    if (this.control) fijarVelocidad(this.control, centesimas);
  }

  pedir(p: Pedido): void {
    if (this.control) pedir(this.control, p);
  }

  detener(): void {
    this.trabajador?.terminate();
    this.limpiar();
  }

  private limpiar(): void {
    if (this.vigilante !== null) clearInterval(this.vigilante);
    this.vigilante = null;
    this.trabajador = null;
    this.control = null;
    this.pausado = false;
  }

  private vigilar(): void {
    if (!this.control || this.avisado) return;
    const latido = Atomics.load(this.control, IDX.latido);
    // En pausa el programa no avanza a propósito: se cuenta de nuevo al seguir.
    if (this.pausado || latido !== this.ultimoLatido) {
      this.ultimoLatido = latido;
      this.ultimoCambio = Date.now();
      return;
    }
    if (Date.now() - this.ultimoCambio >= SIN_LATIDO_MS) {
      this.avisado = true;
      this.eventos.alAtascarse();
    }
  }

  private recibir(origen: Worker, m: MensajeDelSimulador): void {
    if (origen !== this.trabajador) return;
    if (m.tipo === 'instantanea') {
      this.eventos.alInstantanea(m.datos);
      return;
    }
    origen.terminate();
    this.limpiar();
    this.eventos.alTerminar(m.datos);
  }
}
