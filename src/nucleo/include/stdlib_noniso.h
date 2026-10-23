// stdlib_noniso.h — conversiones de número a texto que el core del ESP32 agrega a la libc.
#pragma once

#ifdef __cplusplus
extern "C" {
#endif

char* itoa(int valor, char* destino, int base);
char* ltoa(long valor, char* destino, int base);
char* utoa(unsigned int valor, char* destino, int base);
char* ultoa(unsigned long valor, char* destino, int base);
char* dtostrf(double numero, signed char ancho, unsigned char decimales, char* destino);

#ifdef __cplusplus
}
#endif
