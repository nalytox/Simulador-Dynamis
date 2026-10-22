import { ROBOT_POR_DEFECTO, type ConfigRobot } from './config';

/**
 * El robot como archivo (spec §8): leer y escribir robot.json, y la lista de campos que edita la
 * ventana "Mi robot". Lo que falta toma el valor del profe (ROBOT_POR_DEFECTO) y se avisa.
 */
export type ResultadoRobot = { ok: true; robot: ConfigRobot; avisos: string[] } | { ok: false; errores: string[] };

export interface CampoRobot {
  ruta: string;
  grupo: 'Medidas' | 'Sensores' | 'Pines';
  etiqueta: string;
  unidad: 'mm' | '°' | 'pin' | null;
  tipo: 'numero' | 'pin' | 'pin-opcional' | 'si-no';
  min?: number;
  max?: number;
}

type Registro = Record<string, unknown>;

const NO_ES_ROBOT = 'El archivo no es un robot válido.';
const PIN_MAXIMO = 39;
const SENSORES_QTR = 8;
/** Medidas que deben ser mayores que 0. */
const POSITIVAS = new Set(['chasis.largo', 'chasis.ancho', 'chasis.alto', 'ruedas.diametro', 'ruedas.trocha', 'qtr.separacion', 'qtr.altura']);
const PINES = new Set(['motores.izq.pwm', 'motores.izq.in1', 'motores.izq.in2', 'motores.der.pwm', 'motores.der.in1', 'motores.der.in2']);
/** Pines que pueden quedar sin conectar (null). */
const PINES_OPCIONALES = new Set(['motores.stby', 'qtr.emisor', 'tcs34725.led']);
/** Valores opcionales que no están en ROBOT_POR_DEFECTO. */
const OPCIONALES: Record<string, string[]> = { 'motores.izq': ['invertir'], 'motores.der': ['invertir'] };

const esRegistro = (x: unknown): x is Registro => typeof x === 'object' && x !== null && !Array.isArray(x);
const esNumero = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);

function normalizarValor(plantilla: unknown, dato: unknown, ruta: string, avisos: string[], errores: string[]): unknown {
  if (dato === undefined) {
    avisos.push(esRegistro(plantilla) ? `Faltaba ${ruta}: se usaron los valores del profe.` : `Faltaba ${ruta}: se usó el valor del profe.`);
    return structuredClone(plantilla);
  }
  if (esRegistro(plantilla)) {
    if (!esRegistro(dato)) {
      errores.push(`${ruta} debe ser un grupo de valores entre { }.`);
      return plantilla;
    }
    const salida: Registro = {};
    for (const [clave, valor] of Object.entries(plantilla)) salida[clave] = normalizarValor(valor, dato[clave], `${ruta}.${clave}`, avisos, errores);
    for (const clave of OPCIONALES[ruta] ?? []) {
      if (dato[clave] === undefined) continue;
      if (typeof dato[clave] === 'boolean') salida[clave] = dato[clave];
      else errores.push(`${ruta}.${clave} debe ser true o false.`);
    }
    return salida;
  }
  if (Array.isArray(plantilla)) {
    // Array.from convierte los huecos en undefined: una lista con huecos no pasa.
    if (!Array.isArray(dato) || !Array.from(dato).every(Number.isInteger)) errores.push(`${ruta} debe ser una lista de pines (números enteros).`);
    else if (dato.length !== SENSORES_QTR) errores.push(`${ruta} debe tener ${SENSORES_QTR} pines, uno por sensor.`);
    return dato;
  }
  if (typeof plantilla === 'string') {
    if (dato !== plantilla) errores.push(`${ruta} debe ser "${plantilla}".`);
    return dato;
  }
  if (PINES_OPCIONALES.has(ruta)) {
    if (dato !== null && !Number.isInteger(dato)) errores.push(`${ruta} debe ser un pin o null (sin conectar).`);
  } else if (PINES.has(ruta)) {
    if (!Number.isInteger(dato)) errores.push(`${ruta} debe ser un pin (un número entero).`);
  } else if (!esNumero(dato)) {
    errores.push(`${ruta} debe ser un número.`);
  } else if (POSITIVAS.has(ruta) && dato <= 0) {
    errores.push(`${ruta} debe ser un número mayor que 0.`);
  }
  return dato;
}

export function normalizarRobot(datos: unknown): ResultadoRobot {
  // Un JSON sin ninguna de las partes del robot (un package.json, una pista…) no es un robot.
  if (!esRegistro(datos) || !Object.keys(ROBOT_POR_DEFECTO).some(clave => datos[clave] !== undefined)) {
    return { ok: false, errores: [NO_ES_ROBOT] };
  }
  const avisos: string[] = [];
  const errores: string[] = [];
  const robot: Registro = {};
  for (const [clave, plantilla] of Object.entries(ROBOT_POR_DEFECTO)) robot[clave] = normalizarValor(plantilla, datos[clave], clave, avisos, errores);
  return errores.length > 0 ? { ok: false, errores } : { ok: true, robot: robot as unknown as ConfigRobot, avisos };
}

export function leerRobot(texto: string): ResultadoRobot {
  let datos: unknown;
  try {
    datos = JSON.parse(texto);
  } catch {
    return { ok: false, errores: ['El archivo no es un robot válido (no es JSON).'] };
  }
  return normalizarRobot(datos);
}

export function escribirRobot(r: ConfigRobot): string {
  return JSON.stringify(r, null, 2);
}

const medida = (ruta: string, etiqueta: string, min: number, max: number, grupo: CampoRobot['grupo'] = 'Medidas'): CampoRobot =>
  ({ ruta, grupo, etiqueta, unidad: 'mm', tipo: 'numero', min, max });
const angulo = (ruta: string, etiqueta: string, limite: number): CampoRobot =>
  ({ ruta, grupo: 'Sensores', etiqueta, unidad: '°', tipo: 'numero', min: -limite, max: limite });
const posicion = (sensor: string, nombre: string, ejes: ('x' | 'y' | 'z')[]): CampoRobot[] => ejes.map(eje => medida(
  `${sensor}.${eje}`, `${nombre}: ${{ x: 'hacia adelante', y: 'hacia la izquierda', z: 'altura' }[eje]}`, eje === 'z' ? 0 : -300, 300, 'Sensores'));
const pin = (ruta: string, etiqueta: string, opcional = false): CampoRobot =>
  ({ ruta, grupo: 'Pines', etiqueta, unidad: 'pin', tipo: opcional ? 'pin-opcional' : 'pin', min: 0, max: PIN_MAXIMO });
const motor = (lado: 'izq' | 'der', nombre: string): CampoRobot[] => [
  pin(`motores.${lado}.pwm`, `${nombre}: PWM`),
  pin(`motores.${lado}.in1`, `${nombre}: IN1`),
  pin(`motores.${lado}.in2`, `${nombre}: IN2`),
  { ruta: `motores.${lado}.invertir`, grupo: 'Pines', etiqueta: `${nombre}: girar al revés`, unidad: null, tipo: 'si-no' },
];

/** Los campos que se editan en "Mi robot", en el orden en que se muestran. */
export const CAMPOS_ROBOT: CampoRobot[] = [
  medida('chasis.largo', 'Largo del chasis', 20, 400),
  medida('chasis.ancho', 'Ancho del chasis', 20, 400),
  medida('chasis.alto', 'Alto del chasis', 10, 400),
  medida('chasis.xDelantero', 'Borde delantero, desde el eje de las ruedas', -200, 400),
  medida('ruedas.diametro', 'Diámetro de las ruedas', 10, 150),
  medida('ruedas.trocha', 'Distancia entre las ruedas', 20, 400),
  medida('ruedas.x', 'Eje de las ruedas, hacia adelante', -200, 200),
  medida('qtr.x', 'Sensor de línea: hacia adelante', -300, 300, 'Sensores'),
  medida('qtr.separacion', 'Sensor de línea: separación entre sensores', 1, 30, 'Sensores'),
  medida('qtr.altura', 'Sensor de línea: altura sobre el suelo', 0.5, 30, 'Sensores'),
  ...posicion('vl53l0x', 'Distancia (VL53L0X)', ['x', 'y', 'z']),
  angulo('vl53l0x.yaw', 'Distancia (VL53L0X): giro hacia la izquierda', 180),
  angulo('vl53l0x.pitch', 'Distancia (VL53L0X): inclinación hacia abajo', 90),
  ...posicion('tcs34725', 'Color (TCS34725)', ['x', 'y', 'z']),
  ...posicion('mpu6050', 'Giro (MPU6050)', ['x', 'y', 'z']),
  ...motor('izq', 'Motor izquierdo'),
  ...motor('der', 'Motor derecho'),
  pin('motores.stby', 'Driver: STBY', true),
  ...Array.from({ length: 8 }, (_, i) => pin(`qtr.pines.${i}`, `Sensor de línea: sensor ${i + 1}`)),
  pin('qtr.emisor', 'Sensor de línea: LEDs (emisor)', true),
  pin('tcs34725.led', 'Color: LED', true),
];

const partes = (ruta: string) => ruta.split('.');

export function leerCampo(r: ConfigRobot, ruta: string): number | boolean | null {
  let actual: unknown = r;
  for (const parte of partes(ruta)) actual = (actual as Registro)?.[parte];
  if (actual === undefined && ruta.endsWith('.invertir')) return false;
  return actual as number | boolean | null;
}

/** Una copia del robot con el campo cambiado, acotado a su rango (los pines, además, enteros). */
export function conCampo(r: ConfigRobot, ruta: string, valor: number | boolean | null): ConfigRobot {
  const campo = CAMPOS_ROBOT.find(c => c.ruta === ruta);
  let final = valor;
  if (typeof valor === 'number' && campo) {
    final = Math.min(campo.max ?? Infinity, Math.max(campo.min ?? -Infinity, campo.tipo === 'numero' ? valor : Math.round(valor)));
  }
  const copia = structuredClone(r);
  const camino = partes(ruta);
  let destino = copia as unknown as Registro;
  for (const parte of camino.slice(0, -1)) destino = destino[parte] as Registro;
  // En una lista solo se cambian posiciones que existen: nunca se dejan huecos.
  if (Array.isArray(destino) && !(Number(camino.at(-1)) < destino.length)) return copia;
  destino[camino.at(-1)!] = final;
  return copia;
}
