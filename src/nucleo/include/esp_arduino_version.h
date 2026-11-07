// esp_arduino_version.h — la versión del core Arduino-ESP32 que se simula.
// El simulador compila con -DDYN_ESP32_CORE=3 (core 3.x) o -DDYN_ESP32_CORE=2 (core 2.0.14), según el
// interruptor de «Mi programa». Sin la definición (la biblioteca del núcleo), es la 3.x.
#pragma once

#ifndef DYN_ESP32_CORE
#define DYN_ESP32_CORE 3
#endif

#define ESP_ARDUINO_VERSION_VAL(major, minor, patch) (((major) << 16) | ((minor) << 8) | (patch))

#if DYN_ESP32_CORE == 2
#define ESP_ARDUINO_VERSION_MAJOR 2
#define ESP_ARDUINO_VERSION_MINOR 0
#define ESP_ARDUINO_VERSION_PATCH 14
#else
#define ESP_ARDUINO_VERSION_MAJOR 3
#define ESP_ARDUINO_VERSION_MINOR 0
#define ESP_ARDUINO_VERSION_PATCH 7
#endif

#define ESP_ARDUINO_VERSION \
  ESP_ARDUINO_VERSION_VAL(ESP_ARDUINO_VERSION_MAJOR, ESP_ARDUINO_VERSION_MINOR, ESP_ARDUINO_VERSION_PATCH)
