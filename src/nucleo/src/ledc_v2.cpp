// ledc_v2.cpp — el PWM del core 2.0.14 del ESP32, por canales. Cada canal (0 a 15) tiene su frecuencia,
// su resolución y su ciclo; ledcWrite(canal, …) lo escribe en todos los pines conectados a ese canal.
// Por debajo usa el PWM por pin del simulador (dyn_ledc_*).
#define DYN_ESP32_CORE 2
#include "Arduino.h"

namespace {

const uint8_t CANALES = 16;
const uint8_t PINES = 40;

struct Canal {
  bool configurado;
  uint32_t freq;
  uint8_t bits;
  uint32_t duty;
};

Canal canales[CANALES];
/** El canal de cada pin más 1 (0: el pin no está conectado a ningún canal). */
uint8_t canalMas1[PINES];

/** `llamada` es cómo se escribió, por ejemplo "ledcSetup(16, …)". */
bool canalValido(uint8_t canal, const char* llamada) {
  if (canal < CANALES) return true;
  char texto[140];
  snprintf(texto, sizeof(texto), "%s: el canal %u no existe. El ESP32 tiene los canales 0 a 15.", llamada, canal);
  dynAvisar(texto);
  return false;
}

/** "funcion(canal, …)" */
const char* llamadaCon(char* texto, size_t largo, const char* funcion, unsigned canal) {
  snprintf(texto, largo, "%s(%u, …)", funcion, canal);
  return texto;
}

}  // namespace

extern "C" uint32_t dynLedcSetup(uint8_t canal, uint32_t freq, uint8_t bits) {
  char llamada[40];
  if (!canalValido(canal, llamadaCon(llamada, sizeof(llamada), "ledcSetup", canal))) return 0;
  canales[canal] = {true, freq, bits, 0};
  for (uint8_t pin = 0; pin < PINES; pin++) {
    if (canalMas1[pin] == canal + 1) dyn_ledc_attach(pin, freq, bits);
  }
  return freq;
}

extern "C" void dynLedcAttachPin(uint8_t pin, uint8_t canal) {
  char llamada[40];
  snprintf(llamada, sizeof(llamada), "ledcAttachPin(%u, %u)", pin, canal);
  if (!canalValido(canal, llamada) || pin >= PINES) return;
  const Canal& c = canales[canal];
  if (!c.configurado) {
    char texto[160];
    snprintf(texto, sizeof(texto), "ledcAttachPin(%u, %u): el canal %u no está configurado. Primero usa ledcSetup(%u, frecuencia, bits).",
             pin, canal, canal, canal);
    dynAvisar(texto);
    return;
  }
  canalMas1[pin] = canal + 1;
  dyn_ledc_attach(pin, c.freq, c.bits);
  dyn_ledc_write(pin, c.duty);
}

extern "C" void dynLedcWrite(uint8_t canal, uint32_t duty) {
  char llamada[40];
  if (!canalValido(canal, llamadaCon(llamada, sizeof(llamada), "ledcWrite", canal))) return;
  Canal& c = canales[canal];
  if (!c.configurado) {
    char texto[200];
    snprintf(texto, sizeof(texto),
             "ledcWrite(%u, …): el canal %u no está configurado. Usa ledcSetup(%u, frecuencia, bits) y ledcAttachPin(pin, %u) antes de ledcWrite(%u, valor).",
             canal, canal, canal, canal, canal);
    dynAvisar(texto);
    return;
  }
  c.duty = duty;
  bool alguno = false;
  for (uint8_t pin = 0; pin < PINES; pin++) {
    if (canalMas1[pin] != canal + 1) continue;
    dyn_ledc_write(pin, duty);
    alguno = true;
  }
  if (!alguno) {
    char texto[140];
    snprintf(texto, sizeof(texto), "ledcWrite(%u, …): ningún pin está conectado al canal %u. Usa ledcAttachPin(pin, %u).", canal, canal, canal);
    dynAvisar(texto);
  }
}

extern "C" void dynLedcDetachPin(uint8_t pin) {
  if (pin >= PINES || canalMas1[pin] == 0) return;
  canalMas1[pin] = 0;
  dyn_ledc_detach(pin);
}

extern "C" uint32_t dynLedcRead(uint8_t canal) { return canal < CANALES ? canales[canal].duty : 0; }

extern "C" uint32_t dynLedcReadFreq(uint8_t canal) {
  return canal < CANALES && canales[canal].configurado ? canales[canal].freq : 0;
}
