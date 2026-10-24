// Adafruit_VL53L0X.h — librería Adafruit_VL53L0X, compatible con su API pública y escrita desde cero.
// Cada medida tarda el presupuesto de tiempo, como el sensor real. Sin objetivo, la medida queda
// con RangeStatus 4 («Phase Fail»), como la entrega el chip.
#pragma once

#include "Arduino.h"
#include "Wire.h"

#define VL53L0X_I2C_ADDR 0x29

// Tipos de la API de ST (vl53l0x_def.h) que usa la librería.
typedef int8_t VL53L0X_Error;
#define VL53L0X_ERROR_NONE ((VL53L0X_Error)0)
#define VL53L0X_ERROR_CALIBRATION_WARNING ((VL53L0X_Error)-1)
#define VL53L0X_ERROR_MIN_CLIPPED ((VL53L0X_Error)-2)
#define VL53L0X_ERROR_UNDEFINED ((VL53L0X_Error)-3)
#define VL53L0X_ERROR_INVALID_PARAMS ((VL53L0X_Error)-4)
#define VL53L0X_ERROR_NOT_SUPPORTED ((VL53L0X_Error)-5)
#define VL53L0X_ERROR_RANGE_ERROR ((VL53L0X_Error)-6)
#define VL53L0X_ERROR_TIME_OUT ((VL53L0X_Error)-7)
#define VL53L0X_ERROR_MODE_NOT_SUPPORTED ((VL53L0X_Error)-8)
#define VL53L0X_ERROR_CONTROL_INTERFACE ((VL53L0X_Error)-20)
#define VL53L0X_ERROR_NOT_IMPLEMENTED ((VL53L0X_Error)-99)

typedef uint32_t FixPoint1616_t;

typedef uint8_t VL53L0X_VcselPeriod;
#define VL53L0X_VCSEL_PERIOD_PRE_RANGE ((VL53L0X_VcselPeriod)0)
#define VL53L0X_VCSEL_PERIOD_FINAL_RANGE ((VL53L0X_VcselPeriod)1)

#define VL53L0X_CHECKENABLE_SIGMA_FINAL_RANGE 0
#define VL53L0X_CHECKENABLE_SIGNAL_RATE_FINAL_RANGE 1
#define VL53L0X_CHECKENABLE_SIGNAL_REF_CLIP 2
#define VL53L0X_CHECKENABLE_RANGE_IGNORE_THRESHOLD 3
#define VL53L0X_CHECKENABLE_SIGNAL_RATE_MSRC 4
#define VL53L0X_CHECKENABLE_SIGNAL_RATE_PRE_RANGE 5
#define VL53L0X_CHECKENABLE_NUMBER_OF_CHECKS 6

typedef struct {
  uint32_t TimeStamp;
  uint32_t MeasurementTimeUsec;
  uint16_t RangeMilliMeter;
  uint16_t RangeDMaxMilliMeter;
  FixPoint1616_t SignalRateRtnMegaCps;
  FixPoint1616_t AmbientRateRtnMegaCps;
  uint16_t EffectiveSpadRtnCount;
  uint8_t ZoneId;
  uint8_t RangeFractionalPart;
  /** 0: medida válida; 4: fuera de alcance («Phase Fail»). */
  uint8_t RangeStatus;
} VL53L0X_RangingMeasurementData_t;

class Adafruit_VL53L0X {
public:
  typedef enum {
    VL53L0X_SENSE_DEFAULT = 0,
    VL53L0X_SENSE_LONG_RANGE,
    VL53L0X_SENSE_HIGH_SPEED,
    VL53L0X_SENSE_HIGH_ACCURACY
  } VL53L0X_Sense_config_t;

  Adafruit_VL53L0X() { deFabrica(); }

  boolean begin(uint8_t i2c_addr = VL53L0X_I2C_ADDR, boolean debug = false, TwoWire* i2c = &Wire,
                VL53L0X_Sense_config_t vl_config = VL53L0X_SENSE_DEFAULT);
  boolean setAddress(uint8_t newAddr);

  VL53L0X_Error rangingTest(VL53L0X_RangingMeasurementData_t* pRangingMeasurementData, boolean debug = false) {
    return getSingleRangingMeasurement(pRangingMeasurementData, debug);
  }
  VL53L0X_Error getSingleRangingMeasurement(VL53L0X_RangingMeasurementData_t* pRangingMeasurementData, boolean debug = false);
  void printRangeStatus(VL53L0X_RangingMeasurementData_t* pRangingMeasurementData);

  VL53L0X_Error Status = VL53L0X_ERROR_NONE;

  uint16_t readRange(void);
  uint8_t readRangeStatus(void) { return ultimoEstado; }

  boolean startRange(void);
  boolean isRangeComplete(void);
  boolean waitRangeComplete(void);
  uint16_t readRangeResult(void);

  boolean startRangeContinuous(uint16_t period_ms = 50);
  void stopRangeContinuous(void);

  boolean timeoutOccurred(void) { return false; }

  boolean configSensor(VL53L0X_Sense_config_t vl_config);

  boolean setMeasurementTimingBudgetMicroSeconds(uint32_t budget_us);
  uint32_t getMeasurementTimingBudgetMicroSeconds(void);

  boolean setVcselPulsePeriod(VL53L0X_VcselPeriod VcselPeriodType, uint8_t VCSELPulsePeriod);
  uint8_t getVcselPulsePeriod(VL53L0X_VcselPeriod VcselPeriodType);

  boolean setLimitCheckEnable(uint16_t LimitCheckId, uint8_t LimitCheckEnable);
  uint8_t getLimitCheckEnable(uint16_t LimitCheckId);
  boolean setLimitCheckValue(uint16_t LimitCheckId, FixPoint1616_t LimitCheckValue);
  FixPoint1616_t getLimitCheckValue(uint16_t LimitCheckId);

private:
  enum Modo : uint8_t { Quieto, Unica, Continua };

  bool iniciado = false;
  uint8_t direccion = VL53L0X_I2C_ADDR;
  uint32_t presupuestoUs;
  uint8_t vcsel[2];
  uint8_t limitesActivos[VL53L0X_CHECKENABLE_NUMBER_OF_CHECKS];
  FixPoint1616_t limites[VL53L0X_CHECKENABLE_NUMBER_OF_CHECKS];
  Modo modo;
  uint32_t periodoUs = 0;
  /** Cuándo termina la medida en curso (micros). */
  uint32_t listaUs = 0;
  /** Lo que quedó en los registros de resultado: al principio, nada a la vista. */
  VL53L0X_RangingMeasurementData_t ultima = {0, 0, 8190, 0, 0, 0, 0, 0, 0, 4};
  uint8_t ultimoEstado = 0;

  void deFabrica();
  bool terminoLaMedida();
  void esperarLaMedida();
  void medir(VL53L0X_RangingMeasurementData_t* m);
  void entregarLaMedida();
  void sinIniciar(VL53L0X_RangingMeasurementData_t* m);
};
