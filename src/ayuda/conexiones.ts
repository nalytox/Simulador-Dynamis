import type { ConfigRobot } from '../robot/config';

export interface GrupoConexiones { grupo: string; filas: { que: string; pin: string }[] }

/** El bus I2C del ESP32 en sus pines por defecto (Wire.begin() sin argumentos). */
const SDA = 21;
const SCL = 22;
const SIN_CONECTAR = 'sin conectar';

const pin = (n: number | null, siNoHay = SIN_CONECTAR) => (n === null ? siNoHay : String(n));

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
