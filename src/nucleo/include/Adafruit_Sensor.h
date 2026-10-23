// Adafruit_Sensor.h — tipos del "Unified Sensor" de Adafruit que usan sus librerías de sensores.
#pragma once

#include <stdint.h>

#define SENSORS_GRAVITY_STANDARD (9.80665F)
#define SENSORS_DPS_TO_RADS (0.017453293F)

typedef enum {
  SENSOR_TYPE_ACCELEROMETER = 1,
  SENSOR_TYPE_GYROSCOPE = 4,
  SENSOR_TYPE_AMBIENT_TEMPERATURE = 13,
} sensors_type_t;

typedef struct {
  union {
    float v[3];
    struct { float x, y, z; };
    struct { float roll, pitch, heading; };
  };
  int8_t status;
  uint8_t reserved[3];
} sensors_vec_t;

typedef struct {
  int32_t version;
  int32_t sensor_id;
  int32_t type;
  int32_t reserved0;
  int32_t timestamp;
  union {
    float data[4];
    sensors_vec_t acceleration;
    sensors_vec_t gyro;
    float temperature;
  };
} sensors_event_t;
