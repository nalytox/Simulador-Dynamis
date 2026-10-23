#include "dynamis_mpu.h"

#include <math.h>
#include "dynamis_host.h"

const float MPU_LSB_G[4] = {16384, 8192, 4096, 2048};
const float MPU_LSB_DPS[4] = {131, 65.5f, 32.8f, 16.4f};

namespace {
const float G = 9.80665f;
const float RAD_A_GRADOS = 180.0f / (float)M_PI;

float acotar(float v) { return v < -32768 ? -32768 : (v > 32767 ? 32767 : v); }

// El chip satura la medida y después suma el offset; el registro final también es de 16 bits.
int16_t cuantizar(float magnitud, float lsb, int16_t offset, float lsbOffset) {
  return (int16_t)acotar(acotar(roundf(magnitud * lsb)) + roundf(offset * lsb / lsbOffset));
}
}  // namespace

MpuCrudo dynLeerMpu(uint8_t rangoAcel, uint8_t rangoGiro, const int16_t offsets[6]) {
  float d[7];
  dyn_mpu_leer(d);
  const float lsbG = MPU_LSB_G[rangoAcel & 3];
  const float lsbDps = MPU_LSB_DPS[rangoGiro & 3];
  MpuCrudo c;
  c.ax = cuantizar(d[0] / G, lsbG, offsets[0], 2048);
  c.ay = cuantizar(d[1] / G, lsbG, offsets[1], 2048);
  c.az = cuantizar(d[2] / G, lsbG, offsets[2], 2048);
  c.gx = cuantizar(d[3] * RAD_A_GRADOS, lsbDps, offsets[3], 32.8f);
  c.gy = cuantizar(d[4] * RAD_A_GRADOS, lsbDps, offsets[4], 32.8f);
  c.gz = cuantizar(d[5] * RAD_A_GRADOS, lsbDps, offsets[5], 32.8f);
  c.temp = (int16_t)acotar(roundf((d[6] - 36.53f) * 340));
  return c;
}
