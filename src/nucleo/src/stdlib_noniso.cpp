// Copia el comportamiento de cores/esp32/stdlib_noniso.c del core 3.x.
#include "Arduino.h"

static const char DIGITOS[] = "0123456789abcdef";

static void invertir(char* desde, char* hasta) {
  while (desde < --hasta) {
    char c = *desde;
    *desde++ = *hasta;
    *hasta = c;
  }
}

static char* sinSignoATexto(unsigned long valor, char* destino, int base) {
  if (base < 2 || base > 16) {
    *destino = 0;
    return destino;
  }
  char* fin = destino;
  do {
    *fin++ = DIGITOS[valor % base];
    valor /= base;
  } while (valor);
  invertir(destino, fin);
  *fin = 0;
  return destino;
}

extern "C" {

char* ltoa(long valor, char* destino, int base) {
  if (base < 2 || base > 16) {
    *destino = 0;
    return destino;
  }
  char* fin = destino;
  unsigned long resto = valor < 0 ? 0UL - static_cast<unsigned long>(valor) : static_cast<unsigned long>(valor);
  do {
    *fin++ = DIGITOS[resto % base];
    resto /= base;
  } while (resto);
  if (valor < 0) *fin++ = '-';
  invertir(destino, fin);
  *fin = 0;
  return destino;
}

char* itoa(int valor, char* destino, int base) { return ltoa(valor, destino, base); }
char* ultoa(unsigned long valor, char* destino, int base) { return sinSignoATexto(valor, destino, base); }
char* utoa(unsigned int valor, char* destino, int base) { return sinSignoATexto(valor, destino, base); }

char* dtostrf(double numero, signed char ancho, unsigned char decimales, char* destino) {
  if (isnan(numero)) {
    strcpy(destino, "nan");
    return destino;
  }
  if (isinf(numero)) {
    strcpy(destino, "inf");
    return destino;
  }
  char* fin = destino;
  int relleno = ancho;
  if (decimales > 0) relleno -= decimales + 1;
  bool negativo = numero < 0.0;
  if (negativo) {
    relleno--;
    numero = -numero;
  }
  double redondeo = 2.0;
  for (uint8_t i = 0; i < decimales; ++i) redondeo *= 10.0;
  numero += 1.0 / redondeo;
  double potencia = 1.0;
  int cifras = 1;
  while (numero >= 10.0 * potencia) {
    potencia *= 10.0;
    cifras++;
  }
  numero /= potencia;
  relleno -= cifras;
  while (relleno-- > 0) *fin++ = ' ';
  if (negativo) *fin++ = '-';
  cifras += decimales;
  while (cifras-- > 0) {
    int cifra = static_cast<int>(numero);
    if (cifra > 9) cifra = 9;
    *fin++ = static_cast<char>('0' | cifra);
    if (cifras == decimales && decimales > 0) *fin++ = '.';
    numero -= cifra;
    numero *= 10.0;
  }
  *fin = 0;
  return destino;
}

}  // extern "C"
