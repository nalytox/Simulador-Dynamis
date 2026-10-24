// MPU6050_light.h — librería MPU6050_light de rfetick, compatible con su API pública y escrita desde cero.
// El chip simulado tiene sus registros: begin lo despierta, setGyroConfig y setAccConfig eligen los
// rangos, y cada lectura (update, fetchData) cuantiza como el chip y tarda lo que tarda el bus.
#pragma once

#include "Arduino.h"
#include "Wire.h"

#define MPU6050_ADDR                  0x68
#define MPU6050_SMPLRT_DIV_REGISTER   0x19
#define MPU6050_CONFIG_REGISTER       0x1a
#define MPU6050_GYRO_CONFIG_REGISTER  0x1b
#define MPU6050_ACCEL_CONFIG_REGISTER 0x1c
#define MPU6050_PWR_MGMT_1_REGISTER   0x6b

#define MPU6050_GYRO_OUT_REGISTER     0x43
#define MPU6050_ACCEL_OUT_REGISTER    0x3B

#define RAD_2_DEG             57.29578
#define CALIB_OFFSET_NB_MES   500
#define TEMP_LSB_2_DEGREE     340.0
#define TEMP_LSB_OFFSET       12412.0

#define DEFAULT_GYRO_COEFF    0.98

class MPU6050 {
public:
  MPU6050(TwoWire& w);
  /** 0 si el chip respondió. Giroscopio: 0…3 = ±250, ±500, ±1000, ±2000 °/s; acelerómetro: 0…3 = ±2, ±4, ±8, ±16 g. */
  byte begin(int gyro_config_num = 1, int acc_config_num = 0);

  byte writeData(byte reg, byte data);
  byte readData(byte reg);

  void calcOffsets(bool is_calc_gyro = true, bool is_calc_acc = true);
  void calcGyroOffsets() { calcOffsets(true, false); }
  void calcAccOffsets() { calcOffsets(false, true); }

  void setAddress(uint8_t addr) { direccion = addr; }
  uint8_t getAddress() { return direccion; }

  byte setGyroConfig(int config_num);
  byte setAccConfig(int config_num);

  void setGyroOffsets(float x, float y, float z);
  void setAccOffsets(float x, float y, float z);

  void setFilterGyroCoef(float gyro_coeff);
  void setFilterAccCoef(float acc_coeff);

  float getGyroXoffset() { return desvioGiro[0]; }
  float getGyroYoffset() { return desvioGiro[1]; }
  float getGyroZoffset() { return desvioGiro[2]; }

  float getAccXoffset() { return desvioAcel[0]; }
  float getAccYoffset() { return desvioAcel[1]; }
  float getAccZoffset() { return desvioAcel[2]; }

  float getFilterGyroCoef() { return coefGiro; }
  float getFilterAccCoef() { return 1.0 - coefGiro; }

  float getTemp() { return temperatura; }

  float getAccX() { return acel[0]; }
  float getAccY() { return acel[1]; }
  float getAccZ() { return acel[2]; }

  float getGyroX() { return giro[0]; }
  float getGyroY() { return giro[1]; }
  float getGyroZ() { return giro[2]; }

  float getAccAngleX() { return anguloAcelX; }
  float getAccAngleY() { return anguloAcelY; }

  float getAngleX() { return anguloX; }
  float getAngleY() { return anguloY; }
  float getAngleZ() { return anguloZ; }

  void fetchData();
  void update();

  bool upsideDownMounting = false;

private:
  uint8_t direccion = MPU6050_ADDR;
  /** Los registros de configuración del chip simulado (0x00…0x7F). */
  uint8_t registros[128];
  // La librería real los deja sin valor hasta begin(); aquí valen lo del chip recién encendido
  // (±250 °/s y ±2 g) para que leer sin begin() no divida por cero.
  float lsbPorGradoS = 131;
  float lsbPorG = 16384;
  float desvioGiro[3];
  float desvioAcel[3];
  float temperatura = 0;
  float acel[3] = {0, 0, 0};
  float giro[3] = {0, 0, 0};
  float anguloAcelX = 0, anguloAcelY = 0;
  float anguloX = 0, anguloY = 0, anguloZ = 0;
  unsigned long antes = 0;
  float coefGiro;

  /** Una lectura de los 14 bytes de datos: ax, ay, az, temp, gx, gy, gz, como los registros 0x3B…0x48. */
  void leerChip(int16_t crudo[7]);
};
