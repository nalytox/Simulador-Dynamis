// El obstáculo: lo ve el láser VL53L0X (en el canal 2 del multiplexor) y el robot lo rodea por la
// derecha en un rectángulo, con giros medidos por el giroscopio, hasta volver a la línea.
#pragma once

const float INCLINACION_RAMPA = 1.5;  // grados que gira la nariz al empezar a subir: si gira más, era una rampa
const uint16_t CERCA_MM = 35;         // hasta dónde se acerca antes de rodearlo
const unsigned long PASAR_MS = 1250;  // ms avanzando al lado del obstáculo hasta dejarlo atrás (unos 38 cm)
const unsigned long AL_CENTRO_MS = 350;  // ms para llevar las ruedas sobre la línea al volver

// Lee el láser: los mm, o -1 si todavía no hay una medida nueva.
int medirLaser() {
  abrirCanal(CANAL_LASER);
  if (!laser.isRangeComplete()) return -1;
  return laser.readRangeResult();  // 65535 si no ve nada
}

// El láser también ve como algo cerca el comienzo de una rampa (o el piso al terminar de bajarla).
// Por eso, al ver algo, se acerca despacio midiendo con el giroscopio cuánto gira la nariz: si gira
// hacia arriba, era una rampa; si llega cerca sin girar, es el obstáculo. (Se usa el giro y no el
// ángulo de getAngleY(), porque al frenar el acelerómetro hace parecer que el robot se inclina.)
bool hayObstaculo() {
  int mm = medirLaser();
  if (mm < 0 || mm >= DISTANCIA_OBSTACULO) return false;
  if (abs(mpu.getAngleY()) > 5) return false;  // ya está en una rampa
  motores(VELOCIDAD_CRUCE, VELOCIDAD_CRUCE);
  float giroNariz = 0;
  unsigned long antes = micros();
  while (true) {
    mpu.update();
    unsigned long ahora = micros();
    giroNariz += mpu.getGyroY() * (ahora - antes) / 1e6;
    antes = ahora;
    if (abs(giroNariz) > INCLINACION_RAMPA) return false;
    mm = medirLaser();
    if (mm >= 0 && mm < CERCA_MM) return true;
    if (mm >= 0 && mm > DISTANCIA_OBSTACULO + 50) return false;  // ya no está: era otra cosa
  }
}

// Gira sobre su eje `grados` hacia `lado` (1 izquierda, -1 derecha), sin buscar línea.
void girarGrados(int lado, float grados) {
  mpu.update();
  float inicio = mpu.getAngleZ();
  motores(-VELOCIDAD_GIRO * lado, VELOCIDAD_GIRO * lado);
  while (abs(mpu.getAngleZ() - inicio) < grados) mpu.update();
}

void avanzarMs(int velocidad, unsigned long ms) {
  motores(velocidad, velocidad);
  unsigned long inicio = millis();
  while (millis() - inicio < ms) mpu.update();
}

void esquivar() {
  Serial.println("¡Un obstáculo! Lo rodeo por la derecha.");
  avanzarMs(-128, 150);       // retrocede: al girar sobre su eje, las esquinas del chasis barren un círculo
  girarGrados(-1, 88);        // mira hacia la derecha
  avanzarMs(150, RODEO_MS);   // se aparta de la línea
  girarGrados(1, 88);         // vuelve a mirar hacia adelante
  avanzarMs(150, PASAR_MS);   // pasa al lado del obstáculo
  girarGrados(1, 88);         // mira hacia la línea
  motores(VELOCIDAD_CRUCE, VELOCIDAD_CRUCE);
  do {                        // hasta encontrarla
    mpu.update();
    leerLinea();
  } while (!veAlCentro());
  avanzarMs(VELOCIDAD_CRUCE, AL_CENTRO_MS);  // las ruedas quedan sobre la línea
  girar(-1, 70);              // y gira a la derecha hasta mirar a lo largo de ella
  Serial.println("Volví a la línea.");
}
