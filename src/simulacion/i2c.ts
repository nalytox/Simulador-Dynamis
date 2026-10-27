import type { ConfigRobot, SensorColor } from '../robot/config';
import type { LecturaTCS } from './sensores';

/**
 * El bus I2C a nivel de registros, para lo que se usa por I2C directo: el multiplexor TCA9548A y los
 * TCS34725 detrás de él. Los demás sensores se simulan a nivel de librería y aquí no responden; el
 * VL53L0X solo pregunta si está al alcance (su canal abierto). El simulador no distingue Wire de
 * Wire1: los dos llegan a este mismo bus.
 */
export const DIRECCION_MUX = 0x70;
export const DIRECCION_TCS = 0x29;

export interface EntornoI2C {
  /** Las cuentas del modelo del TCS34725 para ese sensor, ahora. */
  leerColor(sensor: SensorColor, integracionMs: number, ganancia: number, ledEncendido: boolean): LecturaTCS;
  /** Nivel (0 a 1) de un pin: el LED del sensor puede estar conectado a uno. */
  nivelPin(pin: number): number;
  ahoraUs(): number;
  avisar(texto: string): void;
}

// Registros del TCS34725 (hoja de datos).
const ENABLE = 0x00;
const ATIME = 0x01;
const WTIME = 0x03;
const CONTROL = 0x0f;
const ID = 0x12;
const STATUS = 0x13;
const CDATAL = 0x14;
const BDATAH = 0x1b;
const ULTIMO_REGISTRO = 0x1f;
/** Los registros que se pueden escribir: de ENABLE a CONTROL. */
const ULTIMO_ESCRIBIBLE = CONTROL;

const COMANDO = 0x80;
const FUNCION_ESPECIAL = 0x60;
const BORRAR_INTERRUPCION = 0x06;
const PON = 0x01;
const AEN = 0x02;
const AIEN = 0x10;
const AVALID = 0x01;
const AINT = 0x10;
const ID_TCS34725 = 0x44;
const GANANCIAS = [1, 4, 16, 60];

const AVISO_DOS_TCS = 'Dos TCS34725 responden a la vez en 0x29: abre un solo canal del multiplexor.';
const AVISO_CHOQUE_LASER = 'El VL53L0X y un TCS34725 responden a la vez en 0x29: abre en el multiplexor solo el canal del sensor que vas a usar.';
const AVISO_LASER_DIRECTO = 'En 0x29 está el VL53L0X, pero el simulador no lo tiene por I2C directo: usa la librería Adafruit_VL53L0X.';
const hex = (direccion: number) => `0x${direccion.toString(16).toUpperCase().padStart(2, '0')}`;

class ChipTCS {
  private readonly registros = new Uint8Array(ULTIMO_REGISTRO + 1);
  private puntero = 0;
  /** c, r, g, b de la última medida y cuándo se tomó: los registros guardan un ciclo de integración. */
  private datos = [0, 0, 0, 0];
  private medidaUs: number | null = null;
  /** Cuándo se encendió la integración (AEN), o null si está apagada. */
  private desdeUs: number | null = null;

  constructor(readonly sensor: SensorColor, private readonly entorno: EntornoI2C) {
    this.registros[ATIME] = 0xff;
    this.registros[WTIME] = 0xff;
    this.registros[ID] = ID_TCS34725;
  }

  private get ciclos(): number { return 256 - this.registros[ATIME]; }
  private get integracionMs(): number { return this.ciclos * 12 / 5; }

  /** Ya terminó una integración desde que se encendió. */
  private datosListos(): boolean {
    return this.desdeUs !== null && this.entorno.ahoraUs() - this.desdeUs >= this.integracionMs * 1000;
  }

  // El primer byte es el comando: elige el registro (o una función especial). Los siguientes se
  // escriben desde ahí, avanzando de a uno.
  escribir(bytes: Uint8Array): void {
    if (bytes.length === 0 || !(bytes[0] & COMANDO)) return;
    const comando = bytes[0];
    if ((comando & FUNCION_ESPECIAL) === FUNCION_ESPECIAL) {
      if ((comando & ULTIMO_REGISTRO) === BORRAR_INTERRUPCION) this.registros[STATUS] &= ~AINT;
      return;
    }
    this.puntero = comando & ULTIMO_REGISTRO;
    for (const valor of bytes.subarray(1)) {
      if (this.puntero <= ULTIMO_ESCRIBIBLE) this.escribirRegistro(this.puntero, valor);
      this.puntero = Math.min(ULTIMO_REGISTRO, this.puntero + 1);
    }
  }

  private escribirRegistro(registro: number, valor: number): void {
    if (registro === ENABLE) {
      const integrando = (valor & (PON | AEN)) === (PON | AEN);
      if (!integrando) this.desdeUs = null;
      else if (this.desdeUs === null) this.desdeUs = this.entorno.ahoraUs();
      if (this.desdeUs === null) this.medidaUs = null;
    }
    this.registros[registro] = valor;
  }

  leer(largo: number): Uint8Array {
    const salida = new Uint8Array(largo);
    let medido = false;
    for (let i = 0; i < largo; i++) {
      const r = this.puntero;
      if (r >= CDATAL && r <= BDATAH) {
        if (!medido) this.actualizarDatos();
        medido = true;
        const palabra = this.datos[(r - CDATAL) >> 1];
        salida[i] = (r - CDATAL) % 2 === 0 ? palabra & 0xff : palabra >> 8;
      } else if (r === STATUS) {
        salida[i] = (this.registros[STATUS] & ~AVALID) | (this.datosListos() ? AVALID : 0);
      } else {
        salida[i] = this.registros[r];
      }
      this.puntero = Math.min(ULTIMO_REGISTRO, this.puntero + 1);
    }
    return salida;
  }

  // Los registros cambian una vez por ciclo de integración: leerlos dos veces dentro del mismo ciclo
  // (como los 4 canales de getRawData) da la misma medida. Se mide con la pose del momento en que se lee.
  private actualizarDatos(): void {
    if (!this.datosListos()) {
      this.datos = [0, 0, 0, 0];
      this.medidaUs = null;
      return;
    }
    const ahora = this.entorno.ahoraUs();
    if (this.medidaUs !== null && ahora - this.medidaUs < this.integracionMs * 1000) return;
    this.medidaUs = ahora;
    const { led } = this.sensor;
    const ledEncendido = led === null ? !(this.registros[ENABLE] & AIEN) : this.entorno.nivelPin(led) > 0.5;
    const l = this.entorno.leerColor(this.sensor, this.integracionMs, GANANCIAS[this.registros[CONTROL] & 3], ledEncendido);
    const maximo = this.ciclos > 63 ? 65535 : 1024 * this.ciclos;
    this.datos = [l.c, l.r, l.g, l.b].map(v => Math.min(maximo, Math.max(0, Math.round(v))));
  }
}

export class BusI2C {
  private readonly chips: ChipTCS[];
  /** El canal del VL53L0X en el multiplexor, o null si está directo en el bus. */
  private readonly canalLaser: number | null;
  /** Dónde escucha el VL53L0X: 0x29 al encenderse, o la que le puso setAddress. */
  private direccionLaser = DIRECCION_TCS;
  private readonly hayMux: boolean;
  /** Los canales abiertos del multiplexor, un bit por canal. */
  private canales = 0;

  constructor(robot: ConfigRobot, private readonly entorno: EntornoI2C) {
    // Un robot guardado antes del segundo sensor no tiene tcs34725b ni canales.
    const sensores = [robot.tcs34725, ...(robot.tcs34725b?.instalado ? [robot.tcs34725b] : [])]
      .map(s => ({ ...s, canal: s.canal ?? null }));
    this.chips = sensores.map(s => new ChipTCS(s, entorno));
    this.canalLaser = robot.vl53l0x.canal ?? null;
    this.hayMux = sensores.some(s => s.canal !== null) || this.canalLaser !== null;
  }

  private alAlcance(canal: number | null): boolean {
    return canal === null || (this.hayMux && ((this.canales >> canal) & 1) === 1);
  }

  private visibles(): ChipTCS[] {
    return this.chips.filter(c => this.alAlcance(c.sensor.canal));
  }

  /**
   * Si el VL53L0X contesta ahora en `direccion` (0x29, o la que le puso setAddress). En su canal
   * cerrado no contesta y se avisa qué canal abrir; si en 0x29 también escucha un TCS34725, chocan.
   */
  vl53Responde(direccion: number): boolean {
    this.direccionLaser = direccion;
    if (!this.alAlcance(this.canalLaser)) {
      this.entorno.avisar(`El VL53L0X está en el canal ${this.canalLaser} del multiplexor (${hex(DIRECCION_MUX)}): ábrelo antes de usar el láser.`);
      return false;
    }
    if (direccion === DIRECCION_TCS && this.visibles().length > 0) this.entorno.avisar(AVISO_CHOQUE_LASER);
    return true;
  }

  /** Una escritura: true si algún dispositivo respondió (ACK). */
  escribir(direccion: number, bytes: Uint8Array): boolean {
    if (direccion === DIRECCION_MUX && this.hayMux) {
      if (bytes.length > 0) this.canales = bytes[bytes.length - 1];
      return true;
    }
    const chips = direccion === DIRECCION_TCS ? this.visibles() : [];
    for (const c of chips) c.escribir(bytes);
    if (chips.length === 0) this.sinRespuesta(direccion);
    else this.revisarChoqueLaser(direccion);
    return chips.length > 0;
  }

  private laserEn(direccion: number): boolean {
    return direccion === this.direccionLaser && this.alAlcance(this.canalLaser);
  }

  private revisarChoqueLaser(direccion: number): void {
    if (direccion === DIRECCION_TCS && this.laserEn(direccion)) this.entorno.avisar(AVISO_CHOQUE_LASER);
  }

  /** Una lectura de `largo` bytes, o null si nadie respondió. */
  leer(direccion: number, largo: number): Uint8Array | null {
    if (direccion === DIRECCION_MUX && this.hayMux) return new Uint8Array(largo).fill(this.canales);
    const chips = direccion === DIRECCION_TCS ? this.visibles() : [];
    if (chips.length === 0) {
      this.sinRespuesta(direccion);
      return null;
    }
    if (chips.length > 1) this.entorno.avisar(AVISO_DOS_TCS);
    this.revisarChoqueLaser(direccion);
    return chips[0].leer(largo);
  }

  private sinRespuesta(direccion: number): void {
    const inicio = `Nadie respondió en ${hex(direccion)}:`;
    if (direccion === DIRECCION_MUX) {
      this.entorno.avisar(`${inicio} tu robot no tiene multiplexor. Ponle a cada TCS34725 su canal en «Mi robot».`);
    } else if (direccion === DIRECCION_TCS && this.laserEn(direccion)) {
      this.entorno.avisar(AVISO_LASER_DIRECTO);
    } else if (direccion === DIRECCION_TCS && this.hayMux) {
      this.entorno.avisar(`${inicio} abre el canal del multiplexor donde está el TCS34725.`);
    } else {
      this.entorno.avisar(`${inicio} por I2C directo el simulador solo tiene el multiplexor TCA9548A y los TCS34725. Para los demás sensores usa sus librerías.`);
    }
  }
}
