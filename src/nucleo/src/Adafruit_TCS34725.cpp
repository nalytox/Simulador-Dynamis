#include "Adafruit_TCS34725.h"

#include "dynamis_host.h"

namespace {
const uint32_t FACTOR_GANANCIA[4] = {1, 4, 16, 60};
}  // namespace

bool Adafruit_TCS34725::begin(uint8_t, TwoWire*) {
  // Encendido (3 ms) y una integración completa, como enable() de la librería.
  delay(3);
  delay(esperaMs());
  return true;
}

void Adafruit_TCS34725::getRawData(uint16_t* r, uint16_t* g, uint16_t* b, uint16_t* c) {
  uint16_t rgbc[4];
  dyn_tcs_leer(ciclos() * 2400, FACTOR_GANANCIA[ganancia & 3], !interrupcion, rgbc);
  const uint32_t maximo = ciclos() > 63 ? 65535 : 1024 * ciclos();
  *r = rgbc[0] > maximo ? maximo : rgbc[0];
  *g = rgbc[1] > maximo ? maximo : rgbc[1];
  *b = rgbc[2] > maximo ? maximo : rgbc[2];
  *c = rgbc[3] > maximo ? maximo : rgbc[3];
  delay(esperaMs());
}

void Adafruit_TCS34725::getRGB(float* r, float* g, float* b) {
  uint16_t rojo, verde, azul, claro;
  getRawData(&rojo, &verde, &azul, &claro);
  if (claro == 0) {
    *r = *g = *b = 0;
    return;
  }
  *r = (float)rojo / claro * 255;
  *g = (float)verde / claro * 255;
  *b = (float)azul / claro * 255;
}

uint16_t Adafruit_TCS34725::calculateColorTemperature_dn40(uint16_t r, uint16_t g, uint16_t b, uint16_t c) {
  if (c == 0) return 0;
  uint16_t saturacion = ciclos() > 63 ? 65535 : 1024 * ciclos();
  if (ciclos() <= 63) saturacion -= saturacion / 4;
  if (c >= saturacion) return 0;
  const uint16_t ir = (r + g + b > c) ? (r + g + b - c) / 2 : 0;
  const uint16_t r2 = r - ir;
  const uint16_t b2 = b - ir;
  if (r2 == 0) return 0;
  return (uint16_t)((3810 * (uint32_t)b2) / (uint32_t)r2 + 1391);
}

uint16_t Adafruit_TCS34725::calculateLux(uint16_t r, uint16_t g, uint16_t b) {
  const float lux = -0.32466f * r + 1.57837f * g - 0.73191f * b;
  // En C convertir un float negativo a entero sin signo no está definido; aquí da 0.
  if (lux <= 0) return 0;
  return lux >= 65535 ? 65535 : (uint16_t)lux;
}
