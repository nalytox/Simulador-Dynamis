import { it, expect } from 'vitest';
import { conexionesDe } from '../../src/ayuda/conexiones';
import { puntaje } from '../../src/ayuda/bases';
import { GUIAS } from '../../src/ayuda/guias';
import { ROBOT_POR_DEFECTO } from '../../src/robot/config';

it('conexionesDe con el robot por defecto', () => {
  expect(conexionesDe(ROBOT_POR_DEFECTO)).toEqual([
    { grupo: 'Motor izquierdo', filas: [{ que: 'PWM', pin: '18' }, { que: 'IN1', pin: '16' }, { que: 'IN2', pin: '17' }] },
    { grupo: 'Motor derecho', filas: [{ que: 'PWM', pin: '19' }, { que: 'IN1', pin: '4' }, { que: 'IN2', pin: '5' }] },
    { grupo: 'Driver', filas: [{ que: 'STBY', pin: 'sin conectar' }] },
    { grupo: 'Sensor de línea', filas: [
      { que: 'S1 (izquierda)', pin: '36' }, { que: 'S2', pin: '39' }, { que: 'S3', pin: '34' }, { que: 'S4', pin: '35' },
      { que: 'S5', pin: '32' }, { que: 'S6', pin: '33' }, { que: 'S7', pin: '25' }, { que: 'S8 (derecha)', pin: '26' },
      { que: 'Emisores', pin: 'siempre encendidos' },
    ] },
    { grupo: 'Bus I2C', filas: [
      { que: 'SDA', pin: '21' }, { que: 'SCL', pin: '22' },
      { que: 'VL53L0X', pin: '0x29' }, { que: 'TCS34725', pin: '0x29 ⚠' }, { que: 'MPU6050', pin: '0x68' },
      { que: 'LED del TCS34725', pin: 'encendido, salvo con setInterrupt(true)' },
    ] },
  ]);
});

it('con dos TCS34725 detrás del multiplexor, el bus I2C muestra el TCA9548A y el canal de cada uno', () => {
  const robot = { ...ROBOT_POR_DEFECTO, tcs34725: { ...ROBOT_POR_DEFECTO.tcs34725, canal: 0 },
    tcs34725b: { ...ROBOT_POR_DEFECTO.tcs34725b, instalado: true, canal: 1, led: 14 } };
  expect(conexionesDe(robot).find(g => g.grupo === 'Bus I2C')!.filas).toEqual([
    { que: 'SDA', pin: '21' }, { que: 'SCL', pin: '22' },
    { que: 'VL53L0X', pin: '0x29' }, { que: 'Multiplexor TCA9548A', pin: '0x70' },
    { que: 'TCS34725 (color 1)', pin: '0x29, canal 0 del multiplexor' }, { que: 'TCS34725 (color 2)', pin: '0x29, canal 1 del multiplexor' },
    { que: 'MPU6050', pin: '0x68' },
    { que: 'LED del TCS34725 (color 1)', pin: 'encendido, salvo con setInterrupt(true)' }, { que: 'LED del TCS34725 (color 2)', pin: '14' },
  ]);
});

it('un pin opcional conectado muestra su número', () => {
  const robot = { ...ROBOT_POR_DEFECTO, motores: { ...ROBOT_POR_DEFECTO.motores, stby: 23 }, qtr: { ...ROBOT_POR_DEFECTO.qtr, emisor: 27 }, tcs34725: { ...ROBOT_POR_DEFECTO.tcs34725, led: 14 } };
  const filas = conexionesDe(robot).flatMap(g => g.filas);
  expect(filas).toContainEqual({ que: 'STBY', pin: '23' });
  expect(filas).toContainEqual({ que: 'Emisores', pin: '27' });
  expect(filas).toContainEqual({ que: 'LED del TCS34725', pin: '14' });
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

it('las guías cubren los sensores de la spec', () => {
  expect(GUIAS.map(g => g.id)).toEqual(['qtr', 'vl53l0x', 'tcs34725', 'mpu6050', 'motores']);
  expect(GUIAS.map(g => g.libreria)).toEqual(['QTRSensors (Pololu)', 'Adafruit_VL53L0X', 'Adafruit_TCS34725', 'MPU6050_light',
    'Sin librería: pinMode, digitalWrite y analogWrite']);
  for (const g of GUIAS) {
    expect(g.titulo, g.id).not.toBe('');
    expect(g.explicacion.length, g.id).toBeGreaterThan(0);
    expect(g.programa, g.id).toContain('void setup()');
  }
});

it('el aviso I2C está en el VL53L0X y el TCS34725', () => {
  const AVISO = 'El VL53L0X y el TCS34725 usan la misma dirección I2C (0x29). El simulador no lo nota, pero en el robot real hay que cambiar la dirección del VL53L0X con setAddress (apagando el otro con XSHUT) o poner el TCS34725 detrás de un multiplexor TCA9548A (en «Mi robot», ponle su canal).';
  expect(GUIAS.filter(g => g.aviso).map(g => [g.id, g.aviso])).toEqual([['vl53l0x', AVISO], ['tcs34725', AVISO]]);
});
