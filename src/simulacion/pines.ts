import { GPIO_ESP32, SOLO_ENTRADA_ESP32 } from '../robot/config';

export interface AvisoPin { pin: number; mensaje: string }

const MODO_INPUT_PULLUP_BIT = 0x04;
const MODO_SALIDA_BIT = 0x02;
const PWM_BITS_POR_DEFECTO = 8;
const TODOS_LOS_PINES = 255;

interface Pwm { valor: number; bits: number }

/**
 * Estado de los pines del ESP32 tal como los deja el programa. Como en el core 3.x, cada pin
 * está en un solo bus: GPIO (pinMode) o PWM (analogWrite, ledcAttach); pasar a uno lo saca del otro.
 */
export class Pines {
  readonly avisos: AvisoPin[] = [];
  private readonly modos = new Map<number, number>();
  private readonly niveles = new Map<number, 0 | 1>();
  private readonly pwm = new Map<number, Pwm>();
  private readonly resoluciones = new Map<number, number>();
  private readonly ledc = new Map<number, number>();
  private resolucionGlobal = PWM_BITS_POR_DEFECTO;

  constructor(
    private readonly gpio: ReadonlySet<number> = GPIO_ESP32,
    private readonly soloEntrada: ReadonlySet<number> = SOLO_ENTRADA_ESP32,
  ) {}

  private avisar(pin: number, mensaje: string): void {
    if (!this.avisos.some(a => a.pin === pin && a.mensaje === mensaje)) this.avisos.push({ pin, mensaje });
  }

  private existe(pin: number): boolean {
    if (this.gpio.has(pin)) return true;
    this.avisar(pin, `El pin ${pin} no existe en el ESP32.`);
    return false;
  }

  private puedeEscribir(pin: number): boolean {
    if (!this.existe(pin)) return false;
    if (!this.soloEntrada.has(pin)) return true;
    this.avisar(pin, `El pin ${pin} solo puede leer: no sirve como salida.`);
    return false;
  }

  private esSalida(pin: number): boolean {
    return ((this.modos.get(pin) ?? 0) & MODO_SALIDA_BIT) !== 0;
  }

  pinMode(pin: number, modo: number): void {
    if (!this.existe(pin)) return;
    if ((modo & MODO_SALIDA_BIT) !== 0 && !this.puedeEscribir(pin)) return;
    this.pwm.delete(pin);
    this.ledc.delete(pin);
    this.modos.set(pin, modo);
  }

  digitalWrite(pin: number, valor: number): void {
    if (!this.puedeEscribir(pin)) return;
    if (this.pwm.has(pin) || this.ledc.has(pin)) {
      this.avisar(pin, `digitalWrite(${pin}, …) no tiene efecto: el pin está en PWM. Usa pinMode(${pin}, OUTPUT) antes.`);
      return;
    }
    if (!this.esSalida(pin)) {
      this.avisar(pin, `Usa pinMode(${pin}, OUTPUT) antes de digitalWrite(${pin}, …).`);
      return;
    }
    this.niveles.set(pin, valor ? 1 : 0);
  }

  digitalRead(pin: number): 0 | 1 {
    if (this.esSalida(pin)) return this.niveles.get(pin) ?? 0;
    return ((this.modos.get(pin) ?? 0) & MODO_INPUT_PULLUP_BIT) !== 0 ? 1 : 0;
  }

  analogWriteResolution(pin: number, bits: number): void {
    const acotados = Math.min(16, Math.max(1, bits));
    if (pin === TODOS_LOS_PINES) {
      this.resolucionGlobal = acotados;
      this.resoluciones.clear();
    } else {
      this.resoluciones.set(pin, acotados);
    }
  }

  analogWrite(pin: number, valor: number): void {
    if (!this.puedeEscribir(pin)) return;
    const bits = this.resoluciones.get(pin) ?? this.resolucionGlobal;
    const maximo = 2 ** bits - 1;
    if (valor < 0 || valor > maximo) {
      this.avisar(pin, `analogWrite(${pin}, ${valor}) está fuera de rango: con ${bits} bits el máximo es ${maximo}.`);
    }
    this.modos.delete(pin);
    this.pwm.set(pin, { valor: Math.min(maximo, Math.max(0, valor)), bits });
  }

  ledcAttach(pin: number, _freq: number, bits: number): boolean {
    if (!this.puedeEscribir(pin)) return false;
    this.modos.delete(pin);
    this.pwm.delete(pin);
    this.ledc.set(pin, Math.min(20, Math.max(1, bits)));
    return true;
  }

  ledcWrite(pin: number, duty: number): boolean {
    const bits = this.ledc.get(pin);
    if (bits === undefined) {
      this.avisar(pin, `Usa ledcAttach(${pin}, frecuencia, bits) antes de ledcWrite(${pin}, …).`);
      return false;
    }
    const maximo = 2 ** bits - 1;
    this.pwm.set(pin, { valor: Math.min(maximo, Math.max(0, duty)), bits });
    return true;
  }

  ledcDetach(pin: number): boolean {
    this.pwm.delete(pin);
    return this.ledc.delete(pin);
  }

  /** Nivel 0…1: el ciclo PWM si el pin tiene PWM; si no, el nivel digital. */
  nivel(pin: number): number {
    const pwm = this.pwm.get(pin);
    if (pwm) return pwm.valor / (2 ** pwm.bits - 1);
    return this.niveles.get(pin) ?? 0;
  }
}
