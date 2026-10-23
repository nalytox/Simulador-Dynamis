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

  it('readCalibrated usa los tipos de Pololu: rango uint16 y valor int16', async () => {
    const { texto } = await correrSketch(`${INICIO}void setup() { Serial.begin(115200); qtr.setTypeAnalog(); qtr.setSensorPins(PINES, 8); qtr.calibrate();
      for (int i = 0; i < 8; i++) { qtr.calibrationOn.minimum[i] = 181; qtr.calibrationOn.maximum[i] = 180; } qtr.readCalibrated(v); ${imprimir}
      for (int i = 0; i < 8; i++) { qtr.calibrationOn.minimum[i] = 180; qtr.calibrationOn.maximum[i] = 200; } qtr.readCalibrated(v); ${imprimir} }\nvoid loop() {}`,
      { pose: { x: 150, y: 150, yaw: 0 } });
    // Rango 180 − 181 → 65535: blanco da 0 y la cinta (3980) da 3799000 / 65535 = 57. Rango 20: la cinta se desborda en int16 y da 0.
    expect(texto).toBe('0 0 0 57 57 0 0 0\n0 0 0 0 0 0 0 0\n');
  });

  it('OnAndOff se acota a 1023, las muestras se suman en uint16 y OddEven existe como en Pololu', async () => {
    const robot = { ...ROBOT_POR_DEFECTO, qtr: { ...ROBOT_POR_DEFECTO.qtr, emisor: 27 } };
    const { texto } = await correrSketch(`${INICIO}void setup() { Serial.begin(115200); qtr.setTypeAnalog(); qtr.setSensorPins(PINES, 8); qtr.setEmitterPin(27);
      qtr.read(v, QTRReadMode::OnAndOff); Serial.println(v[0]); qtr.read(v, QTRReadMode::OddEven); Serial.println(v[0]);
      qtr.read(v, QTRReadMode::OddEvenAndOff); Serial.println(v[0]); qtr.setSamplesPerSensor(20); qtr.read(v, QTRReadMode::Off); Serial.println(v[0]); }\nvoid loop() {}`,
      { robot, modelos: { leerQTR: e => e.sensores.map(() => (e.emisoresEncendidos ? 100 : 4095)) } });
    expect(texto).toBe(['1023', '100', '1023', '818', ''].join('\r\n'));
  });

  it('un ciclo que lee el QTR sin configurarlo no congela el tiempo', { timeout: 20_000 }, async () => {
    const { sim, resultado } = await correrSketch(`${INICIO}void setup() {}\nvoid loop() { while (true) { qtr.read(v); if (v[0] > 2000) break; } }`, { duracionUs: 50_000 });
    expect(resultado.motivo).toBe('tiempo');
    expect(sim.avisos).toContain('Llama a setTypeAnalog() del QTR antes de leerlo.');
  });
});
