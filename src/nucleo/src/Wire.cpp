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

uint8_t TwoWire::requestFrom(int, int, int) {
  avisarBusDirecto();
  return 0;
}

// Fuera de línea y con aviso: así `while (Wire.available() < 14) {}` gasta tiempo virtual en vez de
// quedar como un ciclo vacío que el compilador elimina.
int TwoWire::available() {
  avisarBusDirecto();
  return 0;
}

int TwoWire::read() {
  avisarBusDirecto();
  return -1;
}

int TwoWire::peek() {
  avisarBusDirecto();
  return -1;
}
