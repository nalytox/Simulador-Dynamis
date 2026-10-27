import { it, expect } from 'vitest';
import { conexionesDe } from '../../src/ayuda/conexiones';
import { puntaje } from '../../src/ayuda/bases';
import { GUIAS } from '../../src/ayuda/guias';
import { ROBOT_POR_DEFECTO } from '../../src/robot/config';

it('conexionesDe con el robot por defecto: la placa Dynamis V2', () => {
  expect(conexionesDe(ROBOT_POR_DEFECTO)).toEqual([
    { grupo: 'Motor izquierdo', filas: [{ que: 'PWM', pin: '4' }, { que: 'IN1', pin: '16' }, { que: 'IN2', pin: '17' }] },
    { grupo: 'Motor derecho', filas: [{ que: 'PWM', pin: '19' }, { que: 'IN1', pin: '5' }, { que: 'IN2', pin: '18' }] },
    { grupo: 'Driver', filas: [{ que: 'STBY', pin: 'a 3V3 (siempre activo)' }] },
    { grupo: 'Sensor de línea', filas: [
      { que: 'S1 (izquierda)', pin: '36' }, { que: 'S2', pin: '39' }, { que: 'S3', pin: '34' }, { que: 'S4', pin: '35' },
      { que: 'S5', pin: '32' }, { que: 'S6', pin: '33' }, { que: 'S7', pin: '25' }, { que: 'S8 (derecha)', pin: '26' },
      { que: 'Emisores (LEDON)', pin: '27' },
    ] },
    { grupo: 'Bus I2C', filas: [
      { que: 'SDA', pin: '21' }, { que: 'SCL', pin: '22' },
      { que: 'Multiplexor TCA9548A', pin: '0x70' },
      { que: 'VL53L0X', pin: '0x29, canal 2 del multiplexor' },
      { que: 'TCS34725 (color 1)', pin: '0x29, canal 0 del multiplexor' }, { que: 'TCS34725 (color 2)', pin: '0x29, canal 1 del multiplexor' },
      { que: 'MPU6050', pin: '0x68' },
      { que: 'LED del TCS34725 (color 1)', pin: 'encendido, salvo con setInterrupt(true)' },
      { que: 'LED del TCS34725 (color 2)', pin: 'encendido, salvo con setInterrupt(true)' },
    ] },
  ]);
});

it('sin multiplexor, el láser y el TCS34725 directo en el bus chocan en 0x29: los dos llevan ⚠', () => {
  const robot = { ...ROBOT_POR_DEFECTO, vl53l0x: { ...ROBOT_POR_DEFECTO.vl53l0x, canal: null },
    tcs34725: { ...ROBOT_POR_DEFECTO.tcs34725, canal: null, led: 14 }, tcs34725b: { ...ROBOT_POR_DEFECTO.tcs34725b, instalado: false } };
  expect(conexionesDe(robot).find(g => g.grupo === 'Bus I2C')!.filas).toEqual([
    { que: 'SDA', pin: '21' }, { que: 'SCL', pin: '22' },
    { que: 'VL53L0X', pin: '0x29 ⚠' }, { que: 'TCS34725', pin: '0x29 ⚠' }, { que: 'MPU6050', pin: '0x68' },
    { que: 'LED del TCS34725', pin: '14' },
  ]);
});

it('el láser directo en el bus y los TCS34725 en el multiplexor no chocan', () => {
  const robot = { ...ROBOT_POR_DEFECTO, vl53l0x: { ...ROBOT_POR_DEFECTO.vl53l0x, canal: null } };
  const filas = conexionesDe(robot).find(g => g.grupo === 'Bus I2C')!.filas;
  expect(filas).toContainEqual({ que: 'Multiplexor TCA9548A', pin: '0x70' });
  expect(filas).toContainEqual({ que: 'VL53L0X', pin: '0x29' });
});

it('un pin opcional muestra su número, o qué pasa si no está conectado', () => {
  const robot = { ...ROBOT_POR_DEFECTO, motores: { ...ROBOT_POR_DEFECTO.motores, stby: 23 }, qtr: { ...ROBOT_POR_DEFECTO.qtr, emisor: null },
    tcs34725: { ...ROBOT_POR_DEFECTO.tcs34725, led: 14 } };
  const filas = conexionesDe(robot).flatMap(g => g.filas);
  expect(filas).toContainEqual({ que: 'STBY', pin: '23' });
  expect(filas).toContainEqual({ que: 'Emisores (LEDON)', pin: 'siempre encendidos' });
  expect(filas).toContainEqual({ que: 'LED del TCS34725 (color 1)', pin: '14' });
});

it('puntaje sale de las constantes del juez', () => {
  expect(puntaje()).toEqual([
    { regla: 'Hitos 1 a 8', puntos: '5, 10, 20, 20, 10, 15, 15 y 20' },
    { regla: 'Meta (detenido sobre la línea)', puntos: '15' },
    { regla: 'Tiempo (solo si llega a la meta)', puntos: '(300 − segundos) ÷ 4' },
    { regla: 'Cada reinicio (máximo 3)', puntos: '−10' },
    { regla: 'Robot más grande que 20 × 20 × 20 cm', puntos: '−20 por cada cm de más' },
  ]);
});

it('hay una guía para cada sensor del robot y para los motores', () => {
  expect(GUIAS.map(g => g.id)).toEqual(['qtr', 'vl53l0x', 'tcs34725', 'mpu6050', 'motores']);
  expect(GUIAS.map(g => g.libreria)).toEqual(['QTRSensors (Pololu)', 'Adafruit_VL53L0X', 'Adafruit_TCS34725', 'MPU6050_light',
    'Sin librería: pinMode, digitalWrite, ledcAttach y ledcWrite']);
  for (const g of GUIAS) {
    expect(g.titulo, g.id).not.toBe('');
    expect(g.explicacion.length, g.id).toBeGreaterThan(0);
    expect(g.programa, g.id).toContain('void setup()');
  }
});

it('el aviso I2C está en el VL53L0X y el TCS34725: cada uno en su canal del multiplexor', () => {
  const AVISO = 'El VL53L0X y los dos TCS34725 usan la misma dirección I2C (0x29). En el Dynamis V2 cada uno va en su canal del multiplexor TCA9548A (0x70): canal 0 el TCS34725 izquierdo, 1 el derecho y 2 el VL53L0X. Abre el canal del sensor antes de usarlo; si abres dos de ellos a la vez, chocan y el simulador te avisa.';
  expect(GUIAS.filter(g => g.aviso).map(g => [g.id, g.aviso])).toEqual([['vl53l0x', AVISO], ['tcs34725', AVISO]]);
});

it('las guías usan la placa Dynamis V2: emisores del QTR, canales del multiplexor, MPU6050 hacia atrás y PWM con ledcWrite', () => {
  const programa = (id: string) => GUIAS.find(g => g.id === id)!.programa;
  expect(programa('qtr')).toContain('qtr.setEmitterPin(27);');
  expect(programa('vl53l0x')).toContain('abrirCanal(2);');
  expect(programa('tcs34725')).toContain('abrirCanal(0);');
  expect(programa('tcs34725')).toContain('abrirCanal(1);');
  expect(programa('mpu6050')).toContain('mpu.getAngleY()');
  expect(programa('mpu6050')).not.toContain('-mpu.getAngleY()');
  expect(programa('motores')).toContain('const int PWM_IZQ = 4, IN1_IZQ = 16, IN2_IZQ = 17;');
  expect(programa('motores')).toContain('const int PWM_DER = 19, IN1_DER = 5, IN2_DER = 18;');
  for (const g of GUIAS) expect(g.programa, g.id).not.toContain('analogWrite');
});
