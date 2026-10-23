import { describe, it, expect } from 'vitest';
import { correrSketch } from '../ayuda/correr-sketch';
import { pistaDe } from '../ayuda/pistas';

const CON_OBSTACULO = pistaDe({ columnas: 4, filas: 1, baldosas: [0, 1, 2, 3].map(c => ({ c, r: 0, tipo: 'recta' })),
  objetos: [{ tipo: 'obstaculo', x: 600, y: 150, rot: 0 }] });
const INICIO = '#include <Wire.h>\n#include <VL53L0X.h>\nVL53L0X sensor;\n';

describe('VL53L0X y Wire', { timeout: 120_000 }, () => {
  it('lectura única: distancia, 33 ms de presupuesto y presupuesto configurable', async () => {
    const { texto } = await correrSketch(`${INICIO}void setup() { Serial.begin(115200); Wire.begin(); sensor.setTimeout(500); Serial.println(sensor.init());
      unsigned long t0 = millis(); Serial.println(sensor.readRangeSingleMillimeters()); Serial.println(millis() - t0);
      Serial.println(sensor.setMeasurementTimingBudget(10000)); Serial.println(sensor.setMeasurementTimingBudget(200000)); Serial.println(sensor.getMeasurementTimingBudget());
      t0 = millis(); sensor.readRangeSingleMillimeters(); Serial.println(millis() - t0); Serial.println(sensor.getAddress(), HEX); sensor.setAddress(0x30); Serial.println(sensor.getAddress(), HEX); }\nvoid loop() {}`,
      { pista: CON_OBSTACULO, duracionUs: 500_000 });
    expect(texto).toBe(['1', '308', '33', '0', '1', '200000', '200', '29', '30', ''].join('\r\n'));
  });

  it('modo continuo: una medida por período', async () => {
    const { texto } = await correrSketch(`${INICIO}void setup() { Serial.begin(115200); sensor.init(); sensor.startContinuous(100);
      for (int i = 0; i < 3; i++) { sensor.readRangeContinuousMillimeters(); Serial.println((millis() + 50) / 100); } }\nvoid loop() {}`,
      { pista: CON_OBSTACULO, duracionUs: 500_000 });
    expect(texto).toBe('1\r\n2\r\n3\r\n');
  });

  it('sin objetivo da 8190; sin init da 65535 con aviso; Wire directo avisa', async () => {
    const { texto, sim } = await correrSketch(`${INICIO}VL53L0X otro;\nvoid setup() { Serial.begin(115200); sensor.init(); Serial.println(sensor.readRangeSingleMillimeters());
      Serial.println(otro.readRangeSingleMillimeters()); Serial.println(otro.timeoutOccurred()); Serial.println(otro.timeoutOccurred());
      Wire.beginTransmission(0x29); Serial.println(Wire.endTransmission()); Serial.println(Wire.requestFrom(0x29, 2)); }\nvoid loop() {}`, { duracionUs: 300_000 });
    expect(texto).toBe(['8190', '65535', '1', '0', '2', '0', ''].join('\r\n'));
    expect(sim.avisos).toEqual(expect.arrayContaining(['Llama a init() del VL53L0X antes de leerlo.',
      'El simulador no tiene un bus I2C directo: usa las librerías de los sensores en vez de Wire.beginTransmission o Wire.requestFrom.']));
  });

  it('un ciclo que espera al VL53L0X sin init no congela el tiempo', { timeout: 20_000 }, async () => {
    const { sim, resultado } = await correrSketch(`${INICIO}void setup() { sensor.setTimeout(500); while (sensor.readRangeSingleMillimeters() > 100) {} }\nvoid loop() {}`,
      { duracionUs: 50_000 });
    expect(resultado.motivo).toBe('tiempo');
    expect(sim.avisos).toContain('Llama a init() del VL53L0X antes de leerlo.');
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
    expect(sim.avisos).toContain('El simulador no tiene un bus I2C directo: usa las librerías de los sensores en vez de Wire.beginTransmission o Wire.requestFrom.');
  });
});
