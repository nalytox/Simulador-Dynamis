#include "Adafruit_VL53L0X.h"

#include <string.h>
#include "dynamis_host.h"

namespace {
/** Lo que entrega el simulador cuando el rayo no encuentra nada. */
const uint16_t SIN_OBJETIVO_MM = 8190;
const uint8_t FUERA_DE_ALCANCE = 4;
const uint16_t LECTURA_FALLIDA = 0xffff;
const uint32_t PRESUPUESTO_MINIMO_US = 20000;
const char* const ESTADOS[] = {"Range Valid", "Sigma Fail", "Signal Fail", "Min Range Fail", "Phase Fail", "Hardware Fail"};

void avisarSinMedida(const char* funcion) {
  char texto[128];
  snprintf(texto, sizeof(texto), "%s necesita una medida en curso: llama antes a startRange() o startRangeContinuous().", funcion);
  dynAvisar(texto);
}
}  // namespace

// Los valores con que el chip queda después de DataInit y StaticInit.
void Adafruit_VL53L0X::deFabrica() {
  presupuestoUs = 33000;
  vcsel[VL53L0X_VCSEL_PERIOD_PRE_RANGE] = 14;
  vcsel[VL53L0X_VCSEL_PERIOD_FINAL_RANGE] = 10;
  const uint8_t activos[] = {1, 1, 1, 0, 0, 0};
  const FixPoint1616_t valores[] = {18 << 16, 16384, 35 << 16, 0, 0, 0};
  memcpy(limitesActivos, activos, sizeof(activos));
  memcpy(limites, valores, sizeof(valores));
  modo = Quieto;
}

boolean Adafruit_VL53L0X::begin(uint8_t i2c_addr, boolean debug, TwoWire* i2c, VL53L0X_Sense_config_t vl_config) {
  (void)debug;
  (void)i2c;
  deFabrica();
  iniciado = true;
  Status = VL53L0X_ERROR_NONE;
  if (!setAddress(i2c_addr)) return false;
  configSensor(vl_config);
  return Status == VL53L0X_ERROR_NONE;
}

boolean Adafruit_VL53L0X::setAddress(uint8_t newAddr) {
  delay(10);
  direccion = newAddr & 0x7F;
  Status = VL53L0X_ERROR_NONE;
  return true;
}

boolean Adafruit_VL53L0X::configSensor(VL53L0X_Sense_config_t vl_config) {
  setLimitCheckEnable(VL53L0X_CHECKENABLE_SIGMA_FINAL_RANGE, 1);
  setLimitCheckEnable(VL53L0X_CHECKENABLE_SIGNAL_RATE_FINAL_RANGE, 1);
  switch (vl_config) {
    case VL53L0X_SENSE_DEFAULT:
      setLimitCheckEnable(VL53L0X_CHECKENABLE_RANGE_IGNORE_THRESHOLD, 1);
      setLimitCheckValue(VL53L0X_CHECKENABLE_RANGE_IGNORE_THRESHOLD, (FixPoint1616_t)(1.5 * 0.023 * 65536));
      break;
    case VL53L0X_SENSE_LONG_RANGE:
      Serial.println("  VL53L0X_SENSE_LONG_RANGE");
      setLimitCheckValue(VL53L0X_CHECKENABLE_SIGNAL_RATE_FINAL_RANGE, (FixPoint1616_t)(0.1 * 65536));
      setLimitCheckValue(VL53L0X_CHECKENABLE_SIGMA_FINAL_RANGE, (FixPoint1616_t)(60 * 65536));
      setMeasurementTimingBudgetMicroSeconds(33000);
      setVcselPulsePeriod(VL53L0X_VCSEL_PERIOD_PRE_RANGE, 18);
      setVcselPulsePeriod(VL53L0X_VCSEL_PERIOD_FINAL_RANGE, 14);
      break;
    case VL53L0X_SENSE_HIGH_SPEED:
      setLimitCheckValue(VL53L0X_CHECKENABLE_SIGNAL_RATE_FINAL_RANGE, (FixPoint1616_t)(0.25 * 65536));
      setLimitCheckValue(VL53L0X_CHECKENABLE_SIGMA_FINAL_RANGE, (FixPoint1616_t)(32 * 65536));
      setMeasurementTimingBudgetMicroSeconds(30000);
      break;
    case VL53L0X_SENSE_HIGH_ACCURACY:
      setLimitCheckValue(VL53L0X_CHECKENABLE_SIGNAL_RATE_FINAL_RANGE, (FixPoint1616_t)(0.25 * 65536));
      setLimitCheckValue(VL53L0X_CHECKENABLE_SIGMA_FINAL_RANGE, (FixPoint1616_t)(18 * 65536));
      setMeasurementTimingBudgetMicroSeconds(200000);
      setLimitCheckEnable(VL53L0X_CHECKENABLE_RANGE_IGNORE_THRESHOLD, 0);
      break;
  }
  return Status == VL53L0X_ERROR_NONE;
}

// ---- Medidas ----

bool Adafruit_VL53L0X::terminoLaMedida() { return static_cast<int32_t>(micros() - listaUs) >= 0; }

void Adafruit_VL53L0X::esperarLaMedida() {
  uint32_t ahora = micros();
  if (static_cast<int32_t>(ahora - listaUs) < 0) delayMicroseconds(listaUs - ahora);
}

// La medida se calcula con la pose del momento en que se lee, no con la del instante en que el
// chip la terminó.
void Adafruit_VL53L0X::medir(VL53L0X_RangingMeasurementData_t* m) {
  memset(m, 0, sizeof(*m));
  m->RangeMilliMeter = dyn_vl53_medir();
  m->RangeStatus = m->RangeMilliMeter >= SIN_OBJETIVO_MM ? FUERA_DE_ALCANCE : 0;
  ultima = *m;
}

// Una medida única termina ahí; en modo continuo, la próxima llega en el período siguiente.
void Adafruit_VL53L0X::entregarLaMedida() {
  if (modo != Continua) {
    modo = Quieto;
    return;
  }
  listaUs += periodoUs * ((micros() - listaUs) / periodoUs + 1);
}

/** Sin begin() el chip no responde: avisa y la medida queda como "nada a la vista". */
void Adafruit_VL53L0X::sinIniciar(VL53L0X_RangingMeasurementData_t* m) {
  dynAvisar("Llama a begin() del VL53L0X antes de leerlo.");
  memset(m, 0, sizeof(*m));
  m->RangeMilliMeter = SIN_OBJETIVO_MM;
  m->RangeStatus = FUERA_DE_ALCANCE;
}

VL53L0X_Error Adafruit_VL53L0X::getSingleRangingMeasurement(VL53L0X_RangingMeasurementData_t* m, boolean debug) {
  VL53L0X_Error estado = VL53L0X_ERROR_NONE;
  if (debug) Serial.println("sVL53L0X: PerformSingleRangingMeasurement");
  if (!iniciado) {
    sinIniciar(m);
    estado = VL53L0X_ERROR_CONTROL_INTERFACE;
  } else {
    // En modo continuo entrega la próxima medida del período; si no, mide una vez.
    if (modo == Continua) esperarLaMedida();
    else delayMicroseconds(presupuestoUs);
    medir(m);
    entregarLaMedida();
  }
  if (debug) {
    printRangeStatus(m);
    // El simulador no calcula las tasas de señal: el valor actual del límite es 0.
    Serial.print("RANGE IGNORE THRESHOLD: ");
    Serial.println(0.0);
    Serial.print("Measured distance: ");
    Serial.println(m->RangeMilliMeter);
  }
  return estado;
}

void Adafruit_VL53L0X::printRangeStatus(VL53L0X_RangingMeasurementData_t* m) {
  const uint8_t estado = m->RangeStatus;
  Serial.print("Range Status: ");
  Serial.print(estado);
  Serial.print(" : ");
  Serial.println(estado < sizeof(ESTADOS) / sizeof(ESTADOS[0]) ? ESTADOS[estado] : "No Update");
}

uint16_t Adafruit_VL53L0X::readRange(void) {
  VL53L0X_RangingMeasurementData_t m;
  Status = getSingleRangingMeasurement(&m, false);
  ultimoEstado = m.RangeStatus;
  return Status == VL53L0X_ERROR_NONE ? m.RangeMilliMeter : LECTURA_FALLIDA;
}

boolean Adafruit_VL53L0X::startRange(void) {
  if (!iniciado) {
    dynAvisar("Llama a begin() del VL53L0X antes de leerlo.");
    Status = VL53L0X_ERROR_CONTROL_INTERFACE;
    return false;
  }
  modo = Unica;
  listaUs = micros() + presupuestoUs;
  Status = VL53L0X_ERROR_NONE;
  return true;
}

boolean Adafruit_VL53L0X::isRangeComplete(void) {
  if (!iniciado) {
    // Como la librería: con error, dice que terminó.
    dynAvisar("Llama a begin() del VL53L0X antes de leerlo.");
    Status = VL53L0X_ERROR_CONTROL_INTERFACE;
    return true;
  }
  Status = VL53L0X_ERROR_NONE;
  if (modo == Quieto) {
    avisarSinMedida("isRangeComplete()");
    return false;
  }
  return terminoLaMedida();
}

boolean Adafruit_VL53L0X::waitRangeComplete(void) {
  if (!iniciado) {
    dynAvisar("Llama a begin() del VL53L0X antes de leerlo.");
    Status = VL53L0X_ERROR_CONTROL_INTERFACE;
    return false;
  }
  if (modo == Quieto) {
    avisarSinMedida("waitRangeComplete()");
    Status = VL53L0X_ERROR_TIME_OUT;
    return false;
  }
  esperarLaMedida();
  Status = VL53L0X_ERROR_NONE;
  return true;
}

// No espera: si la medida en curso no ha terminado, entrega lo que quedó de la anterior.
uint16_t Adafruit_VL53L0X::readRangeResult(void) {
  VL53L0X_RangingMeasurementData_t m;
  if (!iniciado) {
    sinIniciar(&m);
    Status = VL53L0X_ERROR_CONTROL_INTERFACE;
  } else {
    if (modo != Quieto && terminoLaMedida()) {
      medir(&m);
      entregarLaMedida();
    } else {
      m = ultima;
    }
    Status = VL53L0X_ERROR_NONE;
  }
  ultimoEstado = m.RangeStatus;
  return Status == VL53L0X_ERROR_NONE && ultimoEstado != FUERA_DE_ALCANCE ? m.RangeMilliMeter : LECTURA_FALLIDA;
}

// La primera medida termina un presupuesto después de empezar; las siguientes, una por período
// (o seguidas, si el período es menor que el presupuesto).
boolean Adafruit_VL53L0X::startRangeContinuous(uint16_t period_ms) {
  if (!iniciado) {
    dynAvisar("Llama a begin() del VL53L0X antes de leerlo.");
    Status = VL53L0X_ERROR_CONTROL_INTERFACE;
    return false;
  }
  const uint32_t pedidoUs = period_ms * 1000UL;
  periodoUs = pedidoUs > presupuestoUs ? pedidoUs : presupuestoUs;
  modo = Continua;
  listaUs = micros() + presupuestoUs;
  Status = VL53L0X_ERROR_NONE;
  return true;
}

void Adafruit_VL53L0X::stopRangeContinuous(void) {
  modo = Quieto;
  Status = VL53L0X_ERROR_NONE;
}

// ---- Configuración ----

boolean Adafruit_VL53L0X::setMeasurementTimingBudgetMicroSeconds(uint32_t budget_us) {
  if (budget_us < PRESUPUESTO_MINIMO_US) {
    Status = VL53L0X_ERROR_INVALID_PARAMS;
    return false;
  }
  presupuestoUs = budget_us;
  Status = VL53L0X_ERROR_NONE;
  return true;
}

uint32_t Adafruit_VL53L0X::getMeasurementTimingBudgetMicroSeconds(void) {
  Status = VL53L0X_ERROR_NONE;
  return presupuestoUs;
}

// Se guardan y se pueden leer, pero no cambian las medidas del simulador.
boolean Adafruit_VL53L0X::setVcselPulsePeriod(VL53L0X_VcselPeriod VcselPeriodType, uint8_t VCSELPulsePeriod) {
  const uint8_t p = VCSELPulsePeriod;
  const bool valido = p % 2 == 0 &&
    ((VcselPeriodType == VL53L0X_VCSEL_PERIOD_PRE_RANGE && p >= 12 && p <= 18) ||
     (VcselPeriodType == VL53L0X_VCSEL_PERIOD_FINAL_RANGE && p >= 8 && p <= 14));
  if (!valido) {
    Status = VL53L0X_ERROR_INVALID_PARAMS;
    return false;
  }
  vcsel[VcselPeriodType] = p;
  Status = VL53L0X_ERROR_NONE;
  return true;
}

uint8_t Adafruit_VL53L0X::getVcselPulsePeriod(VL53L0X_VcselPeriod VcselPeriodType) {
  if (VcselPeriodType > VL53L0X_VCSEL_PERIOD_FINAL_RANGE) {
    Status = VL53L0X_ERROR_INVALID_PARAMS;
    return 0;
  }
  Status = VL53L0X_ERROR_NONE;
  return vcsel[VcselPeriodType];
}

boolean Adafruit_VL53L0X::setLimitCheckEnable(uint16_t LimitCheckId, uint8_t LimitCheckEnable) {
  if (LimitCheckId >= VL53L0X_CHECKENABLE_NUMBER_OF_CHECKS) {
    Status = VL53L0X_ERROR_INVALID_PARAMS;
    return false;
  }
  limitesActivos[LimitCheckId] = LimitCheckEnable ? 1 : 0;
  Status = VL53L0X_ERROR_NONE;
  return true;
}

uint8_t Adafruit_VL53L0X::getLimitCheckEnable(uint16_t LimitCheckId) {
  if (LimitCheckId >= VL53L0X_CHECKENABLE_NUMBER_OF_CHECKS) {
    Status = VL53L0X_ERROR_INVALID_PARAMS;
    return 0;
  }
  Status = VL53L0X_ERROR_NONE;
  return limitesActivos[LimitCheckId];
}

boolean Adafruit_VL53L0X::setLimitCheckValue(uint16_t LimitCheckId, FixPoint1616_t LimitCheckValue) {
  if (LimitCheckId >= VL53L0X_CHECKENABLE_NUMBER_OF_CHECKS) {
    Status = VL53L0X_ERROR_INVALID_PARAMS;
    return false;
  }
  limites[LimitCheckId] = LimitCheckValue;
  Status = VL53L0X_ERROR_NONE;
  return true;
}

FixPoint1616_t Adafruit_VL53L0X::getLimitCheckValue(uint16_t LimitCheckId) {
  if (LimitCheckId >= VL53L0X_CHECKENABLE_NUMBER_OF_CHECKS) {
    Status = VL53L0X_ERROR_INVALID_PARAMS;
    return 0;
  }
  Status = VL53L0X_ERROR_NONE;
  return limites[LimitCheckId];
}
