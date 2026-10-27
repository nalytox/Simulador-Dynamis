/**
 * Puente entre el programa compilado (wasm) y el simulador: construye los imports
 * "dynamis" (ver src/nucleo/include/dynamis_host.h) y un WASI mínimo.
 */
export interface Anfitrion {
  millis(): number;
  micros(): number;
  delay(ms: number): void;
  delayUs(us: number): void;
  rendir(): void;
  pinMode(pin: number, modo: number): void;
  digitalWrite(pin: number, valor: number): void;
  digitalRead(pin: number): number;
  analogRead(pin: number): number;
  analogReadResolution(bits: number): void;
  analogWrite(pin: number, valor: number): void;
  /** pin 255 = todos los pines. */
  analogWriteResolution(pin: number, bits: number): void;
  ledcAttach(pin: number, freq: number, bits: number): boolean;
  ledcWrite(pin: number, duty: number): boolean;
  ledcDetach(pin: number): boolean;
  serialBegin(baudios: number): void;
  serialWrite(bytes: Uint8Array): void;
  /** Bytes recibidos por el Serial que el programa todavía no lee. */
  serialAvailable(): number;
  /** Aviso amigable desde una librería del núcleo. */
  aviso(texto: string): void;
  /** Distancia del VL53L0X en mm (0…8190). */
  vl53Medir(): number;
  /** Si el VL53L0X contesta ahora en esa dirección del bus (su canal del multiplexor abierto). */
  vl53Responde(direccion: number): boolean;
  /** ax, ay, az (m/s²), gx, gy, gz (rad/s) y temp (°C) del MPU6050. */
  mpuLeer(): number[];
  /** I2C directo (multiplexor y TCS34725): true si algún dispositivo respondió. */
  i2cEscribir(direccion: number, bytes: Uint8Array): boolean;
  /** Lee `largo` bytes por I2C directo, o null si nadie respondió. */
  i2cLeer(direccion: number, largo: number): Uint8Array | null;
  azarU32(): number;
  /** El valor de un parámetro @ajustar en esta prueba; `valor` es el del código. */
  ajustable(grupo: string, nombre: string, valor: number): number;
  /** printf y la salida estándar de C (en el ESP32 salen por el mismo UART que Serial). */
  salidaEstandar(bytes: Uint8Array): void;
  tiempoNs(): bigint;
}

/** El programa llamó a exit(): se detiene la ejecución. */
export class SalidaPrograma extends Error {
  readonly codigo: number;
  constructor(codigo: number) {
    super(`exit(${codigo})`);
    this.name = 'SalidaPrograma';
    this.codigo = codigo;
  }
}

type Memoria = () => WebAssembly.Memory;
type FabricaImport = (a: Anfitrion, memoria: Memoria) => (...args: never[]) => unknown;

const u32 = (x: number) => x >>> 0;

/** Una cadena C (terminada en 0) de la memoria del programa. */
function leerCadena(memoria: Memoria, ptr: number): string {
  const bytes = new Uint8Array(memoria().buffer);
  let fin = u32(ptr);
  while (fin < bytes.length && bytes[fin] !== 0) fin++;
  return new TextDecoder().decode(bytes.subarray(u32(ptr), fin));
}

const DYNAMIS: Record<string, FabricaImport> = {
  millis: a => () => a.millis(),
  micros: a => () => a.micros(),
  delay: a => (ms: number) => a.delay(u32(ms)),
  delay_us: a => (us: number) => a.delayUs(u32(us)),
  yield: a => () => a.rendir(),
  pin_mode: a => (pin: number, modo: number) => a.pinMode(pin, modo),
  digital_write: a => (pin: number, valor: number) => a.digitalWrite(pin, valor),
  digital_read: a => (pin: number) => a.digitalRead(pin),
  analog_read: a => (pin: number) => a.analogRead(pin),
  analog_read_resolution: a => (bits: number) => a.analogReadResolution(bits),
  analog_write: a => (pin: number, valor: number) => a.analogWrite(pin, valor),
  analog_write_resolution: a => (pin: number, bits: number) => a.analogWriteResolution(pin, bits),
  ledc_attach: a => (pin: number, freq: number, bits: number) => (a.ledcAttach(pin, u32(freq), bits) ? 1 : 0),
  ledc_write: a => (pin: number, duty: number) => (a.ledcWrite(pin, u32(duty)) ? 1 : 0),
  ledc_detach: a => (pin: number) => (a.ledcDetach(pin) ? 1 : 0),
  serial_begin: a => (baudios: number) => a.serialBegin(u32(baudios)),
  serial_write: (a, memoria) => (ptr: number, largo: number) =>
    a.serialWrite(new Uint8Array(memoria().buffer, u32(ptr), u32(largo)).slice()),
  serial_available: a => () => a.serialAvailable(),
  aviso: (a, memoria) => (ptr: number, largo: number) =>
    a.aviso(new TextDecoder().decode(new Uint8Array(memoria().buffer, u32(ptr), u32(largo)))),
  vl53_medir: a => () => a.vl53Medir(),
  vl53_responde: a => (direccion: number) => (a.vl53Responde(direccion & 0x7f) ? 1 : 0),
  mpu_leer: (a, memoria) => (ptr: number) => {
    new Float32Array(memoria().buffer, u32(ptr), 7).set(a.mpuLeer());
  },
  i2c_escribir: (a, memoria) => (direccion: number, ptr: number, largo: number) =>
    (a.i2cEscribir(direccion & 0x7f, new Uint8Array(memoria().buffer, u32(ptr), u32(largo)).slice()) ? 1 : 0),
  i2c_leer: (a, memoria) => (direccion: number, ptr: number, largo: number) => {
    const bytes = a.i2cLeer(direccion & 0x7f, u32(largo));
    if (!bytes) return 0;
    new Uint8Array(memoria().buffer, u32(ptr), u32(largo)).set(bytes);
    return 1;
  },
  azar_u32: a => () => a.azarU32(),
  ajustable: (a, memoria) => (grupo: number, nombre: number, valor: number) =>
    a.ajustable(leerCadena(memoria, grupo), leerCadena(memoria, nombre), valor),
};

const ERRNO = { exito: 0, descriptorInvalido: 8, noImplementado: 52 };
const TIPO_DISPOSITIVO_DE_CARACTERES = 2;
const DERECHO_FD_WRITE = 1n << 6n;

function unir(trozos: Uint8Array[]): Uint8Array {
  const total = new Uint8Array(trozos.reduce((n, t) => n + t.length, 0));
  let desde = 0;
  for (const t of trozos) { total.set(t, desde); desde += t.length; }
  return total;
}

function importWasi(nombre: string, a: Anfitrion, memoria: Memoria): (...args: never[]) => unknown {
  switch (nombre) {
    case 'fd_write':
      return (fd: number, iovs: number, cantidad: number, escritos: number) => {
        const vista = new DataView(memoria().buffer);
        const trozos: Uint8Array[] = [];
        for (let i = 0; i < cantidad; i++) {
          const ptr = vista.getUint32(iovs + i * 8, true);
          const largo = vista.getUint32(iovs + i * 8 + 4, true);
          trozos.push(new Uint8Array(memoria().buffer, ptr, largo).slice());
        }
        const datos = unir(trozos);
        vista.setUint32(escritos, datos.length, true);
        if (fd !== 1 && fd !== 2) return ERRNO.descriptorInvalido;
        if (datos.length > 0) a.salidaEstandar(datos);
        return ERRNO.exito;
      };
    case 'fd_fdstat_get':
      // stdout y stderr son una terminal (dispositivo de caracteres sin seek): así la libc
      // vacía printf en cada salto de línea, como en el monitor serie.
      return (fd: number, ptr: number) => {
        if (fd !== 1 && fd !== 2) return ERRNO.descriptorInvalido;
        const vista = new DataView(memoria().buffer);
        vista.setUint8(ptr, TIPO_DISPOSITIVO_DE_CARACTERES);
        vista.setUint16(ptr + 2, 0, true);
        vista.setBigUint64(ptr + 8, DERECHO_FD_WRITE, true);
        vista.setBigUint64(ptr + 16, 0n, true);
        return ERRNO.exito;
      };
    case 'environ_sizes_get':
    case 'args_sizes_get':
      // Sin variables de entorno ni argumentos: getenv() devuelve NULL en vez de cerrar el programa.
      return (cantidad: number, bytes: number) => {
        const vista = new DataView(memoria().buffer);
        vista.setUint32(cantidad, 0, true);
        vista.setUint32(bytes, 0, true);
        return ERRNO.exito;
      };
    case 'environ_get':
    case 'args_get':
      return () => ERRNO.exito;
    case 'clock_time_get':
      return (_id: number, _precision: bigint, ptr: number) => {
        new DataView(memoria().buffer).setBigUint64(ptr, a.tiempoNs(), true);
        return ERRNO.exito;
      };
    case 'random_get':
      return (ptr: number, largo: number) => {
        const bytes = new Uint8Array(memoria().buffer, ptr, largo);
        for (let i = 0; i < largo; i += 4) {
          const valor = a.azarU32();
          for (let k = 0; k < 4 && i + k < largo; k++) bytes[i + k] = (valor >>> (8 * k)) & 0xff;
        }
        return ERRNO.exito;
      };
    case 'proc_exit':
      return (codigo: number) => { throw new SalidaPrograma(codigo); };
    case 'sched_yield':
      return () => ERRNO.exito;
    default:
      return () => ERRNO.noImplementado;
  }
}

export function crearImports(modulo: WebAssembly.Module, anfitrion: Anfitrion, memoria: Memoria): WebAssembly.Imports {
  const dynamis: Record<string, (...args: never[]) => unknown> = {};
  const wasi: Record<string, (...args: never[]) => unknown> = {};
  for (const imp of WebAssembly.Module.imports(modulo)) {
    if (imp.kind !== 'function') continue;
    if (imp.module === 'dynamis') {
      const fabrica = DYNAMIS[imp.name];
      if (!fabrica) throw new Error(`El núcleo pide una función desconocida: ${imp.name}`);
      dynamis[imp.name] = fabrica(anfitrion, memoria);
    } else if (imp.module === 'wasi_snapshot_preview1') {
      wasi[imp.name] = importWasi(imp.name, anfitrion, memoria);
    }
  }
  return { dynamis, wasi_snapshot_preview1: wasi } as WebAssembly.Imports;
}
