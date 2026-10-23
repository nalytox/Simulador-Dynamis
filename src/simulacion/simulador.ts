import { crearImports, type Anfitrion } from './puente';
import { clasificarErrorEjecucion, ErrorSimulador, type ErrorEjecucion } from './errores';
import { Pines } from './pines';
import { pinesAMotores, type Motores } from './motores';
import { COSTOS_US, BUFER_SERIAL_BYTES, usPorCaracter } from './costos';
import { crearAzar, type Azar } from './azar';
import { ROBOT_POR_DEFECTO, type ConfigRobot } from '../robot/config';
import { mundoPlano } from '../mundo/plano';
import type { Mundo } from '../mundo/tipos';
import { MODELOS_POR_DEFECTO, poseVL53, puntosQTR, puntoTCS, type Ambiente, type LecturaMPU, type LecturaTCS, type ModelosSensores } from './sensores';
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
  /** ADC crudo de 12 bits para un pin. Por defecto, los pines del QTR salen de su modelo y el resto da 0. */
  lectorAnalogico?: (pin: number, sim: Simulador) => number;
  /** Modelos de sensores del profesor; los que falten usan los placeholders de src/modelos. */
  modelos?: Partial<ModelosSensores>;
  ambiente?: Ambiente;
  /** Valores de los parámetros @ajustar de esta prueba, por id (`grupo.nombre`); los que faltan usan el del código. */
  ajustes?: Record<string, number>;
}

export interface ResultadoEjecucion { motivo: 'tiempo' | 'error' | 'detenido'; tiempoUs: number; error?: ErrorEjecucion }

/** Lo que miden los sensores en un instante, para las tarjetas de la UI (no lo que leyó el programa). */
export interface LecturasVista { qtr: number[]; distanciaMm: number; color: LecturaTCS; mpu: LecturaMPU }

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
const SIN_OBJETIVO_VL53_MM = 8190;
const MAXIMO_CUENTAS_TCS = 65535;
/** Integración y ganancia con que la vista mira el TCS34725 (no cambian lo que configure el programa). */
const VISTA_TCS = { integracionMs: 24, ganancia: 4 };
const acotar = (v: number, max: number) => Math.min(max, Math.max(0, Math.round(v)));

/**
 * Ejecuta un programa Arduino compilado con tiempo virtual: cada llamada al núcleo avanza
 * el reloj y, con él, la física del robot.
 */
export class Simulador {
  private t = 0;
  private tFisica = 0;
  private limite = Infinity;
  private ejecutado = false;
  private detenidoAPedido = false;
  private errorInicial: unknown = null;
  private estadoActual: EstadoRobot;
  /** Estado antes del último paso de física (para el MPU6050). */
  private estadoAnterior: EstadoRobot;
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
  private readonly lectorAnalogico: ((pin: number, sim: Simulador) => number) | null;
  private readonly modelos: ModelosSensores;
  private readonly ambiente: Ambiente;
  private readonly ajustes: Record<string, number>;

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
    this.lectorAnalogico = o.lectorAnalogico ?? null;
    this.modelos = { ...MODELOS_POR_DEFECTO, ...o.modelos };
    this.ambiente = o.ambiente ?? { luz: 'normal' };
    this.ajustes = o.ajustes ?? {};
    this.estadoActual = this.dinamica.estadoInicial(o.poseInicial ?? { x: 0, y: 0, yaw: 0 }, this.robot, this.mundo);
    this.estadoAnterior = this.estadoActual;
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

  /**
   * Termina la corrida en el punto de sincronización actual (motivo 'detenido'). Sirve llamarla desde
   * alPasoFisica, que corta incluso dentro de un delay largo, o desde alAvanzar.
   */
  detener(): void {
    this.detenidoAPedido = true;
  }

  /**
   * Evalúa los 4 modelos en el estado actual con `azar`, no con el de los modelos: lo que se muestra
   * no cambia lo que lee el programa y la prueba sigue siendo reproducible.
   */
  medirParaVista(azar: Azar): LecturasVista {
    const pinLed = this.robot.tcs34725.led;
    const color = this.leerTCS(VISTA_TCS.integracionMs, VISTA_TCS.ganancia, pinLed === null || this.pinesSim.nivel(pinLed) > 0.5, azar);
    return {
      qtr: this.leerQTR(azar).map(v => acotar(v, MAXIMO_ADC_CRUDO)),
      distanciaMm: acotar(this.leerVL53(azar), SIN_OBJETIVO_VL53_MM),
      color: { r: acotar(color.r, MAXIMO_CUENTAS_TCS), g: acotar(color.g, MAXIMO_CUENTAS_TCS), b: acotar(color.b, MAXIMO_CUENTAS_TCS), c: acotar(color.c, MAXIMO_CUENTAS_TCS) },
      mpu: this.leerMPU(azar),
    };
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
      if (e instanceof FinDeTiempo) return { motivo: this.detenidoAPedido ? 'detenido' : 'tiempo', tiempoUs: this.t };
      return { motivo: 'error', tiempoUs: this.t, error: clasificarErrorEjecucion(e) };
    }
  }

  private avanzar(us: number): void {
    this.t = Math.min(this.t + us, this.limite);
    while (this.tFisica + this.dtFisicaUs <= this.t) {
      const motores = pinesAMotores(this.pinesSim, this.robot.motores);
      this.estadoAnterior = this.estadoActual;
      this.estadoActual = protegido('el modelo de dinámica', () => this.dinamica.pasoDinamica(
        this.estadoActual, motores, this.dtFisicaUs / 1e6, this.mundo, this.robot, this.azarModelos));
      this.tFisica += this.dtFisicaUs;
      const alPasoFisica = this.alPasoFisica;
      if (alPasoFisica) protegido('alPasoFisica', () => alPasoFisica(this.tFisica, this.estadoActual));
      if (this.detenidoAPedido) {
        this.t = this.tFisica;
        throw new FinDeTiempo();
      }
    }
    const alAvanzar = this.alAvanzar;
    if (alAvanzar) protegido('alAvanzar', () => alAvanzar(this));
    if (this.detenidoAPedido || this.t >= this.limite) throw new FinDeTiempo();
  }

  /** ADC crudo de un pin: los pines del QTR salen de su modelo (el sensor i es robot.qtr.pines[i]); el resto da 0. */
  private leerPinQTR(pin: number): number {
    const indice = this.robot.qtr.pines.indexOf(pin);
    if (indice < 0) return 0;
    return this.leerQTR(this.azarModelos)[indice] ?? 0;
  }

  // Cada modelo de sensor se evalúa en el estado actual; el azar decide si es para el programa o para la vista.
  private leerQTR(azar: Azar): number[] {
    const emisor = this.robot.qtr.emisor;
    return protegido('el modelo del QTR', () => this.modelos.leerQTR({
      t: this.t / 1e6, estado: this.estadoActual, sensores: puntosQTR(this.estadoActual, this.robot),
      emisoresEncendidos: emisor === null || this.pinesSim.nivel(emisor) > 0.5,
      mundo: this.mundo, ambiente: this.ambiente, azar }));
  }

  private leerVL53(azar: Azar): number {
    return protegido('el modelo del VL53L0X', () => this.modelos.leerVL53L0X({
      t: this.t / 1e6, estado: this.estadoActual, sensor: poseVL53(this.estadoActual, this.robot), mundo: this.mundo, azar }));
  }

  private leerMPU(azar: Azar): LecturaMPU {
    return protegido('el modelo del MPU6050', () => this.modelos.leerMPU6050({
      t: this.t / 1e6, dt: this.dtFisicaUs / 1e6, estado: this.estadoActual, estadoAnterior: this.estadoAnterior,
      montaje: this.robot.mpu6050, mundo: this.mundo, azar }));
  }

  private leerTCS(integracionMs: number, ganancia: number, ledEncendido: boolean, azar: Azar): LecturaTCS {
    return protegido('el modelo del TCS34725', () => this.modelos.leerTCS34725({
      t: this.t / 1e6, estado: this.estadoActual, sensor: puntoTCS(this.estadoActual, this.robot),
      tiempoIntegracionMs: integracionMs, ganancia, ledEncendido, mundo: this.mundo, ambiente: this.ambiente, azar }));
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
        const lector = this.lectorAnalogico;
        const lectura = lector ? protegido('el lector analógico', () => lector(pin, this)) : this.leerPinQTR(pin);
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
      aviso: texto => { this.avisar(texto); this.avanzar(COSTOS_US.aviso); },
      vl53Medir: () => acotar(this.leerVL53(this.azarModelos), SIN_OBJETIVO_VL53_MM),
      mpuLeer: () => {
        this.avanzar(COSTOS_US.lecturaMpu);
        const l = this.leerMPU(this.azarModelos);
        return [l.ax, l.ay, l.az, l.gx, l.gy, l.gz, l.temp];
      },
      tcsLeer: (integracionUs, ganancia, led) => {
        const pinLed = this.robot.tcs34725.led;
        const l = this.leerTCS(integracionUs / 1000, ganancia, pinLed === null ? led : p.nivel(pinLed) > 0.5, this.azarModelos);
        return [l.r, l.g, l.b, l.c];
      },
      serialAvailable: () => {
        this.avisar(AVISO_SERIAL_SIN_ENTRADA);
        this.avanzar(COSTOS_US.serialAvailable);
        return 0;
      },
      azarU32: () => Math.floor(this.azarPrograma() * 4294967296) >>> 0,
      ajustable: (grupo, nombre, valor) => {
        const propio = this.ajustes[`${grupo}.${nombre}`];
        return typeof propio === 'number' && Number.isFinite(propio) ? propio : valor;
      },
      salidaEstandar: bytes => { this.texto += this.decodificadorEstandar.decode(bytes, { stream: true }); },
      tiempoNs: () => BigInt(Math.floor(this.t)) * 1000n,
    };
  }
}
