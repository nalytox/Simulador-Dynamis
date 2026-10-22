import { describe, it, expect } from 'vitest';
import { correrSketch } from '../ayuda/correr-sketch';
import { ROBOT_POR_DEFECTO } from '../../src/robot/config';

const INICIO = '#include <QTRSensors.h>\nQTRSensors qtr;\nconst uint8_t PINES[8] = {36, 39, 34, 35, 32, 33, 25, 26};\nuint16_t v[8];\n';
const imprimir = 'for (int i = 0; i < 8; i++) { Serial.print(v[i]); Serial.print(i < 7 ? " " : "\\n"); }';

describe('QTRSensors', { timeout: 120_000 }, () => {
  it('read promedia analogRead; calibrate deja la rareza del 1023', async () => {
    const { texto } = await correrSketch(`${INICIO}void setup() { Serial.begin(115200); qtr.setTypeAnalog(); qtr.setSensorPins(PINES, 8); qtr.read(v); ${imprimir}
      qtr.calibrate(); Serial.printf("%u %u %u %u\\n", qtr.calibrationOn.minimum[0], qtr.calibrationOn.maximum[0], qtr.calibrationOn.minimum[3], qtr.calibrationOn.maximum[3]); }\nvoid loop() {}`);
    expect(texto).toBe('180 180 180 3980 3980 180 180 180\n180 180 1023 3980\n');
  });

  it('readLineBlack: 3500 centrado, 4500 con la línea a la derecha, y recuerda el último lado', async () => {
    const sketch = (y: number) => correrSketch(`${INICIO}void setup() { Serial.begin(115200); qtr.setTypeAnalog(); qtr.setSensorPins(PINES, 8); qtr.calibrate();
      for (int i = 0; i < 8; i++) { qtr.calibrationOn.minimum[i] = 180; qtr.calibrationOn.maximum[i] = 3980; }
      Serial.println(qtr.readLineBlack(v)); }\nvoid loop() {}`, { pose: { x: 150, y, yaw: 0 } });
    expect((await sketch(150)).texto).toBe('3500\r\n');
    expect((await sketch(160)).texto).toBe('4500\r\n');
    expect((await sketch(260)).texto).toBe('0\r\n');
  });

  it('emisores: on y off esperan 300 y 1200 µs; usar la librería sin configurarla avisa', async () => {
    const robot = { ...ROBOT_POR_DEFECTO, qtr: { ...ROBOT_POR_DEFECTO.qtr, emisor: 27 } };
    const { texto } = await correrSketch(`${INICIO}void setup() { Serial.begin(115200); qtr.setTypeAnalog(); qtr.setSensorPins(PINES, 8); qtr.setEmitterPin(27);
      unsigned long t0 = micros(); qtr.read(v); unsigned long t1 = micros(); Serial.println(t1 - t0 >= 1800 && t1 - t0 < 1900); }\nvoid loop() {}`, { robot });
    expect(texto).toBe('1\r\n');
    const { sim } = await correrSketch(`${INICIO}QTRSensors otro;\nvoid setup() { otro.read(v); qtr.setTypeAnalog(); qtr.read(v); qtr.setSensorPins(PINES, 8); qtr.readLineBlack(v); }\nvoid loop() {}`);
    expect(sim.avisos).toEqual(expect.arrayContaining(['Llama a setTypeAnalog() del QTR antes de leerlo.', 'Llama a setSensorPins() del QTR antes de leerlo.',
      'Calibra el QTR con calibrate() antes de usar readCalibrated o readLine.']));
  });
});
