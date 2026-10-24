// Wire.h — buses I2C del ESP32 (Wire y Wire1). begin y setClock no hacen nada: el simulador no
// distingue los buses. Por I2C directo responden el multiplexor TCA9548A y los TCS34725, que el
// simulador tiene a nivel de registros; los demás sensores se simulan en sus librerías y aquí no
// responden (el simulador avisa).
#pragma once

#include <stddef.h>
#include <stdint.h>

class TwoWire {
public:
  bool begin() { return true; }
  bool begin(int sda, int scl, uint32_t frecuencia = 0) { (void)sda; (void)scl; (void)frecuencia; return true; }
  void setClock(uint32_t frecuencia) { (void)frecuencia; }
  void beginTransmission(uint8_t direccion);
  void beginTransmission(int direccion) { beginTransmission(static_cast<uint8_t>(direccion)); }
  size_t write(uint8_t dato);
  size_t write(const uint8_t* datos, size_t cuanto);
  uint8_t endTransmission(bool detener = true);
  // Una sola firma con enteros: acepta requestFrom(dir, n) y requestFrom(dir, n, true/false) con
  // cualquier tipo entero, sin ambigüedades entre sobrecargas.
  uint8_t requestFrom(int direccion, int cuanto, int detener = 1);
  int available();
  int read();
  int peek();

private:
  // Como I2C_BUFFER_LENGTH del ESP32.
  static const size_t BUFER = 128;
  uint8_t direccion = 0;
  uint8_t salida[BUFER];
  size_t enSalida = 0;
  uint8_t entrada[BUFER];
  size_t enEntrada = 0;
  size_t leidos = 0;
};

extern TwoWire Wire;
extern TwoWire Wire1;
