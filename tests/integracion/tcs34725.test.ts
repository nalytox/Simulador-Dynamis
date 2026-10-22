import { describe, it, expect } from 'vitest';
import { correrSketch } from '../ayuda/correr-sketch';
import { pistaDe } from '../ayuda/pistas';

const INICIO = '#include <Wire.h>\n#include <Adafruit_TCS34725.h>\n';

describe('Adafruit_TCS34725', { timeout: 120_000 }, () => {
  it('por defecto: 2,4 ms y 1x sobre blanco; getRawData espera la integración', async () => {
    const { texto } = await correrSketch(`${INICIO}Adafruit_TCS34725 tcs;\nuint16_t r, g, b, c;\nvoid setup() { Serial.begin(115200); Serial.println(tcs.begin());
      unsigned long t0 = millis(); tcs.getRawData(&r, &g, &b, &c); Serial.printf("%u %u %u %u %lu\\n", r, g, b, c, millis() - t0); }\nvoid loop() {}`);
    expect(texto).toBe('1\r\n24 24 24 72 3\n');
  });

  it('50 ms y 4x: getRGB, temperatura de color y lux', async () => {
    const { texto } = await correrSketch(`${INICIO}Adafruit_TCS34725 tcs(TCS34725_INTEGRATIONTIME_50MS, TCS34725_GAIN_4X);\nuint16_t r, g, b, c; float fr, fg, fb;\nvoid setup() { Serial.begin(115200); tcs.begin();
      tcs.getRawData(&r, &g, &b, &c); tcs.getRGB(&fr, &fg, &fb);
      Serial.printf("%u %u %.2f %u %u\\n", r, c, fr, tcs.calculateColorTemperature_dn40(r, g, b, c), tcs.calculateLux(r, g, b)); }\nvoid loop() {}`,
      { duracionUs: 300_000 });
    expect(texto).toBe('2016 6048 85.00 5201 1051\n');
  });

  it('satura en las cuentas máximas; sobre una marca verde lee verde; setInterrupt apaga el LED', async () => {
    const sat = await correrSketch(`${INICIO}Adafruit_TCS34725 tcs(TCS34725_INTEGRATIONTIME_154MS, TCS34725_GAIN_60X);\nuint16_t r, g, b, c;\nvoid setup() { Serial.begin(115200); tcs.begin(); tcs.getRawData(&r, &g, &b, &c); Serial.printf("%u %u\\n", r, c); }\nvoid loop() {}`,
      { duracionUs: 1_000_000 });
    expect(sat.texto).toBe('65535 65535\n');
    const cruce = pistaDe({ columnas: 1, filas: 1, baldosas: [{ c: 0, r: 0, tipo: 'cruce', props: { marcas: { ai: false, ad: true, di: false, dd: false } } }] });
    const verde = await correrSketch(`${INICIO}Adafruit_TCS34725 tcs;\nuint16_t r, g, b, c;\nvoid setup() { Serial.begin(115200); tcs.begin(); tcs.getRawData(&r, &g, &b, &c); Serial.printf("%u %u %u %u\\n", r, g, b, c); }\nvoid loop() {}`,
      { pista: cruce, pose: { x: 88, y: 174, yaw: 0 } });
    expect(verde.texto).toBe('0 16 8 24\n');
    const leds: boolean[] = [];
    await correrSketch(`${INICIO}Adafruit_TCS34725 tcs;\nuint16_t r, g, b, c;\nvoid setup() { tcs.begin(); tcs.getRawData(&r, &g, &b, &c); tcs.setInterrupt(true); tcs.getRawData(&r, &g, &b, &c); }\nvoid loop() {}`,
      { modelos: { leerTCS34725: e => { leds.push(e.ledEncendido); return { r: 0, g: 0, b: 0, c: 0 }; } } });
    expect(leds.slice(-2)).toEqual([true, false]);
  });
});
