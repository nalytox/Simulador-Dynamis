// Wire.h — bus I2C del ESP32. Los sensores se simulan a nivel de librería: begin y setClock no
// hacen nada, y el acceso directo al bus avisa y responde como un bus sin dispositivos.
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
};

extern TwoWire Wire;
