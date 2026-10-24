#include "Adafruit_TCS34725.h"

#include "dynamis_host.h"

namespace {
const uint8_t ID_TCS34725 = 0x44;
const uint8_t ID_TCS34727 = 0x4D;
const uint8_t ID_TCS34725_OTRO = 0x10;
/** Función especial del comando: borrar la interrupción. */
const uint8_t BORRAR_INTERRUPCION = 0x66;
}  // namespace

// Como Adafruit_I2CDevice: si nadie responde, la lectura queda en 0 (el simulador avisa).
void Adafruit_TCS34725::write8(uint8_t reg, uint8_t value) {
  const uint8_t datos[2] = {(uint8_t)(TCS34725_COMMAND_BIT | reg), value};
  dyn_i2c_escribir(direccion, datos, 2);
}

uint8_t Adafruit_TCS34725::read8(uint8_t reg) {
  const uint8_t comando = TCS34725_COMMAND_BIT | reg;
  uint8_t valor = 0;
  if (!dyn_i2c_escribir(direccion, &comando, 1) || !dyn_i2c_leer(direccion, &valor, 1)) return 0;
  return valor;
}

uint16_t Adafruit_TCS34725::read16(uint8_t reg) {
  const uint8_t comando = TCS34725_COMMAND_BIT | reg;
  uint8_t datos[2] = {0, 0};
  if (!dyn_i2c_escribir(direccion, &comando, 1) || !dyn_i2c_leer(direccion, datos, 2)) return 0;
  return (uint16_t)(datos[1] << 8) | datos[0];
}

bool Adafruit_TCS34725::begin(uint8_t addr, TwoWire*) {
  direccion = addr;
  return init();
}

bool Adafruit_TCS34725::init() {
  const uint8_t id = read8(TCS34725_ID);
  if (id != ID_TCS34725 && id != ID_TCS34727 && id != ID_TCS34725_OTRO) return false;
  iniciado = true;
  setIntegrationTime(tiempo);
  setGain(ganancia);
  enable();
  return true;
}

// Encendido (3 ms) y una integración completa antes de que los datos valgan.
void Adafruit_TCS34725::enable() {
  write8(TCS34725_ENABLE, TCS34725_ENABLE_PON);
  delay(3);
  write8(TCS34725_ENABLE, TCS34725_ENABLE_PON | TCS34725_ENABLE_AEN);
  delay(esperaMs());
}

void Adafruit_TCS34725::disable() {
  const uint8_t r = read8(TCS34725_ENABLE);
  write8(TCS34725_ENABLE, r & ~(TCS34725_ENABLE_PON | TCS34725_ENABLE_AEN));
}

void Adafruit_TCS34725::setIntegrationTime(uint8_t it) {
  if (!iniciado) begin(direccion);
  write8(TCS34725_ATIME, it);
  tiempo = it;
}

void Adafruit_TCS34725::setGain(tcs34725Gain_t gain) {
  if (!iniciado) begin(direccion);
  write8(TCS34725_CONTROL, gain);
  ganancia = gain;
}

// Lee los 4 canales y espera una integración, como la librería.
void Adafruit_TCS34725::getRawData(uint16_t* r, uint16_t* g, uint16_t* b, uint16_t* c) {
  if (!iniciado) begin(direccion);
  *c = read16(TCS34725_CDATAL);
  *r = read16(TCS34725_RDATAL);
  *g = read16(TCS34725_GDATAL);
  *b = read16(TCS34725_BDATAL);
  delay(esperaMs());
}

void Adafruit_TCS34725::getRawDataOneShot(uint16_t* r, uint16_t* g, uint16_t* b, uint16_t* c) {
  if (!iniciado) begin(direccion);
  enable();
  getRawData(r, g, b, c);
  disable();
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

// El LED del módulo sigue al pin INT: con la interrupción activada se apaga.
void Adafruit_TCS34725::setInterrupt(bool flag) {
  uint8_t r = read8(TCS34725_ENABLE);
  if (flag) r |= TCS34725_ENABLE_AIEN;
  else r &= ~TCS34725_ENABLE_AIEN;
  write8(TCS34725_ENABLE, r);
}

void Adafruit_TCS34725::clearInterrupt() {
  const uint8_t comando = BORRAR_INTERRUPCION | TCS34725_COMMAND_BIT;
  dyn_i2c_escribir(direccion, &comando, 1);
}

void Adafruit_TCS34725::setIntLimits(uint16_t l, uint16_t h) {
  write8(TCS34725_AILTL, l & 0xFF);
  write8(TCS34725_AILTH, l >> 8);
  write8(TCS34725_AIHTL, h & 0xFF);
  write8(TCS34725_AIHTH, h >> 8);
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
