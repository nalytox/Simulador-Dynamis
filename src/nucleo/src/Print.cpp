// Print.cpp — formato de números como el Print de Arduino.
#include "Arduino.h"
#include <stdarg.h>
#include <stdio.h>

size_t Print::write(const uint8_t* buffer, size_t size) {
  size_t n = 0;
  while (size--) n += write(*buffer++);
  return n;
}

size_t Print::print(const char texto[]) { return write(texto); }
size_t Print::print(char c) { return write(static_cast<uint8_t>(c)); }
size_t Print::print(unsigned char n, int base) { return print(static_cast<unsigned long long>(n), base); }
size_t Print::print(int n, int base) { return imprimirConSigno(n, base, static_cast<unsigned int>(n)); }
size_t Print::print(unsigned int n, int base) { return print(static_cast<unsigned long long>(n), base); }
size_t Print::print(long n, int base) { return imprimirConSigno(n, base, static_cast<unsigned long>(n)); }
size_t Print::print(unsigned long n, int base) { return print(static_cast<unsigned long long>(n), base); }
size_t Print::print(long long n, int base) { return imprimirConSigno(n, base, static_cast<unsigned long long>(n)); }
size_t Print::print(unsigned long long n, int base) {
  if (base == 0) return write(static_cast<uint8_t>(n));
  return imprimirNumero(n, static_cast<uint8_t>(base));
}
size_t Print::print(double n, int digitos) { return imprimirDecimal(n, static_cast<uint8_t>(digitos)); }

size_t Print::println(void) { return write("\r\n"); }
size_t Print::println(const char texto[]) { return print(texto) + println(); }
size_t Print::println(char c) { return print(c) + println(); }
size_t Print::println(unsigned char n, int base) { return print(n, base) + println(); }
size_t Print::println(int n, int base) { return print(n, base) + println(); }
size_t Print::println(unsigned int n, int base) { return print(n, base) + println(); }
size_t Print::println(long n, int base) { return print(n, base) + println(); }
size_t Print::println(unsigned long n, int base) { return print(n, base) + println(); }
size_t Print::println(long long n, int base) { return print(n, base) + println(); }
size_t Print::println(unsigned long long n, int base) { return print(n, base) + println(); }
size_t Print::println(double n, int digitos) { return print(n, digitos) + println(); }

size_t Print::printf(const char* formato, ...) {
  char local[64];
  va_list args;
  va_start(args, formato);
  int largo = vsnprintf(local, sizeof(local), formato, args);
  va_end(args);
  if (largo < 0) return 0;
  if (static_cast<size_t>(largo) < sizeof(local)) return write(reinterpret_cast<const uint8_t*>(local), largo);
  char* grande = static_cast<char*>(malloc(largo + 1));
  if (!grande) return 0;
  va_start(args, formato);
  vsnprintf(grande, largo + 1, formato, args);
  va_end(args);
  size_t n = write(reinterpret_cast<const uint8_t*>(grande), largo);
  free(grande);
  return n;
}

size_t Print::imprimirConSigno(long long n, int base, unsigned long long comoSinSigno) {
  if (base == 0) return write(static_cast<uint8_t>(n));
  if (base == 10 && n < 0) return print('-') + imprimirNumero(static_cast<unsigned long long>(-n), 10);
  return imprimirNumero(base == 10 ? static_cast<unsigned long long>(n) : comoSinSigno, static_cast<uint8_t>(base));
}

size_t Print::imprimirNumero(unsigned long long n, uint8_t base) {
  char texto[8 * sizeof(unsigned long long) + 1];
  char* p = &texto[sizeof(texto) - 1];
  *p = '\0';
  if (base < 2) base = 10;
  do {
    const unsigned digito = static_cast<unsigned>(n % base);
    n /= base;
    *--p = static_cast<char>(digito < 10 ? '0' + digito : 'A' + digito - 10);
  } while (n);
  return write(p);
}

size_t Print::imprimirDecimal(double numero, uint8_t digitos) {
  if (isnan(numero)) return print("nan");
  if (isinf(numero)) return print("inf");
  if (numero > 4294967040.0 || numero < -4294967040.0) return print("ovf");
  size_t n = 0;
  if (numero < 0.0) {
    n += print('-');
    numero = -numero;
  }
  double redondeo = 0.5;
  for (uint8_t i = 0; i < digitos; ++i) redondeo /= 10.0;
  numero += redondeo;
  const unsigned long parteEntera = static_cast<unsigned long>(numero);
  double resto = numero - static_cast<double>(parteEntera);
  n += print(parteEntera);
  if (digitos > 0) n += print('.');
  while (digitos-- > 0) {
    resto *= 10.0;
    const unsigned int digito = static_cast<unsigned int>(resto);
    n += print(digito);
    resto -= digito;
  }
  return n;
}
