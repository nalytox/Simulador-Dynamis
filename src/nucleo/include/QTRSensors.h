// QTRSensors.h — librería QTRSensors (v4) de Pololu, compatible con su API pública y escrita desde
// cero. Lee los sensores con analogRead, así que cuesta el mismo tiempo virtual que en el robot.
#pragma once

#include <Arduino.h>

enum class QTRType : uint8_t { Undefined, RC, Analog };
enum class QTRReadMode : uint8_t { Off, On, OnAndOff, Odd, Even, OddAndEven, Manual };

const uint8_t QTRNoEmitterPin = 255;
const uint8_t QTRMaxSensors = 31;

class QTRSensors {
public:
  struct CalibrationData {
    bool initialized = false;
    uint16_t* minimum = nullptr;
    uint16_t* maximum = nullptr;
  };

  ~QTRSensors();

  void setTypeAnalog();
  QTRType getType() { return tipo; }
  void setSensorPins(const uint8_t* pins, uint8_t sensorCount);
  void setSamplesPerSensor(uint8_t samples);
  uint8_t getSamplesPerSensor() { return muestras; }
  void setEmitterPin(uint8_t emitterPin);
  uint8_t getEmitterPin() { return pinEmisores; }
  void emittersOn();
  void emittersOff();

  void calibrate(QTRReadMode mode = QTRReadMode::On);
  void resetCalibration();
  void read(uint16_t* sensorValues, QTRReadMode mode = QTRReadMode::On);
  void readCalibrated(uint16_t* sensorValues, QTRReadMode mode = QTRReadMode::On);
  uint16_t readLineBlack(uint16_t* sensorValues, QTRReadMode mode = QTRReadMode::On) { return leerLinea(sensorValues, mode, false); }
  uint16_t readLineWhite(uint16_t* sensorValues, QTRReadMode mode = QTRReadMode::On) { return leerLinea(sensorValues, mode, true); }

  CalibrationData calibrationOn;
  CalibrationData calibrationOff;

private:
  QTRType tipo = QTRType::Undefined;
  uint8_t* pines = nullptr;
  uint8_t cantidad = 0;
  uint8_t muestras = 4;
  uint8_t pinEmisores = QTRNoEmitterPin;
  bool emisoresEncendidos = false;
  /** Como la librería: 1023, pensado para el ADC de 10 bits de los Arduino AVR. */
  uint16_t maximo = 1023;
  uint16_t ultimaPosicion = 0;

  bool configurado();
  void leerSensores(uint16_t* valores);
  void calibrarCon(CalibrationData& calibracion, QTRReadMode modo);
  uint16_t leerLinea(uint16_t* valores, QTRReadMode modo, bool lineaBlanca);
};
