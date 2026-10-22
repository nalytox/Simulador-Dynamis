#include "QTRSensors.h"

namespace {
const uint8_t LECTURAS_POR_CALIBRACION = 10;
const uint32_t ESPERA_ENCENDER_US = 300;
const uint32_t ESPERA_APAGAR_US = 1200;

/** Los modos Odd, Even y OddAndEven se leen como On: el QTR-MX-8A tiene un solo pin de emisores. */
bool conEmisores(QTRReadMode modo) {
  return modo == QTRReadMode::On || modo == QTRReadMode::Odd || modo == QTRReadMode::Even || modo == QTRReadMode::OddAndEven;
}

void liberar(QTRSensors::CalibrationData& calibracion) {
  free(calibracion.minimum);
  free(calibracion.maximum);
  calibracion = QTRSensors::CalibrationData();
}
}  // namespace

QTRSensors::~QTRSensors() {
  resetCalibration();
  free(pines);
}

void QTRSensors::setTypeAnalog() {
  tipo = QTRType::Analog;
  maximo = 1023;
}

void QTRSensors::setSensorPins(const uint8_t* pins, uint8_t sensorCount) {
  if (sensorCount > QTRMaxSensors) sensorCount = QTRMaxSensors;
  uint8_t* copia = static_cast<uint8_t*>(realloc(pines, sensorCount ? sensorCount : 1));
  if (!copia) return;
  pines = copia;
  memcpy(pines, pins, sensorCount);
  cantidad = sensorCount;
  resetCalibration();
}

void QTRSensors::setSamplesPerSensor(uint8_t samples) {
  muestras = samples < 1 ? 1 : samples > 64 ? 64 : samples;
}

void QTRSensors::setEmitterPin(uint8_t emitterPin) {
  pinEmisores = emitterPin;
  emisoresEncendidos = false;
  pinMode(pinEmisores, OUTPUT);
}

void QTRSensors::emittersOn() {
  if (pinEmisores == QTRNoEmitterPin || emisoresEncendidos) return;
  digitalWrite(pinEmisores, HIGH);
  emisoresEncendidos = true;
  delayMicroseconds(ESPERA_ENCENDER_US);
}

void QTRSensors::emittersOff() {
  if (pinEmisores == QTRNoEmitterPin || !emisoresEncendidos) return;
  digitalWrite(pinEmisores, LOW);
  emisoresEncendidos = false;
  delayMicroseconds(ESPERA_APAGAR_US);
}

bool QTRSensors::configurado() {
  if (tipo == QTRType::Undefined) {
    dynAvisar("Llama a setTypeAnalog() del QTR antes de leerlo.");
    return false;
  }
  if (cantidad == 0) {
    dynAvisar("Llama a setSensorPins() del QTR antes de leerlo.");
    return false;
  }
  return true;
}

void QTRSensors::leerSensores(uint16_t* valores) {
  uint32_t sumas[QTRMaxSensors] = {};
  for (uint8_t j = 0; j < muestras; j++) {
    for (uint8_t i = 0; i < cantidad; i++) sumas[i] += analogRead(pines[i]);
  }
  for (uint8_t i = 0; i < cantidad; i++) valores[i] = static_cast<uint16_t>((sumas[i] + (muestras >> 1)) / muestras);
}

void QTRSensors::read(uint16_t* sensorValues, QTRReadMode mode) {
  if (!configurado()) return;
  if (mode == QTRReadMode::Manual) {
    leerSensores(sensorValues);
  } else if (mode == QTRReadMode::Off) {
    emittersOff();
    leerSensores(sensorValues);
  } else if (mode == QTRReadMode::OnAndOff) {
    uint16_t apagados[QTRMaxSensors];
    emittersOn();
    leerSensores(sensorValues);
    emittersOff();
    leerSensores(apagados);
    for (uint8_t i = 0; i < cantidad; i++) sensorValues[i] = sensorValues[i] + maximo - apagados[i];
  } else {
    emittersOn();
    leerSensores(sensorValues);
    emittersOff();
  }
}

void QTRSensors::resetCalibration() {
  liberar(calibrationOn);
  liberar(calibrationOff);
}

void QTRSensors::calibrarCon(CalibrationData& calibracion, QTRReadMode modo) {
  if (!calibracion.initialized) {
    calibracion.minimum = static_cast<uint16_t*>(malloc(cantidad * sizeof(uint16_t)));
    calibracion.maximum = static_cast<uint16_t*>(malloc(cantidad * sizeof(uint16_t)));
    if (!calibracion.minimum || !calibracion.maximum) {
      liberar(calibracion);
      return;
    }
    for (uint8_t i = 0; i < cantidad; i++) {
      calibracion.minimum[i] = maximo;
      calibracion.maximum[i] = 0;
    }
    calibracion.initialized = true;
  }
  uint16_t valores[QTRMaxSensors];
  uint16_t mayores[QTRMaxSensors];
  uint16_t menores[QTRMaxSensors];
  for (uint8_t j = 0; j < LECTURAS_POR_CALIBRACION; j++) {
    read(valores, modo);
    for (uint8_t i = 0; i < cantidad; i++) {
      if (j == 0 || valores[i] > mayores[i]) mayores[i] = valores[i];
      if (j == 0 || valores[i] < menores[i]) menores[i] = valores[i];
    }
  }
  // Como la librería: para resistir el ruido, el máximo sube con el menor de las 10 lecturas
  // y el mínimo baja con el mayor.
  for (uint8_t i = 0; i < cantidad; i++) {
    if (menores[i] > calibracion.maximum[i]) calibracion.maximum[i] = menores[i];
    if (mayores[i] < calibracion.minimum[i]) calibracion.minimum[i] = mayores[i];
  }
}

void QTRSensors::calibrate(QTRReadMode mode) {
  if (mode == QTRReadMode::Manual || !configurado()) return;
  if (mode == QTRReadMode::OnAndOff) {
    calibrarCon(calibrationOn, QTRReadMode::On);
    calibrarCon(calibrationOff, QTRReadMode::Off);
  } else if (mode == QTRReadMode::Off) {
    calibrarCon(calibrationOff, QTRReadMode::Off);
  } else {
    calibrarCon(calibrationOn, QTRReadMode::On);
  }
}

void QTRSensors::readCalibrated(uint16_t* sensorValues, QTRReadMode mode) {
  bool listo = mode == QTRReadMode::Off ? calibrationOff.initialized
    : mode == QTRReadMode::OnAndOff ? calibrationOn.initialized && calibrationOff.initialized
    : calibrationOn.initialized;
  if (!listo || mode == QTRReadMode::Manual) {
    dynAvisar("Calibra el QTR con calibrate() antes de usar readCalibrated o readLine.");
    return;
  }
  read(sensorValues, mode);
  for (uint8_t i = 0; i < cantidad; i++) {
    int32_t minimo;
    int32_t maximoCal;
    if (mode == QTRReadMode::Off) {
      minimo = calibrationOff.minimum[i];
      maximoCal = calibrationOff.maximum[i];
    } else if (mode == QTRReadMode::OnAndOff) {
      minimo = calibrationOff.minimum[i] < calibrationOn.minimum[i] ? maximo : calibrationOn.minimum[i] + maximo - calibrationOff.minimum[i];
      maximoCal = calibrationOff.maximum[i] < calibrationOn.maximum[i] ? maximo : calibrationOn.maximum[i] + maximo - calibrationOff.maximum[i];
    } else {
      minimo = calibrationOn.minimum[i];
      maximoCal = calibrationOn.maximum[i];
    }
    int32_t rango = maximoCal - minimo;
    int32_t x = rango != 0 ? (static_cast<int32_t>(sensorValues[i]) - minimo) * 1000 / rango : 0;
    sensorValues[i] = static_cast<uint16_t>(x < 0 ? 0 : x > 1000 ? 1000 : x);
  }
}

uint16_t QTRSensors::leerLinea(uint16_t* valores, QTRReadMode modo, bool lineaBlanca) {
  bool listo = modo == QTRReadMode::Off ? calibrationOff.initialized : calibrationOn.initialized;
  readCalibrated(valores, modo);
  if (!listo || cantidad == 0) return ultimaPosicion;
  bool sobreLinea = false;
  uint32_t ponderado = 0;
  uint32_t suma = 0;
  for (uint8_t i = 0; i < cantidad; i++) {
    uint16_t valor = lineaBlanca ? 1000 - valores[i] : valores[i];
    if (valor > 200) sobreLinea = true;
    if (valor > 50) {
      ponderado += static_cast<uint32_t>(valor) * (i * 1000);
      suma += valor;
    }
  }
  if (!sobreLinea) {
    // Sin línea: se queda en el extremo por donde se perdió.
    return ultimaPosicion < (cantidad - 1) * 1000 / 2 ? 0 : (cantidad - 1) * 1000;
  }
  ultimaPosicion = static_cast<uint16_t>(ponderado / suma);
  return ultimaPosicion;
}
