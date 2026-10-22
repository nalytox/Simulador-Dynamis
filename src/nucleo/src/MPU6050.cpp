#include "MPU6050.h"

#include "dynamis_host.h"

void MPU6050::initialize() {
  iniciado = true;
  rangoAcel = MPU6050_ACCEL_FS_2;
  rangoGiro = MPU6050_GYRO_FS_250;
}

MpuCrudo MPU6050::leer() {
  const MpuCrudo c = dynLeerMpu(rangoAcel, rangoGiro, offsets);
  if (iniciado) return c;
  // Sin initialize el chip sigue dormido y sus registros están en cero.
  dynAvisar("Llama a initialize() del MPU6050 antes de leerlo.");
  return MpuCrudo();
}

void MPU6050::getMotion6(int16_t* ax, int16_t* ay, int16_t* az, int16_t* gx, int16_t* gy, int16_t* gz) {
  const MpuCrudo c = leer();
  *ax = c.ax; *ay = c.ay; *az = c.az;
  *gx = c.gx; *gy = c.gy; *gz = c.gz;
}

void MPU6050::getAcceleration(int16_t* x, int16_t* y, int16_t* z) {
  const MpuCrudo c = leer();
  *x = c.ax; *y = c.ay; *z = c.az;
}

void MPU6050::getRotation(int16_t* x, int16_t* y, int16_t* z) {
  const MpuCrudo c = leer();
  *x = c.gx; *y = c.gy; *z = c.gz;
}

int16_t MPU6050::getRotationX() { return leer().gx; }
int16_t MPU6050::getRotationY() { return leer().gy; }
int16_t MPU6050::getRotationZ() { return leer().gz; }
