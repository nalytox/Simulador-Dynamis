// dynamis_mpu.h — MPU6050 simulado, común a Adafruit_MPU6050 e i2cdevlib.
// Lee las magnitudes físicas del modelo y las cuantiza como el chip según el rango elegido.
#pragma once

#include <stdint.h>

struct MpuCrudo { int16_t ax, ay, az, gx, gy, gz, temp; };

// LSB por g y LSB por °/s de cada rango (0…3), como en la hoja de datos.
extern const float MPU_LSB_G[4];
extern const float MPU_LSB_DPS[4];

// offsets: x, y, z del acelerómetro (en LSB de ±16 g) y del giroscopio (en LSB de ±1000 °/s).
MpuCrudo dynLeerMpu(uint8_t rangoAcel, uint8_t rangoGiro, const int16_t offsets[6]);
