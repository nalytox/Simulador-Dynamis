import { describe, it, expect } from 'vitest';
import { correrSketch } from '../ayuda/correr-sketch';
import { pistaDe } from '../ayuda/pistas';

const GIRAR = 'pinMode(16, OUTPUT); pinMode(17, OUTPUT); pinMode(4, OUTPUT); pinMode(5, OUTPUT); digitalWrite(16, LOW); digitalWrite(17, HIGH); digitalWrite(4, HIGH); digitalWrite(5, LOW); analogWrite(18, 255); analogWrite(19, 255); delay(100);';
const INICIO = '#include <Wire.h>\n#include <MPU6050_light.h>\nMPU6050 mpu(Wire);\n';
/** Lo que gira el robot con GIRAR, en °/s, y lo que entrega el chip con `lsb` LSB por °/s (saturado a 16 bits). */
const GIRO_DPS = 1200 / 140 * 180 / Math.PI;
const crudo = (lsb: number) => Math.max(-32768, Math.min(32767, Math.round(GIRO_DPS * lsb)));

describe('MPU6050 (MPU6050_light)', { timeout: 120_000 }, () => {
  it('begin devuelve 0; en lo plano: aceleración en g, giro en °/s y temperatura; 0,4 ms por update; montaje invertido', async () => {
    const { texto, sim } = await correrSketch(`${INICIO}void setup() { Serial.begin(115200); Wire.begin(); Serial.println(mpu.begin());
      unsigned long t0 = micros(); mpu.update(); unsigned long t1 = micros();
      Serial.printf("%.2f %.2f %.2f %.2f %.2f %lu\\n", mpu.getAccX(), mpu.getAccZ(), mpu.getGyroZ(), mpu.getTemp(), mpu.getAngleX(), t1 - t0);
      mpu.upsideDownMounting = true; mpu.update(); Serial.printf("%.2f\\n", mpu.getAccZ()); Serial.println(mpu.getAddress(), HEX); }\nvoid loop() {}`);
    expect(texto).toBe('0\r\n0.00 1.00 0.00 24.98 0.00 402\n-1.00\n68\r\n');
    expect(sim.avisos).toEqual([]);
  });

  it('en la rampa, begin deja getAngleY en la inclinación que mide el acelerómetro', async () => {
    const alto = 300 * Math.tan(20 * Math.PI / 180);
    const pista = pistaDe({ columnas: 3, filas: 1, baldosas: [{ c: 0, r: 0, tipo: 'recta' }, { c: 1, r: 0, tipo: 'rampa' }, { c: 2, r: 0, tipo: 'recta', nivel: alto }] });
    const { texto } = await correrSketch(`${INICIO}void setup() { Serial.begin(115200); mpu.begin();
      Serial.printf("%.2f %.2f %.1f %.1f\\n", mpu.getAccX(), mpu.getAccZ(), mpu.getAccAngleY(), mpu.getAngleY()); }\nvoid loop() {}`,
      { pista, pose: { x: 450, y: 150, yaw: 0 } });
    expect(texto).toBe('0.34 0.94 -20.0 -20.0\n');
  });

  it('giro: ±500 °/s por defecto, saturación con setGyroConfig(0) y configuración inválida', async () => {
    const { texto } = await correrSketch(`${INICIO}void setup() { Serial.begin(115200); mpu.begin(); ${GIRAR}
      mpu.update(); Serial.printf("%.1f\\n", mpu.getGyroZ());
      Serial.println(mpu.setGyroConfig(0)); mpu.update(); Serial.printf("%.2f\\n", mpu.getGyroZ());
      Serial.println(mpu.setGyroConfig(7)); }\nvoid loop() {}`, { duracionUs: 300_000 });
    expect(texto).toBe(`${(crudo(65.5) / 65.5).toFixed(1)}\n0\r\n${(32767 / 131).toFixed(2)}\n1\r\n`);
  });

  it('offsets: se restan, calcOffsets los mide con 500 lecturas y update integra el giro en getAngleZ', async () => {
    const { texto } = await correrSketch(`${INICIO}void setup() { Serial.begin(115200); mpu.begin();
      mpu.setGyroOffsets(1, 2, 3); mpu.update(); Serial.printf("%.2f %.2f\\n", mpu.getGyroZoffset(), mpu.getGyroZ());
      unsigned long t0 = micros(); mpu.calcOffsets(); Serial.println((micros() - t0 + 500) / 1000);
      Serial.printf("%.2f %.2f\\n", mpu.getGyroZoffset(), mpu.getAccZoffset());
      ${GIRAR} mpu.update(); float z0 = mpu.getAngleZ(); t0 = millis(); while (millis() - t0 < 200) mpu.update();
      Serial.printf("%.1f\\n", mpu.getAngleZ() - z0); }\nvoid loop() {}`, { duracionUs: 1_200_000 });
    const lineas = texto.split(/\r?\n/);
    expect(lineas.slice(0, 3)).toEqual(['3.00 -3.00', '700', '0.00 0.00']);
    expect(Number(lineas[3])).toBeCloseTo(crudo(65.5) / 65.5 * 0.2, 0);
  });

  it('writeData y readData usan los registros del chip simulado', async () => {
    const { texto, sim } = await correrSketch(`${INICIO}void setup() { Serial.begin(115200); mpu.begin();
      Serial.println(mpu.readData(0x75), HEX); Serial.println(mpu.readData(MPU6050_PWR_MGMT_1_REGISTER)); Serial.println(mpu.readData(MPU6050_GYRO_CONFIG_REGISTER), HEX);
      Serial.println(mpu.readData(0x3F)); ${GIRAR}
      Serial.println(mpu.writeData(MPU6050_GYRO_CONFIG_REGISTER, 0x18)); mpu.update(); Serial.printf("%.1f\\n", mpu.getGyroZ());
      mpu.writeData(MPU6050_PWR_MGMT_1_REGISTER, 0x40); mpu.update(); Serial.printf("%.1f\\n", mpu.getGyroZ()); }\nvoid loop() {}`,
      { duracionUs: 300_000 });
    // ±2000 °/s en el chip, pero la librería sigue dividiendo por 65,5: como en el robot real.
    expect(texto).toBe(`68\r\n1\r\n8\r\n64\r\n0\r\n${(crudo(16.4) / 65.5).toFixed(1)}\n0.0\n`);
    expect(sim.avisos).toEqual(['Llama a begin() del MPU6050 antes de leerlo.']);
  });

  it('leer el MPU6050 sin begin() avisa y lee el chip dormido (ceros)', async () => {
    const { texto, sim } = await correrSketch(`${INICIO}void setup() { Serial.begin(115200); mpu.update(); Serial.printf("%.2f %.2f\\n", mpu.getAccZ(), mpu.getAngleX()); }\nvoid loop() {}`);
    expect(texto).toBe('0.00 0.00\n');
    expect(sim.avisos).toContain('Llama a begin() del MPU6050 antes de leerlo.');
  });
});
