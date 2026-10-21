// map y random con la semántica del ESP32 Arduino core 3.x.
#include "Arduino.h"

static bool semillaPropia = false;

long map(long x, long in_min, long in_max, long out_min, long out_max) {
  const long recorrido = in_max - in_min;
  if (recorrido == 0) return -1;
  return (x - in_min) * (out_max - out_min) / recorrido + out_min;
}

void randomSeed(unsigned long seed) {
  if (seed != 0) {
    srand(seed);
    semillaPropia = true;
  }
}

long random(long howbig) {
  if (howbig <= 0) return 0;
  const uint32_t valor = semillaPropia ? static_cast<uint32_t>(rand()) : dyn_azar_u32();
  return static_cast<long>(valor % static_cast<uint32_t>(howbig));
}

long random(long howsmall, long howbig) {
  if (howsmall >= howbig) return howsmall;
  return howsmall + random(howbig - howsmall);
}
