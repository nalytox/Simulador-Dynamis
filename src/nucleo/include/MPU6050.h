// MPU6050.h — librería MPU6050 de i2cdevlib (Jeff Rowberg), compatible con su API pública y escrita desde cero.
// Entrega los registros crudos del chip, cuantizados según los rangos elegidos.
#pragma once

#include "I2Cdev.h"

#define MPU6050_ADDRESS_AD0_LOW 0x68
#define MPU6050_ADDRESS_AD0_HIGH 0x69
#define MPU6050_DEFAULT_ADDRESS MPU6050_ADDRESS_AD0_LOW

#define MPU6050_ACCEL_FS_2 0x00
#define MPU6050_ACCEL_FS_4 0x01
#define MPU6050_ACCEL_FS_8 0x02
#define MPU6050_ACCEL_FS_16 0x03

#define MPU6050_GYRO_FS_250 0x00
#define MPU6050_GYRO_FS_500 0x01
#define MPU6050_GYRO_FS_1000 0x02
#define MPU6050_GYRO_FS_2000 0x03

class MPU6050 {
public:
  MPU6050(uint8_t address = MPU6050_DEFAULT_ADDRESS) : direccion(address) {}

  void initialize();
  bool testConnection() { return true; }

  void setFullScaleAccelRange(uint8_t rango) { rangoAcel = rango & 3; }
  void setFullScaleGyroRange(uint8_t rango) { rangoGiro = rango & 3; }

  void getMotion6(int16_t* ax, int16_t* ay, int16_t* az, int16_t* gx, int16_t* gy, int16_t* gz);
  void getAcceleration(int16_t* x, int16_t* y, int16_t* z);
  void getRotation(int16_t* x, int16_t* y, int16_t* z);
  int16_t getRotationX();
  int16_t getRotationY();
  int16_t getRotationZ();

  // Offsets del acelerómetro en LSB de ±16 g y del giroscopio en LSB de ±1000 °/s, como los registros del chip.
  void setXAccelOffset(int16_t offset) { offsets[0] = offset; }
  void setYAccelOffset(int16_t offset) { offsets[1] = offset; }
  void setZAccelOffset(int16_t offset) { offsets[2] = offset; }
  void setXGyroOffset(int16_t offset) { offsets[3] = offset; }
  void setYGyroOffset(int16_t offset) { offsets[4] = offset; }
  void setZGyroOffset(int16_t offset) { offsets[5] = offset; }

private:
  uint8_t direccion;
  uint8_t rangoAcel = MPU6050_ACCEL_FS_2;
  uint8_t rangoGiro = MPU6050_GYRO_FS_250;
  int16_t offsets[6] = {0, 0, 0, 0, 0, 0};
};
