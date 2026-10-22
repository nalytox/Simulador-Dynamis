import { crearImports, type Anfitrion } from './puente';
import { clasificarErrorEjecucion, ErrorSimulador, type ErrorEjecucion } from './errores';
import { Pines } from './pines';
import { pinesAMotores, type Motores } from './motores';
import { COSTOS_US, BUFER_SERIAL_BYTES, usPorCaracter } from './costos';
import { crearAzar, type Azar } from './azar';
import { ROBOT_POR_DEFECTO, type ConfigRobot } from '../robot/config';
import { mundoPlano } from '../mundo/plano';
import type { Mundo } from '../mundo/tipos';
import * as dinamicaPlaceholder from '../modelos/dinamica.js';

export interface Pose { x: number; y: number; yaw: number }

export interface EstadoRobot {
  x: number; y: number; z: number; yaw: number; pitch: number; roll: number;
  [campo: string]: unknown;
}

export interface ModeloDinamica {
  estadoInicial(pose: Pose, robot: ConfigRobot, mundo: Mundo): EstadoRobot;
  pasoDinamica(e: EstadoRobot, m: Motores, dt: number, mundo: Mundo, robot: ConfigRobot, azar: Azar): EstadoRobot;
}

export interface OpcionesSimulador {
  modulo: WebAssembly.Module;
  robot?: ConfigRobot;
  mundo?: Mundo;
  dinamica?: ModeloDinamica;
  poseInicial?: Pose;
  semilla?: number;
  dtFisicaUs?: number;
  alAvanzar?: (sim: Simulador) => void;
  /** Se llama después de cada paso de física con su tiempo (µs), también dentro de un delay largo. */
  alPasoFisica?: (tUs: number, estado: EstadoRobot) => void;
  /** ADC crudo de 12 bits para un pin; por defecto 0 (la fase 3 conecta el QTR). */
  lectorAnalogico?: (pin: number, sim: Simulador) => number;
}

export interface ResultadoEjecucion { motivo: 'tiempo' | 'error'; tiempoUs: number; error?: ErrorEjecucion }

interface ExportsPrograma {
  memory: WebAssembly.Memory;
  _initialize?: () => void;
  dyn_setup: () => void;
  dyn_loop: () => void;
}

/** Se lanza desde un import para cortar la ejecución del programa al llegar al límite. */
class FinDeTiempo extends Error {}

/** Ejecuta código del simulador o del profe; si falla, el error no se le atribuye al estudiante. */
function protegido<T>(origen: string, f: () => T): T {
  try {
    return f();
  } catch (e) {
    throw new ErrorSimulador(origen, e);
  }
}

const AVISO_SERIAL_SIN_BEGIN = 'Usaste Serial.print sin Serial.begin(): en el robot real no se verá nada.';
const AVISO_SERIAL_SIN_ENTRADA = 'En el simulador nadie escribe por el Serial: Serial.available() siempre da 0.';
const BITS_ADC_POR_DEFECTO = 12;
const MAXIMO_ADC_CRUDO = 4095;
const BAUDIOS_POR_DEFECTO = 115200;

/**
 * Ejecuta un programa Arduino compilado con tiempo virtual: cada llamada al núcleo avanza
 * el reloj y, con él, la física del robot.
 */
export class Simulador {
  private t = 0;
  private tFisica = 0;
  private limite = Infinity;
  private ejecutado = false;
  private errorInicial: unknown = null;
  private estadoActual: EstadoRobot;
  private exports!: ExportsPrograma;

  private readonly pinesSim = new Pines();
  private readonly robot: ConfigRobot;
  private readonly mundo: Mundo;
  private readonly dinamica: ModeloDinamica;
  private readonly dtFisicaUs: number;
  private readonly azarPrograma: Azar;
  private readonly azarModelos: Azar;
  private readonly alAvanzar?: (sim: Simulador) => void;
  private readonly alPasoFisica?: (tUs: number, estado: EstadoRobot) => void;
  private readonly lectorAnalogico: (pin: number, sim: Simulador) => number;

  private bitsAdc = BITS_ADC_POR_DEFECTO;
  private serialActivo = false;
  private baudios = BAUDIOS_POR_DEFECTO;
  private colaSerial = 0;
  private tUltimoSerial = 0;
  private texto = '';
  private readonly decodificadorSerial = new TextDecoder('utf-8');
  private readonly decodificadorEstandar = new TextDecoder('utf-8');
  private readonly avisosPropios: string[] = [];

  private constructor(o: OpcionesSimulador) {
    this.robot = o.robot ?? ROBOT_POR_DEFECTO;
    this.mundo = o.mundo ?? mundoPlano();
    this.dinamica = o.dinamica ?? (dinamicaPlaceholder as unknown as ModeloDinamica);
    this.dtFisicaUs = o.dtFisicaUs ?? 1000;
    const semilla = o.semilla ?? 1;
    this.azarPrograma = crearAzar(semilla);
    this.azarModelos = crearAzar(semilla ^ 0x9e3779b9);
    this.alAvanzar = o.alAvanzar;
    this.alPasoFisica = o.alPasoFisica;
    this.lectorAnalogico = o.lectorAnalogico ?? (() => 0);
    this.estadoActual = this.dinamica.estadoInicial(o.poseInicial ?? { x: 0, y: 0, yaw: 0 }, this.robot, this.mundo);
  }

  /** Instancia el programa y ejecuta sus constructores globales (_initialize). */
  static async crear(o: OpcionesSimulador): Promise<Simulador> {
    const sim = new Simulador(o);
    const imports = crearImports(o.modulo, sim.anfitrion(), () => sim.exports.memory);
    const instancia = await WebAssembly.instantiate(o.modulo, imports);
    sim.exports = instancia.exports as unknown as ExportsPrograma;
    try {
      sim.exports._initialize?.();
    } catch (e) {
      sim.errorInicial = e;
    }
    return sim;
  }

  get tiempoUs(): number { return this.t; }
  get estado(): EstadoRobot { return this.estadoActual; }
  get motores(): Motores { return pinesAMotores(this.pinesSim, this.robot.motores); }
  get pines(): Pines { return this.pinesSim; }

  get avisos(): string[] {
    return [...new Set([...this.pinesSim.avisos.map(a => a.mensaje), ...this.avisosPropios])];
  }

  /** Entrega y vacía el texto acumulado de Serial y printf. */
  tomarSerial(): string {
    const texto = this.texto;
    this.texto = '';
    return texto;
  }

  /** Corre setup() y luego loop() hasta que pasen `duracionUs` de tiempo virtual o haya un error. */
  ejecutar(duracionUs: number): ResultadoEjecucion {
    if (this.ejecutado) throw new Error('ejecutar solo se puede llamar una vez por simulador');
    this.ejecutado = true;
    this.limite = this.t + duracionUs;
    try {
      if (this.errorInicial) throw this.errorInicial;
      this.exports.dyn_setup();
      for (;;) {
        this.avanzar(COSTOS_US.llamadaLoop);
        this.exports.dyn_loop();
      }
    } catch (e) {
      if (e instanceof FinDeTiempo) return { motivo: 'tiempo', tiempoUs: this.t };
      return { motivo: 'error', tiempoUs: this.t, error: clasificarErrorEjecucion(e) };
    }
  }

  private avanzar(us: number): void {
    this.t = Math.min(this.t + us, this.limite);
    while (this.tFisica + this.dtFisicaUs <= this.t) {
      const motores = pinesAMotores(this.pinesSim, this.robot.motores);
      this.estadoActual = protegido('el modelo de dinámica', () => this.dinamica.pasoDinamica(
        this.estadoActual, motores, this.dtFisicaUs / 1e6, this.mundo, this.robot, this.azarModelos));
      this.tFisica += this.dtFisicaUs;
      const alPasoFisica = this.alPasoFisica;
      if (alPasoFisica) protegido('alPasoFisica', () => alPasoFisica(this.tFisica, this.estadoActual));
    }
    const alAvanzar = this.alAvanzar;
    if (alAvanzar) protegido('alAvanzar', () => alAvanzar(this));
    if (this.t >= this.limite) throw new FinDeTiempo();
  }

  private avisar(mensaje: string): void {
    if (!this.avisosPropios.includes(mensaje)) this.avisosPropios.push(mensaje);
  }

  private escribirSerial(bytes: Uint8Array): void {
    if (!this.serialActivo) {
      this.avisar(AVISO_SERIAL_SIN_BEGIN);
      return;
    }
    const usCaracter = usPorCaracter(this.baudios);
    const drenar = () => {
      this.colaSerial = Math.max(0, this.colaSerial - (this.t - this.tUltimoSerial) / usCaracter);
      this.tUltimoSerial = this.t;
    };
    drenar();
    const espacio = BUFER_SERIAL_BYTES - this.colaSerial;
    if (bytes.length > espacio) {
      this.avanzar((bytes.length - espacio) * usCaracter);
      drenar();
    }
    this.colaSerial = Math.min(BUFER_SERIAL_BYTES, this.colaSerial + bytes.length);
    this.texto += this.decodificadorSerial.decode(bytes, { stream: true });
  }

  private anfitrion(): Anfitrion {
    const p = this.pinesSim;
    return {
      millis: () => { this.avanzar(COSTOS_US.millis); return Math.floor(this.t / 1000); },
      micros: () => { this.avanzar(COSTOS_US.micros); return Math.floor(this.t); },
      // delay(0) igual cede el procesador: sin un costo mínimo, un ciclo de delay(0) congelaría el tiempo.
      delay: ms => this.avanzar(Math.max(ms * 1000, COSTOS_US.yield)),
      delayUs: us => this.avanzar(Math.max(us, COSTOS_US.yield)),
      rendir: () => this.avanzar(COSTOS_US.yield),
      pinMode: (pin, modo) => { this.avanzar(COSTOS_US.pinMode); p.pinMode(pin, modo); },
      digitalWrite: (pin, valor) => { this.avanzar(COSTOS_US.digitalWrite); p.digitalWrite(pin, valor); },
      digitalRead: pin => { this.avanzar(COSTOS_US.digitalRead); return p.digitalRead(pin); },
      analogRead: pin => {
        this.avanzar(COSTOS_US.analogRead);
        const lectura = protegido('el lector analógico', () => this.lectorAnalogico(pin, this));
        const crudo = Math.min(MAXIMO_ADC_CRUDO, Math.max(0, Math.round(lectura)));
        return Math.round(crudo * (2 ** this.bitsAdc - 1) / MAXIMO_ADC_CRUDO);
      },
      analogReadResolution: bits => { this.bitsAdc = Math.min(16, Math.max(1, bits)); },
      analogWrite: (pin, valor) => { this.avanzar(COSTOS_US.analogWrite); p.analogWrite(pin, valor); },
      analogWriteResolution: (pin, bits) => p.analogWriteResolution(pin, bits),
      ledcAttach: (pin, freq, bits) => p.ledcAttach(pin, freq, bits),
      ledcWrite: (pin, duty) => { this.avanzar(COSTOS_US.ledcWrite); return p.ledcWrite(pin, duty); },
      ledcDetach: pin => p.ledcDetach(pin),
      serialBegin: baudios => {
        this.serialActivo = true;
        this.baudios = baudios || BAUDIOS_POR_DEFECTO;
        this.colaSerial = 0;
        this.tUltimoSerial = this.t;
      },
      serialWrite: bytes => this.escribirSerial(bytes),
      serialAvailable: () => {
        this.avisar(AVISO_SERIAL_SIN_ENTRADA);
        this.avanzar(COSTOS_US.serialAvailable);
        return 0;
      },
      azarU32: () => Math.floor(this.azarPrograma() * 4294967296) >>> 0,
      salidaEstandar: bytes => { this.texto += this.decodificadorEstandar.decode(bytes, { stream: true }); },
      tiempoNs: () => BigInt(Math.floor(this.t)) * 1000n,
    };
  }
}
