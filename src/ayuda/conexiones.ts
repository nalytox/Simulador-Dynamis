import type { ConfigRobot } from '../robot/config';

export interface GrupoConexiones { grupo: string; filas: { que: string; pin: string }[] }

/** El bus I2C del ESP32 en sus pines por defecto (Wire.begin() sin argumentos). */
const SDA = 21;
const SCL = 22;
const SIN_CONECTAR = 'sin conectar';

const pin = (n: number | null, siNoHay = SIN_CONECTAR) => (n === null ? siNoHay : String(n));

/** Cómo está cableada la placa Dynamis V2 (GerberDynamisV2), con lo que el simulador aún no modela. */
export const PLACA_V2: GrupoConexiones = { grupo: 'Placa Dynamis V2', filas: [
  { que: 'Sensor de línea QTRX-MD-08A (a 7 mm del piso)', pin: 'D36, D39, D34, D35, D32, D33, D25 y D26, de izquierda a derecha' },
  { que: 'Emisores del QTR (LEDON)', pin: 'D27' },
  { que: 'Motor izq. (PWM, IN1, IN2)', pin: 'D4, D16 y D17' },
  { que: 'Motor der. (PWM, IN1, IN2)', pin: 'D19, D5 y D18' },
  { que: 'STBY del TB6612', pin: '3V3: siempre activo' },
  { que: 'Bus I2C (SDA, SCL)', pin: 'D21 y D22' },
  { que: 'Multiplexor TCA9548A', pin: '0x70: canal 0 el TCS34725 izquierdo, 1 el derecho y 2 el VL53L0X' },
  { que: 'MPU6050', pin: '0x68, directo en el bus, mirando hacia atrás (su eje x apunta a la cola)' },
  { que: 'Encoders', pin: 'D13 y D14 (el simulador todavía no los modela)' },
] };

/** "Conexiones de mi robot": los pines de "Mi robot", agrupados como en el robot real. */
export function conexionesDe(r: ConfigRobot): GrupoConexiones[] {
  const motor = (m: ConfigRobot['motores']['izq']) => [{ que: 'PWM', pin: pin(m.pwm) }, { que: 'IN1', pin: pin(m.in1) }, { que: 'IN2', pin: pin(m.in2) }];
  const ultimo = r.qtr.pines.length - 1;
  return [
    { grupo: 'Motor izquierdo', filas: motor(r.motores.izq) },
    { grupo: 'Motor derecho', filas: motor(r.motores.der) },
    { grupo: 'Driver', filas: [{ que: 'STBY', pin: pin(r.motores.stby, 'a 3V3 (siempre activo)') }] },
    { grupo: 'Sensor de línea', filas: [
      ...r.qtr.pines.map((p, i) => ({ que: `S${i + 1}${i === 0 ? ' (izquierda)' : i === ultimo ? ' (derecha)' : ''}`, pin: pin(p) })),
      { que: 'Emisores (LEDON)', pin: pin(r.qtr.emisor, 'siempre encendidos') },
    ] },
    { grupo: 'Bus I2C', filas: busI2C(r) },
  ];
}

// El VL53L0X y los TCS34725 usan 0x29: si dos quedan en el mismo canal (o directo en el bus), chocan y llevan ⚠.
function busI2C(r: ConfigRobot): { que: string; pin: string }[] {
  const colores = [r.tcs34725, ...(r.tcs34725b.instalado ? [r.tcs34725b] : [])];
  const nombre = (i: number) => (colores.length > 1 ? `TCS34725 (color ${i + 1})` : 'TCS34725');
  const laser = r.vl53l0x.canal;
  const hayMux = laser !== null || colores.some(c => c.canal !== null);
  const en = (canal: number | null, choca: boolean) =>
    `${canal === null ? '0x29' : `0x29, canal ${canal} del multiplexor`}${choca ? ' ⚠' : ''}`;
  return [
    { que: 'SDA', pin: String(SDA) }, { que: 'SCL', pin: String(SCL) },
    ...(hayMux ? [{ que: 'Multiplexor TCA9548A', pin: '0x70' }] : []),
    { que: 'VL53L0X', pin: en(laser, colores.some(c => c.canal === laser)) },
    ...colores.map((c, i) => ({ que: nombre(i), pin: en(c.canal, c.canal === laser) })),
    { que: 'MPU6050', pin: '0x68' },
    ...colores.map((c, i) => ({ que: `LED del ${nombre(i)}`, pin: pin(c.led, 'encendido, salvo con setInterrupt(true)') })),
  ];
}
