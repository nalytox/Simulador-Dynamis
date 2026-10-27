import { describe, it, expect } from 'vitest';
import { correrSketch } from '../ayuda/correr-sketch';
import { pistaDe } from '../ayuda/pistas';
import { ROBOT_POR_DEFECTO } from '../../src/robot/config';

const SERIAL = 'Serial.begin(115200);';
const PINES_QTR = 'const int P[8] = {36, 39, 34, 35, 32, 33, 25, 26};\n';
/** Un TCS34725 directo en el bus, para leerlo por I2C sin abrir canales (el láser sigue en su canal). */
const UN_TCS_DIRECTO = { ...ROBOT_POR_DEFECTO, tcs34725: { ...ROBOT_POR_DEFECTO.tcs34725, canal: null },
  tcs34725b: { ...ROBOT_POR_DEFECTO.tcs34725b, instalado: false } };

describe('lecturas de los sensores', { timeout: 120_000 }, () => {
  it('analogRead de los pines del QTR sale del modelo del QTR', async () => {
    const { texto } = await correrSketch(`${PINES_QTR}void setup() { ${SERIAL} for (int i = 0; i < 8; i++) { Serial.print(analogRead(P[i])); Serial.print(' '); } }\nvoid loop() {}`);
    expect(texto).toBe('180 180 180 3980 3980 180 180 180 ');
  });

  it('vl53_medir, mpu_leer, I2C directo y aviso; el MPU cuesta 0,4 ms y el I2C 22,5 µs por byte', async () => {
    const pista = pistaDe({ columnas: 4, filas: 1, baldosas: [0, 1, 2, 3].map(c => ({ c, r: 0, tipo: 'recta' })), objetos: [{ tipo: 'obstaculo', x: 600, y: 150, rot: 0 }] });
    const { texto, sim } = await correrSketch(`void setup() { ${SERIAL}
      Serial.println(dyn_vl53_medir());
      float d[7]; unsigned long t0 = micros(); dyn_mpu_leer(d); unsigned long t1 = micros();
      Serial.printf("%.2f %.2f %.2f %.2f %lu\\n", d[0], d[2], d[5], d[6], t1 - t0);
      uint8_t comando = 0x80 | 0x12, id = 0; unsigned long t2 = micros(); int escrito = dyn_i2c_escribir(0x29, &comando, 1);
      int leido = dyn_i2c_leer(0x29, &id, 1); unsigned long t3 = micros(); Serial.printf("%d %d %X %lu\\n", escrito, leido, id, t3 - t2);
      dyn_aviso("hola", 4); }\nvoid loop() {}`, { pista, robot: UN_TCS_DIRECTO });
    expect(texto).toBe('318\r\n0.00 9.81 0.00 25.00 401\n1 1 44 91\n');
    expect(sim.avisos).toContain('hola');
  });

  it('un modelo de sensor que falla es un error del simulador', async () => {
    const { resultado } = await correrSketch('void setup() { analogRead(36); }\nvoid loop() {}', { modelos: { leerQTR: () => { throw new Error('sin datos'); } } });
    expect(resultado.error).toMatchObject({ tipo: 'simulador', tecnico: expect.stringContaining('modelo del QTR') });
  });
});
