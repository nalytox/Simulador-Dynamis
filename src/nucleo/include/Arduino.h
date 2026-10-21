// Arduino.h — API del ESP32 Arduino core 3.x, simulada para Dynamis.
#pragma once

#include <stdint.h>
#include <stdbool.h>
#include <stdarg.h>
#include <stddef.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <inttypes.h>
#include <math.h>
#include "dynamis_host.h"
#include "pgmspace.h"
#include "pins_arduino.h"
#include "stdlib_noniso.h"

#define HIGH 0x1
#define LOW 0x0

#define INPUT 0x01
#define OUTPUT 0x03
#define PULLUP 0x04
#define INPUT_PULLUP 0x05
#define PULLDOWN 0x08
#define INPUT_PULLDOWN 0x09

#define DEC 10
#define HEX 16
#define OCT 8
#define BIN 2

#define PI 3.1415926535897932384626433832795
#define HALF_PI 1.5707963267948966192313216916398
#define TWO_PI 6.283185307179586476925286766559
#define DEG_TO_RAD 0.017453292519943295769236907684886
#define RAD_TO_DEG 57.295779513082320876798154814105

#define radians(deg) ((deg) * DEG_TO_RAD)
#define degrees(rad) ((rad) * RAD_TO_DEG)
#define sq(x) ((x) * (x))
#define constrain(amt, low, high) ((amt) < (low) ? (low) : ((amt) > (high) ? (high) : (amt)))

#define lowByte(w) ((uint8_t)((w) & 0xff))
#define highByte(w) ((uint8_t)((w) >> 8))
#define bitRead(value, bit) (((value) >> (bit)) & 0x01)
#define bitSet(value, bit) ((value) |= (1UL << (bit)))
#define bitClear(value, bit) ((value) &= ~(1UL << (bit)))
#define bitWrite(value, bit, bitvalue) ((bitvalue) ? bitSet(value, bit) : bitClear(value, bit))
#define bit(b) (1UL << (b))

typedef uint8_t byte;
typedef bool boolean;
typedef uint16_t word;

#ifdef __cplusplus
extern "C" {
#endif

static inline unsigned long millis(void) { return dyn_millis(); }
static inline unsigned long micros(void) { return dyn_micros(); }
static inline void delay(uint32_t ms) { dyn_delay(ms); }
static inline void delayMicroseconds(uint32_t us) { dyn_delay_us(us); }
static inline void yield(void) { dyn_yield(); }

static inline void pinMode(uint8_t pin, uint8_t modo) { dyn_pin_mode(pin, modo); }
static inline void digitalWrite(uint8_t pin, uint8_t valor) { dyn_digital_write(pin, valor); }
static inline int digitalRead(uint8_t pin) { return dyn_digital_read(pin); }
static inline uint16_t analogRead(uint8_t pin) { return dyn_analog_read(pin); }
static inline void analogReadResolution(uint8_t bits) { dyn_analog_read_resolution(bits); }
static inline void analogWrite(uint8_t pin, int valor) { dyn_analog_write(pin, valor); }
// La frecuencia del PWM no cambia lo que ve el simulador: solo se acepta la llamada.
static inline void analogWriteFrequency(uint8_t pin, uint32_t freq) { (void)pin; (void)freq; }
static inline bool ledcAttach(uint8_t pin, uint32_t freq, uint8_t bits) { return dyn_ledc_attach(pin, freq, bits); }
static inline bool ledcWrite(uint8_t pin, uint32_t duty) { return dyn_ledc_write(pin, duty); }
static inline bool ledcDetach(uint8_t pin) { return dyn_ledc_detach(pin); }

#ifdef __cplusplus
}

#include <algorithm>
#include <cmath>
#include <cstdlib>

// Igual que el core 3.x del ESP32: min(int, long) no compila, como en el robot real.
using std::abs;
using std::max;
using std::min;

inline void analogWriteResolution(uint8_t pin, uint8_t bits) { dyn_analog_write_resolution(pin, bits); }
inline void analogWriteResolution(uint8_t bits) { dyn_analog_write_resolution(255, bits); }

long map(long x, long in_min, long in_max, long out_min, long out_max);
long random(long howbig);
long random(long howsmall, long howbig);
void randomSeed(unsigned long seed);

#include "Print.h"
#include "HardwareSerial.h"
#endif
