#include "Arduino.h"
#include "Wire.h"

TwoWire Wire;

static void avisarBusDirecto() {
  dynAvisar("El simulador no tiene un bus I2C directo: usa las librerías de los sensores en vez de Wire.beginTransmission o Wire.requestFrom.");
}

void TwoWire::beginTransmission(uint8_t) { avisarBusDirecto(); }

size_t TwoWire::write(uint8_t) {
  avisarBusDirecto();
  return 1;
}

size_t TwoWire::write(const uint8_t*, size_t cuanto) {
  avisarBusDirecto();
  return cuanto;
}

// 2: nadie respondió a la dirección (NACK), como en un bus sin dispositivos.
uint8_t TwoWire::endTransmission(bool) {
  avisarBusDirecto();
  return 2;
}

uint8_t TwoWire::requestFrom(uint8_t, uint8_t) {
  avisarBusDirecto();
  return 0;
}

int TwoWire::read() {
  avisarBusDirecto();
  return -1;
}
