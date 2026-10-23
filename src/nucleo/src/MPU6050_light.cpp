#include "MPU6050_light.h"

#include <math.h>
#include <string.h>
#include "dynamis_host.h"

namespace {
const uint8_t WHO_AM_I = 0x75;
/** Bit SLEEP de PWR_MGMT_1: el chip parte dormido y begin() lo despierta. */
const uint8_t DORMIDO = 0x40;
const float G = 9.80665f;
const float RAD_A_GRADOS = 180.0f / (float)M_PI;
// LSB por g y LSB por °/s de cada rango (0…3), como en la hoja de datos.
const float LSB_G[4] = {16384, 8192, 4096, 2048};
const float LSB_DPS[4] = {131, 65.5f, 32.8f, 16.4f};

float acotar(float v) { return v < -32768 ? -32768 : (v > 32767 ? 32767 : v); }

// El chip satura la medida en 16 bits.
int16_t cuantizar(float magnitud, float lsb) { return (int16_t)acotar(roundf(magnitud * lsb)); }

// Deja el ángulo en [−límite, +límite], como la librería.
float envolver(float angulo, float limite) {
  while (angulo > limite) angulo -= 2 * limite;
  while (angulo < -limite) angulo += 2 * limite;
  return angulo;
}
}  // namespace

MPU6050::MPU6050(TwoWire& w) {
  (void)w;
  memset(registros, 0, sizeof(registros));
  registros[MPU6050_PWR_MGMT_1_REGISTER] = DORMIDO;
  registros[WHO_AM_I] = MPU6050_ADDR;
  setFilterGyroCoef(DEFAULT_GYRO_COEFF);
  setGyroOffsets(0, 0, 0);
  setAccOffsets(0, 0, 0);
}

byte MPU6050::begin(int gyro_config_num, int acc_config_num) {
  byte estado = writeData(MPU6050_PWR_MGMT_1_REGISTER, 0x01);
  writeData(MPU6050_SMPLRT_DIV_REGISTER, 0x00);
  writeData(MPU6050_CONFIG_REGISTER, 0x00);
  setGyroConfig(gyro_config_num);
  setAccConfig(acc_config_num);

  update();
  anguloX = getAccAngleX();
  anguloY = getAccAngleY();
  antes = millis();
  return estado;
}

// Sin bus I2C de verdad: escribir y leer van directo a los registros del chip simulado.
byte MPU6050::writeData(byte reg, byte data) {
  if ((reg & 0x7F) != WHO_AM_I) registros[reg & 0x7F] = data;
  return 0;
}

byte MPU6050::readData(byte reg) {
  reg &= 0x7F;
  if (reg >= MPU6050_ACCEL_OUT_REGISTER && reg < MPU6050_ACCEL_OUT_REGISTER + 14) {
    int16_t crudo[7];
    leerChip(crudo);
    const int i = reg - MPU6050_ACCEL_OUT_REGISTER;
    const uint16_t palabra = (uint16_t)crudo[i / 2];
    return i % 2 == 0 ? palabra >> 8 : palabra & 0xFF;
  }
  return registros[reg];
}

byte MPU6050::setGyroConfig(int config_num) {
  if (config_num < 0 || config_num > 3) return 1;
  lsbPorGradoS = LSB_DPS[config_num];
  return writeData(MPU6050_GYRO_CONFIG_REGISTER, config_num << 3);
}

byte MPU6050::setAccConfig(int config_num) {
  if (config_num < 0 || config_num > 3) return 1;
  lsbPorG = LSB_G[config_num];
  return writeData(MPU6050_ACCEL_CONFIG_REGISTER, config_num << 3);
}

void MPU6050::setGyroOffsets(float x, float y, float z) {
  desvioGiro[0] = x;
  desvioGiro[1] = y;
  desvioGiro[2] = z;
}

void MPU6050::setAccOffsets(float x, float y, float z) {
  desvioAcel[0] = x;
  desvioAcel[1] = y;
  desvioAcel[2] = z;
}

void MPU6050::setFilterGyroCoef(float gyro_coeff) {
  if (gyro_coeff < 0 || gyro_coeff > 1) gyro_coeff = DEFAULT_GYRO_COEFF;
  coefGiro = gyro_coeff;
}

void MPU6050::setFilterAccCoef(float acc_coeff) { setFilterGyroCoef(1.0 - acc_coeff); }

void MPU6050::calcOffsets(bool is_calc_gyro, bool is_calc_acc) {
  if (is_calc_gyro) setGyroOffsets(0, 0, 0);
  if (is_calc_acc) setAccOffsets(0, 0, 0);
  float suma[6] = {0, 0, 0, 0, 0, 0};
  for (int i = 0; i < CALIB_OFFSET_NB_MES; i++) {
    fetchData();
    suma[0] += acel[0];
    suma[1] += acel[1];
    suma[2] += acel[2] - 1.0;
    suma[3] += giro[0];
    suma[4] += giro[1];
    suma[5] += giro[2];
    delay(1);
  }
  if (is_calc_acc) setAccOffsets(suma[0] / CALIB_OFFSET_NB_MES, suma[1] / CALIB_OFFSET_NB_MES, suma[2] / CALIB_OFFSET_NB_MES);
  if (is_calc_gyro) setGyroOffsets(suma[3] / CALIB_OFFSET_NB_MES, suma[4] / CALIB_OFFSET_NB_MES, suma[5] / CALIB_OFFSET_NB_MES);
}

void MPU6050::leerChip(int16_t crudo[7]) {
  float d[7];
  dyn_mpu_leer(d);
  if (registros[MPU6050_PWR_MGMT_1_REGISTER] & DORMIDO) {
    // Dormido, el chip no mide y sus registros de datos están en cero.
    dynAvisar("Llama a begin() del MPU6050 antes de leerlo.");
    memset(crudo, 0, 7 * sizeof(int16_t));
    return;
  }
  const float lsbG = LSB_G[(registros[MPU6050_ACCEL_CONFIG_REGISTER] >> 3) & 3];
  const float lsbDps = LSB_DPS[(registros[MPU6050_GYRO_CONFIG_REGISTER] >> 3) & 3];
  for (int i = 0; i < 3; i++) {
    crudo[i] = cuantizar(d[i] / G, lsbG);
    crudo[4 + i] = cuantizar(d[3 + i] * RAD_A_GRADOS, lsbDps);
  }
  crudo[3] = (int16_t)acotar(roundf((d[6] - 36.53f) * 340));
}

void MPU6050::fetchData() {
  int16_t crudo[7];
  leerChip(crudo);
  acel[0] = ((float)crudo[0]) / lsbPorG - desvioAcel[0];
  acel[1] = ((float)crudo[1]) / lsbPorG - desvioAcel[1];
  acel[2] = (!upsideDownMounting - upsideDownMounting) * ((float)crudo[2]) / lsbPorG - desvioAcel[2];
  temperatura = (crudo[3] + TEMP_LSB_OFFSET) / TEMP_LSB_2_DEGREE;
  giro[0] = ((float)crudo[4]) / lsbPorGradoS - desvioGiro[0];
  giro[1] = ((float)crudo[5]) / lsbPorGradoS - desvioGiro[1];
  giro[2] = ((float)crudo[6]) / lsbPorGradoS - desvioGiro[2];
}

// El filtro complementario de la librería: el giroscopio para los cambios rápidos y el
// acelerómetro para no derivar. El ángulo en z solo suma el giroscopio.
void MPU6050::update() {
  fetchData();

  float sgZ = acel[2] < 0 ? -1 : 1;
  anguloAcelX = atan2(acel[1], sgZ * sqrt(acel[2] * acel[2] + acel[0] * acel[0])) * RAD_2_DEG;
  anguloAcelY = -atan2(acel[0], sqrt(acel[2] * acel[2] + acel[1] * acel[1])) * RAD_2_DEG;

  unsigned long ahora = millis();
  float dt = (ahora - antes) * 1e-3;
  antes = ahora;

  anguloX = envolver(coefGiro * (anguloAcelX + envolver(anguloX + giro[0] * dt - anguloAcelX, 180)) + (1.0 - coefGiro) * anguloAcelX, 180);
  anguloY = envolver(coefGiro * (anguloAcelY + envolver(anguloY + sgZ * giro[1] * dt - anguloAcelY, 90)) + (1.0 - coefGiro) * anguloAcelY, 90);
  anguloZ += giro[2] * dt;
}
