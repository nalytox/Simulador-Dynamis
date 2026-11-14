// El obstáculo: lo ve el láser VL53L0X (en el canal 2 del multiplexor) y el robot lo rodea por la
// derecha, en un arco, hasta volver a encontrar la línea.
#pragma once

const float INCLINACION_RAMPA = 2;  // grados: si la nariz se inclina más, lo que vio el láser era una rampa

bool hayObstaculo() {
  abrirCanal(CANAL_LASER);
  if (!laser.isRangeComplete()) return false;
  uint16_t mm = laser.readRangeResult();  // 65535 si no ve nada
  if (mm >= DISTANCIA_OBSTACULO) return false;
  // El láser también ve cerca el comienzo de una rampa (o el piso al terminar de bajarla). Para saber
  // si es un obstáculo, avanza un poco: si la nariz se inclina, era la rampa.
  if (abs(mpu.getAngleY()) > INCLINACION_RAMPA) return false;
  motores(VELOCIDAD_CRUCE, VELOCIDAD_CRUCE);
  unsigned long inicio = millis();
  while (millis() - inicio < 150) {
    mpu.update();
    if (abs(mpu.getAngleY()) > INCLINACION_RAMPA) return false;
  }
  return true;
}

// Gira sobre su eje `grados` hacia `lado` (1 izquierda, -1 derecha), sin buscar línea.
void girarGrados(int lado, float grados) {
  mpu.update();
  float inicio = mpu.getAngleZ();
  motores(-VELOCIDAD_GIRO * lado, VELOCIDAD_GIRO * lado);
  while (abs(mpu.getAngleZ() - inicio) < grados) mpu.update();
}

void esquivar() {
  Serial.println("¡Un obstáculo! Lo rodeo por la derecha.");
  motores(-128, -128);  // retrocede: al girar sobre su eje, las esquinas del chasis barren un círculo
  delay(150);
  girarGrados(-1, 85);
  motores(150, 150);    // se aparta del obstáculo
  delay(RODEO_MS);
  motores(90, 160);     // arco hacia la izquierda, hasta volver a ver la línea
  unsigned long inicio = millis();
  while (millis() - inicio < 900 || !veAlCentro()) {
    mpu.update();
    leerLinea();
  }
  motores(VELOCIDAD_CRUCE, VELOCIDAD_CRUCE);
  delay(390);           // las ruedas quedan sobre la línea
  girar(-1, 20);        // y gira a la derecha hasta mirar a lo largo de ella
  Serial.println("Volví a la línea.");
}
