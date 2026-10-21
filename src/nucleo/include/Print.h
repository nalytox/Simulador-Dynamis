// Print.h — base de Serial con print/println/printf como en Arduino.
#pragma once

#include <stdint.h>
#include <stddef.h>
#include <string.h>
#include "pgmspace.h"

// F("texto"): en el ESP32 el texto ya se lee desde la flash, así que es el mismo texto.
class __FlashStringHelper;
#define FPSTR(pstr_pointer) (reinterpret_cast<const __FlashStringHelper*>(pstr_pointer))
#define F(string_literal) (FPSTR(PSTR(string_literal)))

#ifndef DEC
#define DEC 10
#define HEX 16
#define OCT 8
#define BIN 2
#endif

class Print {
public:
  virtual ~Print() {}
  virtual size_t write(uint8_t c) = 0;
  virtual size_t write(const uint8_t* buffer, size_t size);
  size_t write(const char* str) { return str ? write(reinterpret_cast<const uint8_t*>(str), strlen(str)) : 0; }
  size_t write(const char* buffer, size_t size) { return write(reinterpret_cast<const uint8_t*>(buffer), size); }

  size_t print(const __FlashStringHelper* texto) { return print(reinterpret_cast<const char*>(texto)); }
  size_t print(const char texto[]);
  size_t print(char c);
  size_t print(unsigned char n, int base = DEC);
  size_t print(int n, int base = DEC);
  size_t print(unsigned int n, int base = DEC);
  size_t print(long n, int base = DEC);
  size_t print(unsigned long n, int base = DEC);
  size_t print(long long n, int base = DEC);
  size_t print(unsigned long long n, int base = DEC);
  size_t print(double n, int digitos = 2);

  size_t println(const __FlashStringHelper* texto) { return println(reinterpret_cast<const char*>(texto)); }
  size_t println(const char texto[]);
  size_t println(char c);
  size_t println(unsigned char n, int base = DEC);
  size_t println(int n, int base = DEC);
  size_t println(unsigned int n, int base = DEC);
  size_t println(long n, int base = DEC);
  size_t println(unsigned long n, int base = DEC);
  size_t println(long long n, int base = DEC);
  size_t println(unsigned long long n, int base = DEC);
  size_t println(double n, int digitos = 2);
  size_t println(void);

  size_t printf(const char* formato, ...) __attribute__((format(printf, 2, 3)));

private:
  size_t imprimirNumero(unsigned long long n, uint8_t base);
  size_t imprimirConSigno(long long n, int base, unsigned long long comoSinSigno);
  size_t imprimirDecimal(double numero, uint8_t digitos);
};
