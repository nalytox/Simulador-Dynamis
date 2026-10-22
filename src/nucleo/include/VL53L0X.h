// VL53L0X.h — librería VL53L0X de Pololu, compatible con su API pública y escrita desde cero.
// Cada medida espera el presupuesto de tiempo, como el sensor real.
#pragma once

#include <Arduino.h>
#include <Wire.h>

class VL53L0X {
public:
  enum vcselPeriodType { VcselPeriodPreRange, VcselPeriodFinalRange };

  uint8_t last_status = 0;

  void setBus(TwoWire* bus) { (void)bus; }
  bool init(bool io_2v8 = true);
  void setAddress(uint8_t nueva) { direccion = nueva; }
  uint8_t getAddress() { return direccion; }
  void setTimeout(uint16_t ms) { tiempoLimiteMs = ms; }
  uint16_t getTimeout() { return tiempoLimiteMs; }
  bool timeoutOccurred();

  bool setSignalRateLimit(float limiteMcps);
  float getSignalRateLimit() { return limiteSenal; }
  bool setMeasurementTimingBudget(uint32_t presupuesto);
  uint32_t getMeasurementTimingBudget() { return presupuestoUs; }
  bool setVcselPulsePeriod(vcselPeriodType tipo, uint8_t periodo) { (void)tipo; (void)periodo; return true; }

  void startContinuous(uint32_t period_ms = 0);
  void stopContinuous() { continuo = false; }
  uint16_t readRangeContinuousMillimeters();
  uint16_t readRangeSingleMillimeters();

private:
  uint8_t direccion = 0x29;
  uint16_t tiempoLimiteMs = 0;
  bool iniciado = false;
  bool seAgotoElTiempo = false;
  float limiteSenal = 0.25f;
  uint32_t presupuestoUs = 33000;
  bool continuo = false;
  uint32_t periodoUs = 0;
  uint32_t proximaUs = 0;

  /** Sin init() la lectura no termina: devuelve 65535 y marca el tiempo agotado, con un aviso. */
  uint16_t sinIniciar();
};
