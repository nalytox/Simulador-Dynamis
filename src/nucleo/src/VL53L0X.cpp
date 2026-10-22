#include "VL53L0X.h"

namespace {
const uint32_t PRESUPUESTO_MINIMO_US = 20000;
const uint16_t LECTURA_FALLIDA = 65535;
}  // namespace

bool VL53L0X::init(bool) {
  iniciado = true;
  return true;
}

bool VL53L0X::timeoutOccurred() {
  bool ocurrio = seAgotoElTiempo;
  seAgotoElTiempo = false;
  return ocurrio;
}

bool VL53L0X::setSignalRateLimit(float limiteMcps) {
  if (limiteMcps < 0 || limiteMcps > 511.99f) return false;
  limiteSenal = limiteMcps;
  return true;
}

bool VL53L0X::setMeasurementTimingBudget(uint32_t presupuesto) {
  if (presupuesto < PRESUPUESTO_MINIMO_US) return false;
  presupuestoUs = presupuesto;
  return true;
}

uint16_t VL53L0X::sinIniciar() {
  dynAvisar("Llama a init() del VL53L0X antes de leerlo.");
  seAgotoElTiempo = true;
  return LECTURA_FALLIDA;
}

uint16_t VL53L0X::readRangeSingleMillimeters() {
  if (!iniciado) return sinIniciar();
  delayMicroseconds(presupuestoUs);
  return dyn_vl53_medir();
}

void VL53L0X::startContinuous(uint32_t period_ms) {
  continuo = true;
  periodoUs = period_ms * 1000 > presupuestoUs ? period_ms * 1000 : presupuestoUs;
  proximaUs = micros() + periodoUs;
}

uint16_t VL53L0X::readRangeContinuousMillimeters() {
  if (!iniciado) return sinIniciar();
  if (!continuo) {
    dynAvisar("Llama a startContinuous() del VL53L0X antes de readRangeContinuousMillimeters().");
    seAgotoElTiempo = true;
    return LECTURA_FALLIDA;
  }
  uint32_t ahora = micros();
  if (static_cast<int32_t>(ahora - proximaUs) < 0) {
    delayMicroseconds(proximaUs - ahora);
  } else {
    // La medida más reciente ya terminó: se entrega esa (calculada con la pose actual).
    proximaUs += periodoUs * ((ahora - proximaUs) / periodoUs);
  }
  uint16_t medida = dyn_vl53_medir();
  proximaUs += periodoUs;
  return medida;
}
