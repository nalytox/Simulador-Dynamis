import { describe, it, expect } from 'vitest';
import { correrSketch } from '../ayuda/correr-sketch';
import { pistaDe } from '../ayuda/pistas';
import { ROBOT_POR_DEFECTO } from '../../src/robot/config';

const SERIAL = 'Serial.begin(115200);';
const PINES_QTR = 'const int P[8] = {36, 39, 34, 35, 32, 33, 25, 26};\n';

describe('lecturas de los sensores', { timeout: 120_000 }, () => {
  it('analogRead de los pines del QTR sale del modelo del QTR', async () => {
    const { texto } = await correrSketch(`${PINES_QTR}void setup() { ${SERIAL} for (int i = 0; i < 8; i++) { Serial.print(analogRead(P[i])); Serial.print(' '); } }\nvoid loop() {}`);
    expect(texto).toBe('180 180 180 3980 3980 180 180 180 ');
  });

  it('vl53_medir, mpu_leer, tcs_leer y aviso; la lectura del MPU cuesta 0,4 ms', async () => {
    const pista = pistaDe({ columnas: 4, filas: 1, baldosas: [0, 1, 2, 3].map(c => ({ c, r: 0, tipo: 'recta' })), objetos: [{ tipo: 'obstaculo', x: 600, y: 150, rot: 0 }] });
    const { texto, sim } = await correrSketch(`void setup() { ${SERIAL}
      Serial.println(dyn_vl53_medir());
      float d[7]; unsigned long t0 = micros(); dyn_mpu_leer(d); unsigned long t1 = micros();
      Serial.printf("%.2f %.2f %.2f %.2f %lu\\n", d[0], d[2], d[5], d[6], t1 - t0);
      uint16_t c[4]; dyn_tcs_leer(24000, 1, 1, c); Serial.printf("%u %u %u %u\\n", c[0], c[1], c[2], c[3]);
      dyn_aviso("hola", 4); }\nvoid loop() {}`, { pista });
    expect(texto).toBe('308\r\n0.00 9.81 0.00 25.00 401\n240 240 240 720\n');
    expect(sim.avisos).toContain('hola');
  });

  it('el LED del TCS sigue al pin configurado', async () => {
    const llamadas: boolean[] = [];
    const leerTCS34725 = (e: { ledEncendido: boolean }) => { llamadas.push(e.ledEncendido); return { r: 0, g: 0, b: 0, c: 0 }; };
    const robot = { ...ROBOT_POR_DEFECTO, tcs34725: { ...ROBOT_POR_DEFECTO.tcs34725, led: 27 } };
    await correrSketch('void setup() { uint16_t c[4]; pinMode(27, OUTPUT); digitalWrite(27, HIGH); dyn_tcs_leer(2400, 1, 0, c); digitalWrite(27, LOW); dyn_tcs_leer(2400, 1, 1, c); }\nvoid loop() {}',
      { robot, modelos: { leerTCS34725 } });
    expect(llamadas).toEqual([true, false]);
  });

  it('un modelo de sensor que falla es un error del simulador', async () => {
    const { resultado } = await correrSketch('void setup() { analogRead(36); }\nvoid loop() {}', { modelos: { leerQTR: () => { throw new Error('sin datos'); } } });
    expect(resultado.error).toMatchObject({ tipo: 'simulador', tecnico: expect.stringContaining('modelo del QTR') });
  });
});
