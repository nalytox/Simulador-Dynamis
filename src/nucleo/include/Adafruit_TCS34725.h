// Adafruit_TCS34725.h — librería Adafruit TCS34725, compatible con su API pública y escrita desde cero.
// Cada lectura integra luz durante el tiempo elegido y espera ese tiempo, como el sensor real.
// El LED del módulo sigue al pin INT: encendido mientras las interrupciones están apagadas.
#pragma once

#include <Arduino.h>
#include <Wire.h>

#define TCS34725_ADDRESS 0x29

#define TCS34725_INTEGRATIONTIME_2_4MS 0xFF
#define TCS34725_INTEGRATIONTIME_24MS 0xF6
#define TCS34725_INTEGRATIONTIME_50MS 0xEB
#define TCS34725_INTEGRATIONTIME_60MS 0xE7
#define TCS34725_INTEGRATIONTIME_101MS 0xD6
#define TCS34725_INTEGRATIONTIME_120MS 0xCE
#define TCS34725_INTEGRATIONTIME_154MS 0xC0
#define TCS34725_INTEGRATIONTIME_180MS 0xB5
#define TCS34725_INTEGRATIONTIME_199MS 0xAD
#define TCS34725_INTEGRATIONTIME_240MS 0x9C
#define TCS34725_INTEGRATIONTIME_300MS 0x83
#define TCS34725_INTEGRATIONTIME_360MS 0x6A
#define TCS34725_INTEGRATIONTIME_401MS 0x59
#define TCS34725_INTEGRATIONTIME_420MS 0x51
#define TCS34725_INTEGRATIONTIME_480MS 0x38
#define TCS34725_INTEGRATIONTIME_499MS 0x30
#define TCS34725_INTEGRATIONTIME_540MS 0x1F
#define TCS34725_INTEGRATIONTIME_600MS 0x06
#define TCS34725_INTEGRATIONTIME_614MS 0x00

typedef enum { TCS34725_GAIN_1X = 0, TCS34725_GAIN_4X, TCS34725_GAIN_16X, TCS34725_GAIN_60X } tcs34725Gain_t;

class Adafruit_TCS34725 {
public:
  Adafruit_TCS34725(uint8_t it = TCS34725_INTEGRATIONTIME_2_4MS, tcs34725Gain_t gain = TCS34725_GAIN_1X)
      : tiempo(it), ganancia(gain) {}

  bool begin(uint8_t addr = TCS34725_ADDRESS, TwoWire* theWire = &Wire);
  void setIntegrationTime(uint8_t it) { tiempo = it; }
  void setGain(tcs34725Gain_t gain) { ganancia = gain; }
  void setInterrupt(bool i) { interrupcion = i; }

  void getRawData(uint16_t* r, uint16_t* g, uint16_t* b, uint16_t* c);
  void getRawDataOneShot(uint16_t* r, uint16_t* g, uint16_t* b, uint16_t* c) { getRawData(r, g, b, c); }
  void getRGB(float* r, float* g, float* b);

  uint16_t calculateColorTemperature_dn40(uint16_t r, uint16_t g, uint16_t b, uint16_t c);
  uint16_t calculateLux(uint16_t r, uint16_t g, uint16_t b);

private:
  uint8_t tiempo;
  tcs34725Gain_t ganancia;
  bool interrupcion = false;

  uint32_t ciclos() const { return 256 - tiempo; }
  uint32_t esperaMs() const { return ciclos() * 12 / 5 + 1; }
};
