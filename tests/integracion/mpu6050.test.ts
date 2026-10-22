import { describe, it, expect } from 'vitest';
import { correrSketch } from '../ayuda/correr-sketch';
import { pistaDe } from '../ayuda/pistas';

const GIRAR = 'pinMode(16, OUTPUT); pinMode(17, OUTPUT); pinMode(4, OUTPUT); pinMode(5, OUTPUT); digitalWrite(16, LOW); digitalWrite(17, HIGH); digitalWrite(4, HIGH); digitalWrite(5, LOW); analogWrite(18, 255); analogWrite(19, 255); delay(100);';

describe('MPU6050', { timeout: 120_000 }, () => {
  it('Adafruit: plano, rampa y temperatura, cuantizados como el chip; 0,4 ms por lectura más el millis() del timestamp', async () => {
    const ada = '#include <Adafruit_MPU6050.h>\nAdafruit_MPU6050 mpu;\nsensors_event_t a, g, t;\n';
    const plano = await correrSketch(`${ada}void setup() { Serial.begin(115200); Serial.println(mpu.begin()); unsigned long t0 = micros(); mpu.getEvent(&a, &g, &t); unsigned long t1 = micros();
      Serial.printf("%.2f %.2f %.2f %.2f %lu\\n", a.acceleration.x, a.acceleration.z, g.gyro.z, t.temperature, t1 - t0); }\nvoid loop() {}`);
    expect(plano.texto).toBe('1\r\n0.00 9.81 0.00 25.00 402\n');
    const alto = 300 * Math.tan(20 * Math.PI / 180);
    const pista = pistaDe({ columnas: 3, filas: 1, baldosas: [{ c: 0, r: 0, tipo: 'recta' }, { c: 1, r: 0, tipo: 'rampa' }, { c: 2, r: 0, tipo: 'recta', nivel: alto }] });
    const rampa = await correrSketch(`${ada}void setup() { Serial.begin(115200); mpu.begin(); mpu.getEvent(&a, &g, &t); Serial.printf("%.2f %.2f\\n", a.acceleration.x, a.acceleration.z); }\nvoid loop() {}`,
      { pista, pose: { x: 450, y: 150, yaw: 0 } });
    expect(rampa.texto).toBe('3.35 9.22\n');
  });

  it('Adafruit: giro dentro del rango por defecto y saturación con un rango menor', async () => {
    const { texto } = await correrSketch(`#include <Adafruit_MPU6050.h>\nAdafruit_MPU6050 mpu;\nsensors_event_t a, g, t;\nvoid setup() { Serial.begin(115200); mpu.begin(); ${GIRAR}
      mpu.getEvent(&a, &g, &t); Serial.printf("%.2f\\n", g.gyro.z); mpu.setGyroRange(MPU6050_RANGE_250_DEG); mpu.getEvent(&a, &g, &t); Serial.printf("%.2f %d\\n", g.gyro.z, mpu.getGyroRange()); }\nvoid loop() {}`,
      { duracionUs: 300_000 });
    expect(texto).toBe('8.57\n4.37 0\n');
  });

  it('i2cdevlib: valores crudos según el rango, saturación y offsets', async () => {
    const { texto } = await correrSketch(`#include <Wire.h>\n#include "I2Cdev.h"\n#include "MPU6050.h"\nMPU6050 mpu;\nint16_t ax, ay, az, gx, gy, gz;\nvoid setup() { Serial.begin(115200); Wire.begin(); mpu.initialize(); Serial.println(mpu.testConnection());
      mpu.getMotion6(&ax, &ay, &az, &gx, &gy, &gz); Serial.printf("%d %d %d %d\\n", ax, ay, az, gz);
      mpu.setZAccelOffset(1024); mpu.getAcceleration(&ax, &ay, &az); Serial.println(az); ${GIRAR}
      Serial.println(mpu.getRotationZ()); mpu.setFullScaleGyroRange(MPU6050_GYRO_FS_1000); Serial.println(mpu.getRotationZ()); }\nvoid loop() {}`,
      { duracionUs: 300_000 });
    expect(texto).toBe(`1\r\n0 0 16384 0\n24576\r\n32767\r\n${Math.round(1200 / 140 * 180 / Math.PI * 32.8)}\r\n`);
  });
});
