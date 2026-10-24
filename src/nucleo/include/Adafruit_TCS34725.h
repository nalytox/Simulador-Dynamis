// Adafruit_TCS34725.h — librería Adafruit TCS34725, compatible con su API pública y escrita desde cero.
// Cada lectura integra luz durante el tiempo elegido y espera ese tiempo, como el sensor real.
// El LED del módulo sigue al pin INT: encendido mientras las interrupciones están apagadas.
#pragma once

#include <Arduino.h>
#include <Wire.h>

#define TCS34725_ADDRESS 0x29

// Registros del chip (los mismos nombres que la librería).
#define TCS34725_COMMAND_BIT 0x80
#define TCS34725_ENABLE 0x00
#define TCS34725_ENABLE_AIEN 0x10
#define TCS34725_ENABLE_WEN 0x08
#define TCS34725_ENABLE_AEN 0x02
#define TCS34725_ENABLE_PON 0x01
#define TCS34725_ATIME 0x01
#define TCS34725_WTIME 0x03
#define TCS34725_WTIME_2_4MS 0xFF
#define TCS34725_WTIME_204MS 0xAB
#define TCS34725_WTIME_614MS 0x00
#define TCS34725_AILTL 0x04
#define TCS34725_AILTH 0x05
#define TCS34725_AIHTL 0x06
#define TCS34725_AIHTH 0x07
#define TCS34725_PERS 0x0C
#define TCS34725_PERS_NONE 0b0000
#define TCS34725_PERS_1_CYCLE 0b0001
#define TCS34725_PERS_2_CYCLE 0b0010
#define TCS34725_PERS_3_CYCLE 0b0011
#define TCS34725_PERS_5_CYCLE 0b0100
#define TCS34725_PERS_10_CYCLE 0b0101
#define TCS34725_PERS_15_CYCLE 0b0110
#define TCS34725_PERS_20_CYCLE 0b0111
#define TCS34725_PERS_25_CYCLE 0b1000
#define TCS34725_PERS_30_CYCLE 0b1001
#define TCS34725_PERS_35_CYCLE 0b1010
#define TCS34725_PERS_40_CYCLE 0b1011
#define TCS34725_PERS_45_CYCLE 0b1100
#define TCS34725_PERS_50_CYCLE 0b1101
#define TCS34725_PERS_55_CYCLE 0b1110
#define TCS34725_PERS_60_CYCLE 0b1111
#define TCS34725_CONFIG 0x0D
#define TCS34725_CONFIG_WLONG 0x02
#define TCS34725_CONTROL 0x0F
#define TCS34725_ID 0x12
#define TCS34725_STATUS 0x13
#define TCS34725_STATUS_AINT 0x10
#define TCS34725_STATUS_AVALID 0x01
#define TCS34725_CDATAL 0x14
#define TCS34725_CDATAH 0x15
#define TCS34725_RDATAL 0x16
#define TCS34725_RDATAH 0x17
#define TCS34725_GDATAL 0x18
#define TCS34725_GDATAH 0x19
#define TCS34725_BDATAL 0x1A
#define TCS34725_BDATAH 0x1B

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

  /** Busca el chip en la dirección (detrás del canal abierto del multiplexor, si hay uno), lo configura y lo enciende. */
  bool begin(uint8_t addr = TCS34725_ADDRESS, TwoWire* theWire = &Wire);
  bool init();

  void setIntegrationTime(uint8_t it);
  void setGain(tcs34725Gain_t gain);
  void getRawData(uint16_t* r, uint16_t* g, uint16_t* b, uint16_t* c);
  void getRawDataOneShot(uint16_t* r, uint16_t* g, uint16_t* b, uint16_t* c);
  void getRGB(float* r, float* g, float* b);

  uint16_t calculateColorTemperature_dn40(uint16_t r, uint16_t g, uint16_t b, uint16_t c);
  uint16_t calculateLux(uint16_t r, uint16_t g, uint16_t b);

  void write8(uint8_t reg, uint8_t value);
  uint8_t read8(uint8_t reg);
  uint16_t read16(uint8_t reg);

  void setInterrupt(bool flag);
  void clearInterrupt();
  void setIntLimits(uint16_t l, uint16_t h);
  void enable();
  void disable();

private:
  uint8_t direccion = TCS34725_ADDRESS;
  bool iniciado = false;
  uint8_t tiempo;
  tcs34725Gain_t ganancia;

  uint32_t ciclos() const { return 256 - tiempo; }
  uint32_t esperaMs() const { return ciclos() * 12 / 5 + 1; }
};
