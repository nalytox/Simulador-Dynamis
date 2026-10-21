// HardwareSerial.h — el puerto Serial del ESP32 (UART0), conectado a "Mensajes del robot".
#pragma once

#include "Print.h"

#define SERIAL_8N1 0x800001c

class HardwareSerial : public Print {
public:
  void begin(unsigned long baudios, uint32_t config = SERIAL_8N1, int8_t rxPin = -1, int8_t txPin = -1,
             bool invertir = false, unsigned long timeout = 20000UL, uint8_t umbralFifo = 112);
  void end() {}
  int available() { return 0; }
  int read() { return -1; }
  int peek() { return -1; }
  void flush() {}
  void setTimeout(unsigned long) {}
  size_t write(uint8_t c) override;
  size_t write(const uint8_t* buffer, size_t size) override;
  using Print::write;
  operator bool() const { return true; }
};

extern HardwareSerial Serial;
