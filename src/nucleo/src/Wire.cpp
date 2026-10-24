#include "Arduino.h"
#include "Wire.h"

TwoWire Wire;
TwoWire Wire1;

void TwoWire::beginTransmission(uint8_t dir) {
  direccion = dir;
  enSalida = 0;
}

size_t TwoWire::write(uint8_t dato) {
  if (enSalida >= BUFER) return 0;
  salida[enSalida++] = dato;
  return 1;
}

size_t TwoWire::write(const uint8_t* datos, size_t cuanto) {
  size_t escritos = 0;
  while (escritos < cuanto && write(datos[escritos])) escritos++;
  return escritos;
}

// 0: el dispositivo respondió; 2: nadie respondió a la dirección (NACK). Si nadie responde, el
// simulador avisa.
uint8_t TwoWire::endTransmission(bool) {
  const int respondio = dyn_i2c_escribir(direccion, salida, enSalida);
  enSalida = 0;
  return respondio ? 0 : 2;
}

uint8_t TwoWire::requestFrom(int dir, int cuanto, int) {
  leidos = 0;
  enEntrada = 0;
  if (cuanto <= 0) return 0;
  const size_t pedidos = static_cast<size_t>(cuanto) > BUFER ? BUFER : static_cast<size_t>(cuanto);
  if (!dyn_i2c_leer(static_cast<uint8_t>(dir), entrada, pedidos)) return 0;
  enEntrada = pedidos;
  return static_cast<uint8_t>(pedidos);
}

// Sin datos, cada consulta gasta 1 µs: así `while (Wire.available() < 14) {}` no congela el tiempo
// (y el compilador no puede quitar el ciclo).
int TwoWire::available() {
  if (leidos >= enEntrada) dyn_delay_us(1);
  return static_cast<int>(enEntrada - leidos);
}

int TwoWire::read() {
  if (leidos >= enEntrada) {
    dyn_delay_us(1);
    return -1;
  }
  return entrada[leidos++];
}

int TwoWire::peek() {
  if (leidos >= enEntrada) {
    dyn_delay_us(1);
    return -1;
  }
  return entrada[leidos];
}
