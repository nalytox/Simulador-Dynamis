#include "Adafruit_MPU6050.h"

#include <string.h>
#include "dynamis_mpu.h"

namespace {
const int16_t SIN_OFFSETS[6] = {0, 0, 0, 0, 0, 0};

void preparar(sensors_event_t* e, int32_t id, int32_t tipo, int32_t ahora) {
  memset(e, 0, sizeof(sensors_event_t));
  e->version = sizeof(sensors_event_t);
  e->sensor_id = id;
  e->type = tipo;
  e->timestamp = ahora;
}
}  // namespace

bool Adafruit_MPU6050::begin(uint8_t, TwoWire*, int32_t sensorID) {
  idSensor = sensorID;
  rangoAcel = MPU6050_RANGE_2_G;
  rangoGiro = MPU6050_RANGE_500_DEG;
  banda = MPU6050_BAND_260_HZ;
  return true;
}

bool Adafruit_MPU6050::getEvent(sensors_event_t* accel, sensors_event_t* gyro, sensors_event_t* temp) {
  const MpuCrudo c = dynLeerMpu(rangoAcel, rangoGiro, SIN_OFFSETS);
  const int32_t ahora = (int32_t)millis();
  const float lsbG = MPU_LSB_G[rangoAcel];
  const float lsbDps = MPU_LSB_DPS[rangoGiro];
  if (accel) {
    preparar(accel, idSensor, SENSOR_TYPE_ACCELEROMETER, ahora);
    accel->acceleration.x = c.ax / lsbG * SENSORS_GRAVITY_STANDARD;
    accel->acceleration.y = c.ay / lsbG * SENSORS_GRAVITY_STANDARD;
    accel->acceleration.z = c.az / lsbG * SENSORS_GRAVITY_STANDARD;
  }
  if (gyro) {
    preparar(gyro, idSensor + 1, SENSOR_TYPE_GYROSCOPE, ahora);
    gyro->gyro.x = c.gx / lsbDps * SENSORS_DPS_TO_RADS;
    gyro->gyro.y = c.gy / lsbDps * SENSORS_DPS_TO_RADS;
    gyro->gyro.z = c.gz / lsbDps * SENSORS_DPS_TO_RADS;
  }
  if (temp) {
    preparar(temp, idSensor + 2, SENSOR_TYPE_AMBIENT_TEMPERATURE, ahora);
    temp->temperature = c.temp / 340.0f + 36.53f;
  }
  return true;
}
