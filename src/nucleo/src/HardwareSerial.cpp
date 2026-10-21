#include "Arduino.h"

HardwareSerial Serial;

void HardwareSerial::begin(unsigned long baudios, uint32_t, int8_t, int8_t, bool, unsigned long, uint8_t) {
  dyn_serial_begin(static_cast<uint32_t>(baudios));
}

// En el simulador nadie escribe por el Serial. Se le avisa al simulador igual, para que
// esperar datos consuma tiempo virtual en vez de congelar la página.
int HardwareSerial::available() { return dyn_serial_available(); }

int HardwareSerial::read() {
  dyn_serial_available();
  return -1;
}

int HardwareSerial::peek() {
  dyn_serial_available();
  return -1;
}

size_t HardwareSerial::write(uint8_t c) {
  dyn_serial_write(&c, 1);
  return 1;
}

size_t HardwareSerial::write(const uint8_t* buffer, size_t size) {
  if (size > 0) dyn_serial_write(buffer, size);
  return size;
}
