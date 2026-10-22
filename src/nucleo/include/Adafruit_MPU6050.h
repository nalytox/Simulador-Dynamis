// Adafruit_MPU6050.h — librería Adafruit MPU6050, compatible con su API pública y escrita desde cero.
// Cada getEvent es una lectura del chip: cuantiza según los rangos elegidos y tarda lo que tarda el bus.
#pragma once

#include <Arduino.h>
#include <Wire.h>
#include <Adafruit_Sensor.h>

#define MPU6050_I2CADDR_DEFAULT 0x68

typedef enum { MPU6050_RANGE_2_G = 0, MPU6050_RANGE_4_G, MPU6050_RANGE_8_G, MPU6050_RANGE_16_G } mpu6050_accel_range_t;
typedef enum { MPU6050_RANGE_250_DEG = 0, MPU6050_RANGE_500_DEG, MPU6050_RANGE_1000_DEG, MPU6050_RANGE_2000_DEG } mpu6050_gyro_range_t;
typedef enum {
  MPU6050_BAND_260_HZ = 0, MPU6050_BAND_184_HZ, MPU6050_BAND_94_HZ, MPU6050_BAND_44_HZ,
  MPU6050_BAND_21_HZ, MPU6050_BAND_10_HZ, MPU6050_BAND_5_HZ,
} mpu6050_bandwidth_t;

class Adafruit_MPU6050 {
public:
  bool begin(uint8_t i2c_addr = MPU6050_I2CADDR_DEFAULT, TwoWire* wire = &Wire, int32_t sensorID = 0);

  void setAccelerometerRange(mpu6050_accel_range_t rango) { rangoAcel = rango; }
  mpu6050_accel_range_t getAccelerometerRange() { return rangoAcel; }
  void setGyroRange(mpu6050_gyro_range_t rango) { rangoGiro = rango; }
  mpu6050_gyro_range_t getGyroRange() { return rangoGiro; }
  void setFilterBandwidth(mpu6050_bandwidth_t banda) { this->banda = banda; }
  mpu6050_bandwidth_t getFilterBandwidth() { return banda; }

  bool getEvent(sensors_event_t* accel, sensors_event_t* gyro, sensors_event_t* temp);

private:
  int32_t idSensor = 0;
  mpu6050_accel_range_t rangoAcel = MPU6050_RANGE_2_G;
  mpu6050_gyro_range_t rangoGiro = MPU6050_RANGE_250_DEG;
  mpu6050_bandwidth_t banda = MPU6050_BAND_260_HZ;
};
