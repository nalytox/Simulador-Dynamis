// pgmspace.h — PROGMEM y funciones _P. En el ESP32 la flash se lee como memoria normal,
// así que todo esto es un alias de la versión común, igual que en el core real.
#pragma once

#include <stdint.h>
#include <stdio.h>
#include <string.h>

#define PROGMEM
#define PGM_P const char*
#define PGM_VOID_P const void*
#define PSTR(s) (s)

#define pgm_read_byte(addr) (*(const unsigned char*)(addr))
#define pgm_read_word(addr) (*(const unsigned short*)(addr))
#define pgm_read_dword(addr) (*(const unsigned long*)(addr))
#define pgm_read_float(addr) (*(const float*)(addr))
#define pgm_read_ptr(addr) (*(const void* const*)(addr))
#define pgm_read_byte_near(addr) pgm_read_byte(addr)
#define pgm_read_word_near(addr) pgm_read_word(addr)
#define pgm_read_dword_near(addr) pgm_read_dword(addr)
#define pgm_read_float_near(addr) pgm_read_float(addr)
#define pgm_read_ptr_near(addr) pgm_read_ptr(addr)

#define memcpy_P memcpy
#define memcmp_P memcmp
#define strcpy_P strcpy
#define strncpy_P strncpy
#define strcat_P strcat
#define strcmp_P strcmp
#define strncmp_P strncmp
#define strlen_P strlen
#define sprintf_P sprintf
#define snprintf_P snprintf
