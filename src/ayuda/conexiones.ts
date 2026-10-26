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
    { grupo: 'Driver', filas: [{ que: 'STBY', pin: pin(r.motores.stby) }] },
    { grupo: 'Sensor de línea', filas: [
      ...r.qtr.pines.map((p, i) => ({ que: `S${i + 1}${i === 0 ? ' (izquierda)' : i === ultimo ? ' (derecha)' : ''}`, pin: pin(p) })),
      { que: 'Emisores', pin: pin(r.qtr.emisor, 'siempre encendidos') },
    ] },
    { grupo: 'Bus I2C', filas: busI2C(r) },
  ];
}

// Un TCS34725 directo en el bus choca con el VL53L0X (los dos usan 0x29): por eso el ⚠.
function busI2C(r: ConfigRobot): { que: string; pin: string }[] {
  const colores = [r.tcs34725, ...(r.tcs34725b.instalado ? [r.tcs34725b] : [])];
  const nombre = (i: number) => (colores.length > 1 ? `TCS34725 (color ${i + 1})` : 'TCS34725');
  const hayMux = colores.some(c => c.canal !== null);
  return [
    { que: 'SDA', pin: String(SDA) }, { que: 'SCL', pin: String(SCL) },
    { que: 'VL53L0X', pin: '0x29' },
    ...(hayMux ? [{ que: 'Multiplexor TCA9548A', pin: '0x70' }] : []),
    ...colores.map((c, i) => ({ que: nombre(i), pin: c.canal === null ? '0x29 ⚠' : `0x29, canal ${c.canal} del multiplexor` })),
    { que: 'MPU6050', pin: '0x68' },
    ...colores.map((c, i) => ({ que: `LED del ${nombre(i)}`, pin: pin(c.led, 'encendido, salvo con setInterrupt(true)') })),
  ];
}
