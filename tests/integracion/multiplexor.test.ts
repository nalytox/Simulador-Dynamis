import { describe, it, expect } from 'vitest';
import { correrSketch } from '../ayuda/correr-sketch';
import { pistaDe } from '../ayuda/pistas';
import { ROBOT_POR_DEFECTO, type ConfigRobot } from '../../src/robot/config';

/** Dos TCS34725 en los canales 0 (a la derecha) y 1 (a la izquierda) de un TCA9548A. */
const ROBOT: ConfigRobot = {
  ...ROBOT_POR_DEFECTO,
  tcs34725: { x: 40, y: -46, z: 5, led: null, canal: 0 },
  tcs34725b: { instalado: true, x: 40, y: 46, z: 5, led: null, canal: 1 },
};
/** Un solo TCS34725 y el láser, los dos directo en el bus (el láser con otra dirección). */
const SIN_MUX: ConfigRobot = {
  ...ROBOT_POR_DEFECTO,
  tcs34725: { ...ROBOT_POR_DEFECTO.tcs34725, canal: null },
  tcs34725b: { ...ROBOT_POR_DEFECTO.tcs34725b, instalado: false, canal: null },
  vl53l0x: { ...ROBOT_POR_DEFECTO.vl53l0x, canal: null },
};
const MUX = `#include <Wire.h>
#include <Adafruit_TCS34725.h>
void muxSelect(uint8_t canal) { Wire.beginTransmission(0x70); Wire.write(1 << canal); Wire.endTransmission(); }
uint16_t r, g, b, c;
`;

describe('multiplexor TCA9548A y dos TCS34725', { timeout: 120_000 }, () => {
  it('cada objeto lee el sensor del canal abierto; con el canal cerrado, begin falla y avisa', async () => {
    const cruce = pistaDe({ columnas: 1, filas: 1, baldosas: [{ c: 0, r: 0, tipo: 'cruce', props: { marcas: { ai: false, ad: true, di: false, dd: false } } }] });
    const { texto, sim } = await correrSketch(`${MUX}Adafruit_TCS34725 rgb1 = Adafruit_TCS34725(TCS34725_INTEGRATIONTIME_2_4MS, TCS34725_GAIN_1X);
Adafruit_TCS34725 rgb2 = Adafruit_TCS34725(TCS34725_INTEGRATIONTIME_2_4MS, TCS34725_GAIN_1X);
void setup() { Serial.begin(115200); Wire.begin();
  muxSelect(0); Serial.println(rgb1.begin());
  muxSelect(1); Serial.println(rgb2.begin());
  muxSelect(0); rgb1.getRawData(&r, &g, &b, &c); Serial.printf("%u %u %u %u\\n", r, g, b, c);
  muxSelect(1); rgb2.getRawData(&r, &g, &b, &c); Serial.printf("%u %u %u %u\\n", r, g, b, c);
  Wire.beginTransmission(0x70); Wire.write(0); Serial.println(Wire.endTransmission());
  Serial.println(rgb1.begin()); }
void loop() {}`, { robot: ROBOT, pista: cruce, pose: { x: 88, y: 174, yaw: 0 } });
    // El sensor 1 (a la derecha) queda sobre la marca verde; el 2 (a la izquierda), sobre blanco.
    expect(texto).toBe('1\r\n1\r\n0 16 8 24\n24 24 24 72\n0\r\n0\r\n');
    expect(sim.avisos).toEqual(['Nadie respondió en 0x29: abre el canal del multiplexor donde está el TCS34725.']);
  });

  it('lectura directa de los 8 registros de datos por Wire1, con autoincremento', async () => {
    const { texto, sim } = await correrSketch(`${MUX}Adafruit_TCS34725 tcs;
void setup() { Serial.begin(115200); Wire1.begin(13, 14, 400000);
  Wire1.beginTransmission(0x70); Wire1.write(1 << 1); Wire1.endTransmission();
  tcs.begin(TCS34725_ADDRESS, &Wire1);
  Wire1.beginTransmission(TCS34725_ADDRESS); Wire1.write(TCS34725_COMMAND_BIT | 0x20 | TCS34725_CDATAL); Wire1.endTransmission();
  Serial.println(Wire1.requestFrom((uint8_t)TCS34725_ADDRESS, (uint8_t)8));
  uint16_t v[4]; for (int i = 0; i < 4; i++) { uint8_t bajo = Wire1.read(); uint8_t alto = Wire1.read(); v[i] = bajo | (alto << 8); }
  Serial.printf("%u %u %u %u %d\\n", v[0], v[1], v[2], v[3], Wire1.available());
  Serial.println(Wire1.read()); }
void loop() {}`, { robot: ROBOT });
    expect(texto).toBe('8\r\n72 24 24 24 0\n-1\r\n');
    expect(sim.avisos).toEqual([]);
  });

  it('sin multiplexor en el robot, escribir a 0x70 no tiene respuesta y avisa', async () => {
    const { texto, sim } = await correrSketch(`${MUX}void setup() { Serial.begin(115200); Wire.beginTransmission(0x70); Wire.write(1); Serial.println(Wire.endTransmission()); }
void loop() {}`, { robot: SIN_MUX });
    expect(texto).toBe('2\r\n');
    expect(sim.avisos).toEqual(['Nadie respondió en 0x70: tu robot no tiene multiplexor. Ponle a cada TCS34725 su canal en «Mi robot».']);
  });

  it('btStop y btStarted existen: el simulador no tiene radio', async () => {
    const { texto } = await correrSketch('void setup() { Serial.begin(115200); Serial.println(btStop()); Serial.println(btStarted()); }\nvoid loop() {}');
    expect(texto).toBe('1\r\n0\r\n');
  });
});
