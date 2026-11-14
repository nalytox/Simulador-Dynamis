// Cruces, uniones en T, giros en L, marcas verdes y la meta.
//
// Cuando la línea se ensancha (casi todos los sensores en negro, o la línea se abre hacia un borde),
// el robot avanza despacio hasta tener las ruedas en el centro. Mientras avanza mira:
//   - con los sensores de color, las marcas verdes que hay ANTES de la línea atravesada;
//   - con el sensor de línea, hacia qué lados sale línea;
//   - si después de una barra completa aparecen barras de un solo lado: entonces es un F2.
// Al llegar al centro mira si la línea sigue derecho, y decide.
#pragma once

enum Color { BLANCO, NEGRO, VERDE };
const int LECTURAS_VERDES = 2;  // lecturas viendo verde para creer que es una marca

// Lee un sensor de color (abriendo su canal) y dice si ve blanco, negro o verde.
Color leerColor(Adafruit_TCS34725& sensor, uint8_t canal) {
  uint16_t r, g, b, c;
  abrirCanal(canal);
  sensor.getRawData(&r, &g, &b, &c);
  if (c < 60) return NEGRO;                    // casi no vuelve luz
  if (g > r + 20 && g > b + 15) return VERDE;  // el verde gana claramente
  return BLANCO;
}

// ¿Empieza algo que no es la línea sola?
bool hayCruce() {
  if (invertida || !veAlCentro()) return false;
  int n = cuantosVen();
  return n >= 6 || (n >= 4 && (ve(0) || ve(7)));
}

void resolverCruce() {
  bool ramaIzq = false, ramaDer = false;  // sale línea hacia ese lado
  bool completa = false;                   // hubo una barra que cubría todo el sensor
  bool paso = false;                       // la primera barra ya quedó atrás del sensor de línea
  bool habiaBarra = false;                 // la lectura anterior veía una barra de un solo lado
  bool esF2 = false;
  int verdesIzq = 0, verdesDer = 0;
  bool mirandoMarcas = true;

  motores(VELOCIDAD_CRUCE, VELOCIDAD_CRUCE);
  unsigned long inicio = millis();
  while (millis() - inicio < (unsigned long)AVANCE_AL_CENTRO) {
    leerLinea();
    bool izq = ve(0) || ve(1);
    bool der = ve(6) || ve(7);
    if (cuantosVen() >= 6) completa = true;
    if (!paso) {
      if (izq) ramaIzq = true;
      if (der) ramaDer = true;
      if (!izq && !der) paso = true;
    } else if (completa) {
      // Después de una barra completa, una barra de un solo lado: es el indicador F2.
      bool barra = izq != der;
      if (barra && !habiaBarra) {
        if (!esF2) empezarF2();
        esF2 = true;
        anotarDecision(izq ? 'i' : 'd');
      }
      habiaBarra = barra;
    }
    if (mirandoMarcas) {
      Color ci = leerColor(colorIzq, CANAL_COLOR_IZQ);
      Color cd = leerColor(colorDer, CANAL_COLOR_DER);
      if (ci == VERDE) verdesIzq++;
      if (cd == VERDE) verdesDer++;
      // Cuando los dos sensores de color llegan a la línea atravesada, las marcas que vienen después
      // son para quien llega desde el otro lado.
      if (ci == NEGRO && cd == NEGRO) mirandoMarcas = false;
    }
  }
  if (esF2) {
    leerRestoF2(habiaBarra);
    return;
  }

  leerLinea();
  bool recto = ve(2) || ve(3) || ve(4) || ve(5);
  bool marcaIzq = verdesIzq >= LECTURAS_VERDES;
  bool marcaDer = verdesDer >= LECTURAS_VERDES;

  if (marcaIzq && marcaDer) {
    Serial.println("Marcas a los dos lados: vuelta en U.");
    girar(1, 150);
  } else if (marcaIzq) {
    Serial.println("Marca a la izquierda: giro a la izquierda.");
    girar(1, GIRO_MINIMO);
  } else if (marcaDer) {
    Serial.println("Marca a la derecha: giro a la derecha.");
    girar(-1, GIRO_MINIMO);
  } else if (ladoF1 != 0 && recto && (ladoF1 == 'i' ? ramaIzq : ramaDer)) {
    Serial.println("Salgo del cuadrado F1.");
    girar(ladoF1 == 'i' ? 1 : -1, GIRO_MINIMO);
    ladoF1 = 0;
  } else if (ramaIzq && ramaDer) {
    char decision = tomarDecision();
    if (decision != 0) {
      if (!recto) entrarF1(decision);
      else Serial.printf("Cruce sin marcas: la decisión del F2 dice %s.\n", decision == 'i' ? "izquierda" : "derecha");
      girar(decision == 'i' ? 1 : -1, GIRO_MINIMO);
    } else if (recto) {
      Serial.println("Cruce sin marcas: sigo derecho.");
    } else {
      detenerse("¡Llegué a la meta!");
    }
  } else if (ramaIzq && !recto) {
    girar(1, GIRO_MINIMO);  // la línea dobla a la izquierda (un giro en L o una esquina)
  } else if (ramaDer && !recto) {
    girar(-1, GIRO_MINIMO);
  }
  errorAnterior = 0;
  ultimaVezLinea = millis();
}
