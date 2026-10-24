import { describe, it, expect } from 'vitest';
import { correrSketch } from '../ayuda/correr-sketch';
import { pistaDe } from '../ayuda/pistas';

const CON_OBSTACULO = pistaDe({ columnas: 4, filas: 1, baldosas: [0, 1, 2, 3].map(c => ({ c, r: 0, tipo: 'recta' })),
  objetos: [{ tipo: 'obstaculo', x: 600, y: 150, rot: 0 }] });
const INICIO = '#include <Wire.h>\n#include <Adafruit_VL53L0X.h>\nAdafruit_VL53L0X lox = Adafruit_VL53L0X();\nVL53L0X_RangingMeasurementData_t m;\n';
const BUS_DIRECTO = 'El simulador no tiene un bus I2C directo: usa las librerías de los sensores en vez de Wire.beginTransmission o Wire.requestFrom.';
const lineas = (...l: (string | number)[]) => [...l, ''].join('\r\n');

describe('VL53L0X (Adafruit_VL53L0X) y Wire', { timeout: 120_000 }, () => {
  it('rangingTest: distancia y estado 0 en 33 ms; presupuesto configurable; readRange y readRangeStatus', async () => {
    const { texto, sim } = await correrSketch(`${INICIO}void setup() { Serial.begin(115200); Wire.begin(); Serial.println(lox.begin());
      unsigned long t0 = micros(); Serial.println(lox.rangingTest(&m, false)); Serial.println((micros() - t0 + 500) / 1000);
      Serial.println(m.RangeMilliMeter); Serial.println(m.RangeStatus);
      Serial.println(lox.setMeasurementTimingBudgetMicroSeconds(10000)); Serial.println(lox.setMeasurementTimingBudgetMicroSeconds(200000)); Serial.println(lox.getMeasurementTimingBudgetMicroSeconds());
      t0 = micros(); Serial.println(lox.readRange()); Serial.println((micros() - t0 + 500) / 1000); Serial.println(lox.readRangeStatus()); Serial.println(lox.Status); }\nvoid loop() {}`,
      { pista: CON_OBSTACULO, duracionUs: 500_000 });
    expect(texto).toBe(lineas(1, 0, 33, 308, 0, 0, 1, 200000, 308, 200, 0, 0));
    expect(sim.avisos).toEqual([]);
  });

  it('sin objetivo: estado 4 («Phase Fail»); readRange entrega 8190 y readRangeResult 65535', async () => {
    const { texto } = await correrSketch(`${INICIO}void setup() { Serial.begin(115200); lox.begin(); lox.rangingTest(&m); Serial.println(m.RangeMilliMeter); lox.printRangeStatus(&m);
      Serial.println(lox.readRange()); Serial.println(lox.readRangeStatus());
      Serial.println(lox.startRange()); Serial.println(lox.waitRangeComplete()); Serial.println(lox.readRangeResult()); }\nvoid loop() {}`,
      { duracionUs: 300_000 });
    expect(texto).toBe(lineas(8190, 'Range Status: 4 : Phase Fail', 8190, 4, 1, 1, 65535));
  });

  it('una medida sin esperar: startRange, isRangeComplete y readRangeResult', async () => {
    const { texto } = await correrSketch(`${INICIO}void setup() { Serial.begin(115200); lox.begin(); Serial.println(lox.startRange());
      unsigned long t0 = micros(); long vueltas = 0; while (!lox.isRangeComplete()) vueltas++;
      Serial.println((micros() - t0 + 500) / 1000); Serial.println(vueltas > 0); Serial.println(lox.readRangeResult()); }\nvoid loop() {}`,
      { pista: CON_OBSTACULO, duracionUs: 300_000 });
    expect(texto).toBe(lineas(1, 33, 1, 308));
  });

  it('modo continuo: una medida por período, con readRangeResult o con readRange', async () => {
    const { texto, sim } = await correrSketch(`${INICIO}void setup() { Serial.begin(115200); lox.begin(); Serial.println(lox.startRangeContinuous(100)); unsigned long t0 = micros();
      for (int i = 0; i < 2; i++) { while (!lox.isRangeComplete()) {} Serial.println((micros() - t0 + 500) / 1000); Serial.println(lox.readRangeResult()); }
      Serial.println(lox.readRangeResult());
      for (int i = 0; i < 2; i++) { Serial.println(lox.readRange()); Serial.println((micros() - t0 + 500) / 1000); }
      lox.stopRangeContinuous(); Serial.println(lox.isRangeComplete()); }\nvoid loop() {}`,
      { pista: CON_OBSTACULO, duracionUs: 600_000 });
    // La primera medida termina un presupuesto (33 ms) después de empezar; las siguientes, una por
    // período. Sin medida nueva, readRangeResult entrega la anterior otra vez.
    expect(texto).toBe(lineas(1, 33, 308, 133, 308, 308, 308, 233, 308, 333, 0));
    expect(sim.avisos).toEqual(['isRangeComplete() necesita una medida en curso: llama antes a startRange() o startRangeContinuous().']);
  });

  it('configSensor, límites, VCSEL, dirección y la salida de debug', async () => {
    const { texto } = await correrSketch(`${INICIO}void setup() { Serial.begin(115200);
      Serial.println(lox.begin(0x30, false, &Wire, Adafruit_VL53L0X::VL53L0X_SENSE_HIGH_ACCURACY));
      Serial.println(lox.getMeasurementTimingBudgetMicroSeconds()); Serial.println(lox.getLimitCheckEnable(VL53L0X_CHECKENABLE_RANGE_IGNORE_THRESHOLD));
      Serial.println(lox.getLimitCheckValue(VL53L0X_CHECKENABLE_SIGMA_FINAL_RANGE) / 65536);
      unsigned long t0 = micros(); lox.readRange(); Serial.println((micros() - t0 + 500) / 1000);
      Serial.println(lox.configSensor(Adafruit_VL53L0X::VL53L0X_SENSE_DEFAULT)); Serial.println(lox.getLimitCheckValue(VL53L0X_CHECKENABLE_RANGE_IGNORE_THRESHOLD));
      Serial.println(lox.getVcselPulsePeriod(VL53L0X_VCSEL_PERIOD_PRE_RANGE)); Serial.println(lox.setVcselPulsePeriod(VL53L0X_VCSEL_PERIOD_FINAL_RANGE, 9));
      Serial.println(lox.setVcselPulsePeriod(VL53L0X_VCSEL_PERIOD_FINAL_RANGE, 14)); Serial.println(lox.getVcselPulsePeriod(VL53L0X_VCSEL_PERIOD_FINAL_RANGE));
      Serial.println(lox.setLimitCheckEnable(6, 1)); Serial.println(lox.setAddress(0x31));
      lox.configSensor(Adafruit_VL53L0X::VL53L0X_SENSE_LONG_RANGE); Serial.println(lox.getMeasurementTimingBudgetMicroSeconds());
      lox.rangingTest(&m, true); }\nvoid loop() {}`,
      { pista: CON_OBSTACULO, duracionUs: 600_000 });
    expect(texto).toBe(lineas(1, 200000, 0, 18, 200, 1, 2260, 14, 0, 1, 14, 0, 1, '  VL53L0X_SENSE_LONG_RANGE', 33000,
      'sVL53L0X: PerformSingleRangingMeasurement', 'Range Status: 0 : Range Valid', 'RANGE IGNORE THRESHOLD: 0.00', 'Measured distance: 308'));
  });

  it('sin begin avisa y entrega 65535; isRangeComplete y waitRangeComplete sin medida en curso avisan; Wire directo avisa', async () => {
    const { texto, sim } = await correrSketch(`${INICIO}Adafruit_VL53L0X otro;\nvoid setup() { Serial.begin(115200);
      Serial.println(otro.readRange()); Serial.println(otro.rangingTest(&m)); Serial.println(m.RangeStatus); Serial.println(otro.startRangeContinuous());
      lox.begin(); Serial.println(lox.isRangeComplete()); Serial.println(lox.waitRangeComplete());
      Wire.beginTransmission(0x29); Serial.println(Wire.endTransmission()); Serial.println(Wire.requestFrom(0x29, 2)); }\nvoid loop() {}`,
      { duracionUs: 300_000 });
    expect(texto).toBe(lineas(65535, -20, 4, 0, 0, 0, 2, 0));
    expect(sim.avisos).toEqual(expect.arrayContaining(['Llama a begin() del VL53L0X antes de leerlo.',
      'isRangeComplete() necesita una medida en curso: llama antes a startRange() o startRangeContinuous().',
      'waitRangeComplete() necesita una medida en curso: llama antes a startRange() o startRangeContinuous().', BUS_DIRECTO]));
  });

  it('un ciclo que espera al VL53L0X sin begin no congela el tiempo', { timeout: 20_000 }, async () => {
    const { sim, resultado } = await correrSketch(`${INICIO}void setup() { while (lox.readRange() > 100) {} }\nvoid loop() {}`,
      { duracionUs: 50_000 });
    expect(resultado.motivo).toBe('tiempo');
    expect(sim.avisos).toContain('Llama a begin() del VL53L0X antes de leerlo.');
  });

  it('el sketch clásico del MPU6050 por I2C directo compila, avisa y no congela el tiempo', { timeout: 20_000 }, async () => {
    const { sim, resultado } = await correrSketch(`#include <Wire.h>
const int MPU_addr = 0x68;
int16_t AcX, AcY, AcZ, Tmp, GyX, GyY, GyZ;
void setup() { Wire.begin(); Wire.beginTransmission(MPU_addr); Wire.write(0x6B); Wire.write(0); Wire.endTransmission(true); Serial.begin(9600); }
void loop() {
  Wire.beginTransmission(MPU_addr); Wire.write(0x3B); Wire.endTransmission(false); Wire.requestFrom(MPU_addr, 14, true);
  while (Wire.available() < 14) {}
  AcX = Wire.read() << 8 | Wire.read(); AcY = Wire.read() << 8 | Wire.read(); AcZ = Wire.read() << 8 | Wire.read();
  Tmp = Wire.read() << 8 | Wire.read(); GyX = Wire.read() << 8 | Wire.read(); GyY = Wire.read() << 8 | Wire.read(); GyZ = Wire.read() << 8 | Wire.read();
  Serial.print("AcX = "); Serial.println(AcX); delay(333);
}`, { duracionUs: 50_000 });
    expect(resultado.motivo).toBe('tiempo');
    expect(sim.avisos).toContain(BUS_DIRECTO);
  });
});
