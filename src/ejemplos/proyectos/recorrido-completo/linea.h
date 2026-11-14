// Seguir la línea: PID, línea blanca sobre fondo negro, cortes y velocidad según la inclinación.
#pragma once

bool invertida = false;  // true sobre una baldosa con línea blanca y fondo negro
int errorAnterior = 0;
float integral = 0;
int ultimoLado = 1;      // dónde vio la línea la última vez: 1 a la derecha, -1 a la izquierda
unsigned long ultimaVezLinea = 0;

// ¿El sensor i ve la línea? Negro sobre blanco, o blanco sobre una baldosa invertida.
bool ve(int i) {
  return invertida ? valores[i] < 1000 - UMBRAL_NEGRO : valores[i] > UMBRAL_NEGRO;
}

int cuantosVen() {
  int n = 0;
  for (int i = 0; i < 8; i++) {
    if (ve(i)) n++;
  }
  return n;
}

bool veAlCentro() { return ve(3) || ve(4); }

// Lee el sensor de línea: 0 (bajo el sensor de la izquierda) a 7000 (bajo el de la derecha).
uint16_t leerLinea() {
  return invertida ? qtr.readLineWhite(valores) : qtr.readLineBlack(valores);
}

// Gira sobre su eje mientras el sensor aprende qué es blanco y qué es negro.
void calibrarLinea() {
  int sentidos[3] = {1, -1, 1};
  unsigned long duraciones[3] = {150, 300, 150};
  for (int i = 0; i < 3; i++) {
    motores(-128 * sentidos[i], 128 * sentidos[i]);
    unsigned long inicio = millis();
    while (millis() - inicio < duraciones[i]) qtr.calibrate();
  }
  motores(0, 0);
}

// Una baldosa invertida: el fondo negro lo ven los sensores de los bordes, y la línea blanca, los del
// centro. Al salir, casi todos vuelven a ver blanco.
void revisarInvertida() {
  int negros = 0;
  for (int i = 0; i < 8; i++) {
    if (valores[i] > UMBRAL_NEGRO) negros++;
  }
  bool centroBlanco = valores[3] < 300 || valores[4] < 300;
  if (!invertida && negros >= 5 && valores[0] > UMBRAL_NEGRO && valores[7] > UMBRAL_NEGRO && centroBlanco) {
    invertida = true;
    Serial.println("Línea blanca sobre fondo negro.");
  } else if (invertida && negros <= 3) {
    invertida = false;
    Serial.println("Vuelvo a la línea negra.");
  }
}

// Con el MPU6050 mirando hacia atrás, getAngleY() es positivo con la nariz hacia arriba.
int velocidadBase() {
  float inclinacion = mpu.getAngleY();
  int v = VELOCIDAD;
  if (inclinacion > PITCH_RAMPA) v = VELOCIDAD_SUBIDA;
  else if (inclinacion < -PITCH_RAMPA) v = VELOCIDAD_BAJADA;
  return max(v, VELOCIDAD_MINIMA);
}

void seguirLinea(uint16_t posicion) {
  ultimaVezLinea = millis();
  int error = (int)posicion - 3500;
  if (error > 0) ultimoLado = 1;
  if (error < 0) ultimoLado = -1;
  integral = constrain(integral + error, -20000, 20000);
  int derivada = error - errorAnterior;
  errorAnterior = error;
  int base = velocidadBase();
  int correccion = KP * error + KI * integral + KD * derivada;
  motores(base + correccion, base - correccion);
}

// Sin línea: si hace poco la veía, es un corte y sigue derecho; si no, la busca girando hacia donde la vio.
void cruzarCorte() {
  if (millis() - ultimaVezLinea < (unsigned long)ESPERA_CORTE) {
    int base = velocidadBase();
    motores(base, base);
  } else {
    motores(80 * ultimoLado, -80 * ultimoLado);
  }
}

// Gira sobre su eje hacia `lado` (1 izquierda, -1 derecha): primero al menos `minimo` grados, para
// dejar la línea por la que venía, y después hasta ver la línea nueva al centro. Lo mide el giroscopio.
void girar(int lado, float minimo) {
  mpu.update();
  float inicio = mpu.getAngleZ();
  motores(-VELOCIDAD_GIRO * lado, VELOCIDAD_GIRO * lado);
  while (true) {
    mpu.update();
    float girado = abs(mpu.getAngleZ() - inicio);
    leerLinea();
    if (girado >= minimo && veAlCentro()) break;
    if (girado > minimo + 200) break;  // no encontró la línea: sigue igual con lo que tenga
  }
  errorAnterior = 0;
  integral = 0;
  ultimaVezLinea = millis();
}
