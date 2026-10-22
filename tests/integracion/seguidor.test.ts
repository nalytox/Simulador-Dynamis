import { describe, it, expect } from 'vitest';
import { correrSketch } from '../ayuda/correr-sketch';

const SEGUIDOR = `#include <QTRSensors.h>
QTRSensors qtr; const uint8_t PINES[8] = {36, 39, 34, 35, 32, 33, 25, 26}; uint16_t v[8];
void motores(int izq, int der) {
  digitalWrite(16, izq >= 0); digitalWrite(17, izq < 0); digitalWrite(4, der >= 0); digitalWrite(5, der < 0);
  analogWrite(18, constrain(abs(izq), 0, 255)); analogWrite(19, constrain(abs(der), 0, 255));
}
void girarCalibrando(int sentido, unsigned long ms) { unsigned long t0 = millis(); motores(-128 * sentido, 128 * sentido); while (millis() - t0 < ms) qtr.calibrate(); }
void setup() {
  pinMode(16, OUTPUT); pinMode(17, OUTPUT); pinMode(4, OUTPUT); pinMode(5, OUTPUT);
  qtr.setTypeAnalog(); qtr.setSensorPins(PINES, 8);
  girarCalibrando(1, 150); girarCalibrando(-1, 300); girarCalibrando(1, 150); motores(0, 0);
}
void loop() { int error = (int)qtr.readLineBlack(v) - 3500; motores(100 + error / 80, 100 - error / 80); }`;

describe('de punta a punta', { timeout: 120_000 }, () => {
  it('un seguidor de línea con QTRSensors y control P vuelve a la línea y avanza', async () => {
    const { sim, resultado } = await correrSketch(SEGUIDOR, { pose: { x: 150, y: 170, yaw: 0 }, duracionUs: 3_600_000 });
    expect(resultado.motivo).toBe('tiempo');
    expect(Math.abs(sim.estado.y - 150)).toBeLessThan(10);
    expect(sim.estado.x).toBeGreaterThan(600);
  });
});
