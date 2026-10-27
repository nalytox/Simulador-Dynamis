/**
 * Configuración del robot físico de Dynamis: medidas, montaje de sensores y pines.
 * Marco del robot: x adelante, y izquierda, z arriba (mm), con el origen en el centro del eje de las
 * ruedas motrices (el centro de giro).
 */
export interface PinesMotor { pwm: number; in1: number; in2: number; invertir?: boolean }

/**
 * Un TCS34725. led: el pin que maneja su LED (null: el LED sigue al pin INT). canal: el canal del
 * multiplexor TCA9548A (0x70) donde está conectado, o null si está directo en el bus I2C.
 */
export interface SensorColor { x: number; y: number; z: number; led: number | null; canal: number | null }

/**
 * Cómo está montado el MPU6050: su eje z siempre hacia arriba y su eje x hacia adelante, o hacia atrás
 * (el chip girado 180° sobre z).
 */
export type OrientacionMPU = 'z-arriba-x-adelante' | 'z-arriba-x-atras';
export const ORIENTACIONES_MPU: readonly OrientacionMPU[] = ['z-arriba-x-adelante', 'z-arriba-x-atras'];

export interface ConfigRobot {
  /** xDelantero: borde delantero del chasis en el marco del robot. */
  chasis: { largo: number; ancho: number; alto: number; xDelantero: number };
  /** Las ruedas motrices. */
  ruedas: { diametro: number; trocha: number; x: number };
  /** Dos ruedas que giran libres y tocan el piso. Sin ellas, el chasis se apoya en su frente y su cola. */
  ruedasLocas: { instalado: boolean; diametro: number; x: number; trocha: number };
  /** vMaxMmS: la velocidad de cada rueda con el PWM al máximo. */
  motores: { driver: 'TB6612'; izq: PinesMotor; der: PinesMotor; stby: number | null; vMaxMmS: number };
  qtr: { pines: number[]; emisor: number | null; x: number; separacion: number; altura: number };
  /**
   * yaw y pitch del montaje en grados (pitch > 0 apunta hacia abajo, REP-103). canal: el canal del
   * multiplexor TCA9548A donde está, o null si está directo en el bus I2C (usa la misma dirección que
   * los TCS34725, 0x29).
   */
  vl53l0x: { x: number; y: number; z: number; yaw: number; pitch: number; canal: number | null };
  tcs34725: SensorColor;
  /** Un segundo TCS34725, por ejemplo uno a cada lado de la línea detrás del multiplexor. */
  tcs34725b: SensorColor & { instalado: boolean };
  mpu6050: { x: number; y: number; z: number; orientacion: OrientacionMPU };
}

/**
 * El Dynamis real: la placa GerberDynamisV2 sobre la base RescueLineRobotRGB_1 (la de la ventana para
 * los sensores de color). El origen es el centro del eje de las ruedas traseras, las motrices (GA25-370).
 */
export const ROBOT_POR_DEFECTO: ConfigRobot = {
  // alto: con el asa; xDelantero: el frente de las ruedas locas.
  chasis: { largo: 125, ancho: 180, alto: 117, xDelantero: 97 },
  ruedas: { diametro: 60, trocha: 160 /* estimado, medir */, x: 0 },
  ruedasLocas: { instalado: true, diametro: 55, x: 70, trocha: 160 /* estimado, medir */ },
  // En la placa, STBY va a 3V3.
  motores: { driver: 'TB6612', izq: { pwm: 4, in1: 16, in2: 17 }, der: { pwm: 19, in1: 5, in2: 18 }, stby: null, vMaxMmS: 600 /* estimado, medir */ },
  // QTRX-MD-08A: 8 sensores a 8 mm; el índice 0 es el de la izquierda. LEDON en el pin 27.
  qtr: { pines: [36, 39, 34, 35, 32, 33, 25, 26], emisor: 27, x: 74, separacion: 8, altura: 7 },
  // Los TCS34725 y el láser usan 0x29: van en los canales 0, 1 y 2 del multiplexor TCA9548A (0x70).
  vl53l0x: { x: 82, y: 0, z: 20, yaw: 0, pitch: 0, canal: 2 },
  tcs34725: { x: 35 /* estimado, medir */, y: 22, z: 7, led: null, canal: 0 },
  tcs34725b: { instalado: true, x: 35 /* estimado, medir */, y: -22, z: 7, led: null, canal: 1 },
  mpu6050: { x: -15 /* estimado, medir */, y: 0, z: 45 /* estimado, medir */, orientacion: 'z-arriba-x-atras' },
};

/** El robot por defecto de antes del Dynamis real: un robot guardado igual a este pasa al nuevo. */
export const ROBOT_POR_DEFECTO_ANTERIOR = {
  chasis: { largo: 156, ancho: 132, alto: 60, xDelantero: 96 },
  ruedas: { diametro: 42, trocha: 140, x: 0 },
  motores: { driver: 'TB6612', izq: { pwm: 18, in1: 16, in2: 17 }, der: { pwm: 19, in1: 4, in2: 5 }, stby: null },
  qtr: { pines: [36, 39, 34, 35, 32, 33, 25, 26], emisor: null, x: 92, separacion: 9.525, altura: 3 },
  vl53l0x: { x: 92, y: 0, z: 35, yaw: 0, pitch: 0 },
  tcs34725: { x: 40, y: -46, z: 5, led: null, canal: null },
  tcs34725b: { instalado: false, x: 40, y: 46, z: 5, led: null, canal: null },
  mpu6050: { x: 0, y: 0, z: 40, orientacion: 'z-arriba-x-adelante' as OrientacionMPU },
};

/** Igual en contenido, sin importar el orden de las claves. */
function igual(a: unknown, b: unknown): boolean {
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return a === b;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const claves = Object.keys(a);
  return claves.length === Object.keys(b).length
    && claves.every(k => igual((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]));
}

/** Si un robot guardado es el robot por defecto anterior, sin cambios del estudiante. */
export function esRobotPorDefectoAnterior(datos: unknown): boolean {
  return igual(datos, ROBOT_POR_DEFECTO_ANTERIOR);
}

const rango = (desde: number, hasta: number) => Array.from({ length: hasta - desde + 1 }, (_, i) => desde + i);

export const GPIO_ESP32: ReadonlySet<number> = new Set([...rango(0, 19), ...rango(21, 23), ...rango(25, 27), ...rango(32, 39)]);
export const SOLO_ENTRADA_ESP32: ReadonlySet<number> = new Set(rango(34, 39));

export interface AvisoRobot { campo: string; mensaje: string }

const LIMITE_MM = 200;
const cm = (mm: number) => (mm / 10).toLocaleString('es-CL', { maximumFractionDigits: 1 });

export function validarRobot(r: ConfigRobot): AvisoRobot[] {
  const avisos: AvisoRobot[] = [];
  const avisar = (campo: string, mensaje: string) => {
    if (!avisos.some(a => a.mensaje === mensaje)) avisos.push({ campo, mensaje });
  };

  for (const medida of ['largo', 'ancho', 'alto'] as const) {
    if (r.chasis[medida] > LIMITE_MM) {
      avisar(`chasis.${medida}`, `El robot mide ${cm(r.chasis[medida])} cm de ${medida}; las bases permiten hasta 20 cm.`);
    }
  }

  const salidas: [string, number | null][] = [
    ['motores.izq.pwm', r.motores.izq.pwm], ['motores.izq.in1', r.motores.izq.in1], ['motores.izq.in2', r.motores.izq.in2],
    ['motores.der.pwm', r.motores.der.pwm], ['motores.der.in1', r.motores.der.in1], ['motores.der.in2', r.motores.der.in2],
    ['motores.stby', r.motores.stby], ['qtr.emisor', r.qtr.emisor], ['tcs34725.led', r.tcs34725.led],
    ...(r.tcs34725b.instalado ? [['tcs34725b.led', r.tcs34725b.led] as [string, number | null]] : []),
  ];
  const entradas: [string, number | null][] = r.qtr.pines.map((pin, i) => [`qtr.pines.${i}`, pin]);
  const usados = new Map<number, number>();
  for (const [campo, pin] of [...salidas, ...entradas]) {
    if (pin === null) continue;
    usados.set(pin, (usados.get(pin) ?? 0) + 1);
    if (!GPIO_ESP32.has(pin)) avisar(campo, `El pin ${pin} no existe en el ESP32.`);
  }
  for (const [campo, pin] of salidas) {
    if (pin !== null && SOLO_ENTRADA_ESP32.has(pin)) avisar(campo, `El pin ${pin} solo puede leer: no sirve como salida.`);
  }
  for (const [pin, veces] of usados) {
    if (veces > 1) avisar('pines', `El pin ${pin} está usado dos veces.`);
  }
  if (r.qtr.pines.length !== 8) avisar('qtr.pines', 'El QTRX-MD-08A necesita 8 pines.');

  const xTrasero = r.chasis.xDelantero - r.chasis.largo;
  const dentro = (x: number, y: number) => x >= xTrasero && x <= r.chasis.xDelantero && Math.abs(y) <= r.chasis.ancho / 2;
  const extremoQtr = (r.qtr.pines.length - 1) / 2 * r.qtr.separacion;
  const sensores: [string, string, boolean][] = [
    ['qtr', 'El sensor de línea QTRX-MD-08A', dentro(r.qtr.x, extremoQtr)],
    ['vl53l0x', 'El VL53L0X', dentro(r.vl53l0x.x, r.vl53l0x.y)],
    ['tcs34725', 'El TCS34725', dentro(r.tcs34725.x, r.tcs34725.y)],
    ['mpu6050', 'El MPU6050', dentro(r.mpu6050.x, r.mpu6050.y)],
    ['tcs34725b', 'El segundo TCS34725', !r.tcs34725b.instalado || dentro(r.tcs34725b.x, r.tcs34725b.y)],
  ];
  for (const [campo, nombre, ok] of sensores) if (!ok) avisar(campo, `${nombre} queda fuera del chasis.`);
  if (r.ruedasLocas.instalado) {
    if (!dentro(r.ruedasLocas.x, 0)) avisar('ruedasLocas.x', 'Las ruedas locas quedan fuera del chasis.');
    else if (r.ruedasLocas.x === r.ruedas.x) avisar('ruedasLocas.x', 'Las ruedas locas no pueden estar en el eje de las ruedas.');
  }
  if (r.tcs34725b.instalado && r.tcs34725b.canal === r.tcs34725.canal) {
    avisar('tcs34725b.canal', 'Los dos TCS34725 usan la dirección 0x29: ponlos en canales distintos del multiplexor.');
  }
  const colores = [r.tcs34725, ...(r.tcs34725b.instalado ? [r.tcs34725b] : [])];
  if (colores.some(c => c.canal === r.vl53l0x.canal)) {
    avisar('vl53l0x.canal', 'El VL53L0X y un TCS34725 usan la dirección 0x29: ponlos en canales distintos del multiplexor.');
  }

  return avisos;
}

/** Esquinas del chasis en el mundo, en sentido antihorario desde la delantera izquierda. */
export function huellaRobot(x: number, y: number, yaw: number, r: ConfigRobot): { x: number; y: number }[] {
  const { xDelantero, largo, ancho } = r.chasis;
  const esquinas = [
    [xDelantero, ancho / 2], [xDelantero - largo, ancho / 2],
    [xDelantero - largo, -ancho / 2], [xDelantero, -ancho / 2],
  ];
  const c = Math.cos(yaw);
  const s = Math.sin(yaw);
  return esquinas.map(([lx, ly]) => ({ x: x + lx * c - ly * s, y: y + lx * s + ly * c }));
}
