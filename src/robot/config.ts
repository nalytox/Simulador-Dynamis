/**
 * Configuración del robot físico de Dynamis: medidas, montaje de sensores y pines.
 * Marco del robot: x adelante, y izquierda, z arriba (mm). Los valores por defecto son
 * provisionales hasta medir el robot real (spec §8).
 */
export interface PinesMotor { pwm: number; in1: number; in2: number; invertir?: boolean }

/**
 * Un TCS34725. led: el pin que maneja su LED (null: el LED sigue al pin INT). canal: el canal del
 * multiplexor TCA9548A (0x70) donde está conectado, o null si está directo en el bus I2C.
 */
export interface SensorColor { x: number; y: number; z: number; led: number | null; canal: number | null }

export interface ConfigRobot {
  /** xDelantero: borde delantero del chasis en el marco del robot. */
  chasis: { largo: number; ancho: number; alto: number; xDelantero: number };
  ruedas: { diametro: number; trocha: number; x: number };
  motores: { driver: 'TB6612'; izq: PinesMotor; der: PinesMotor; stby: number | null };
  qtr: { pines: number[]; emisor: number | null; x: number; separacion: number; altura: number };
  /** yaw y pitch del montaje en grados (pitch > 0 apunta hacia abajo, REP-103). */
  vl53l0x: { x: number; y: number; z: number; yaw: number; pitch: number };
  tcs34725: SensorColor;
  /** Un segundo TCS34725, por ejemplo uno a cada lado de la línea detrás del multiplexor. */
  tcs34725b: SensorColor & { instalado: boolean };
  mpu6050: { x: number; y: number; z: number; orientacion: 'z-arriba-x-adelante' };
}

export const ROBOT_POR_DEFECTO: ConfigRobot = {
  chasis: { largo: 156, ancho: 132, alto: 60, xDelantero: 96 },
  ruedas: { diametro: 42, trocha: 140, x: 0 },
  motores: { driver: 'TB6612', izq: { pwm: 18, in1: 16, in2: 17 }, der: { pwm: 19, in1: 4, in2: 5 }, stby: null },
  qtr: { pines: [36, 39, 34, 35, 32, 33, 25, 26], emisor: null, x: 92, separacion: 9.525, altura: 3 },
  vl53l0x: { x: 92, y: 0, z: 35, yaw: 0, pitch: 0 },
  tcs34725: { x: 40, y: -46, z: 5, led: null, canal: null },
  tcs34725b: { instalado: false, x: 40, y: 46, z: 5, led: null, canal: null },
  mpu6050: { x: 0, y: 0, z: 40, orientacion: 'z-arriba-x-adelante' },
};

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
  if (r.qtr.pines.length !== 8) avisar('qtr.pines', 'El QTR-MX-8A necesita 8 pines.');

  const xTrasero = r.chasis.xDelantero - r.chasis.largo;
  const dentro = (x: number, y: number) => x >= xTrasero && x <= r.chasis.xDelantero && Math.abs(y) <= r.chasis.ancho / 2;
  const extremoQtr = (r.qtr.pines.length - 1) / 2 * r.qtr.separacion;
  const sensores: [string, string, boolean][] = [
    ['qtr', 'El sensor de línea QTR-MX-8A', dentro(r.qtr.x, extremoQtr)],
    ['vl53l0x', 'El VL53L0X', dentro(r.vl53l0x.x, r.vl53l0x.y)],
    ['tcs34725', 'El TCS34725', dentro(r.tcs34725.x, r.tcs34725.y)],
    ['mpu6050', 'El MPU6050', dentro(r.mpu6050.x, r.mpu6050.y)],
    ['tcs34725b', 'El segundo TCS34725', !r.tcs34725b.instalado || dentro(r.tcs34725b.x, r.tcs34725b.y)],
  ];
  for (const [campo, nombre, ok] of sensores) if (!ok) avisar(campo, `${nombre} queda fuera del chasis.`);
  if (r.tcs34725b.instalado && r.tcs34725b.canal === r.tcs34725.canal) {
    avisar('tcs34725b.canal', 'Los dos TCS34725 usan la dirección 0x29: ponlos en canales distintos del multiplexor.');
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
