// Desafíos de Maipú: el indicador F2 y el cuadrado F1.
//
// F2: una barra atravesada (L1) y, después, barras cortas a un lado de la línea. Cada barra corta es
// una decisión, en orden: hacia ese lado en el próximo cruce sin marcas, en el siguiente, y en el
// cuadrado F1. En el F1 el robot entra girando hacia el lado de su decisión, da la vuelta por ese lado
// y sale girando hacia el mismo lado.
#pragma once

const int MAXIMO_DECISIONES = 3;
const unsigned long VENTANA_F2_MS = 700;  // cuánto sigue leyendo barras después de la primera

char decisiones[MAXIMO_DECISIONES];  // 'i' izquierda, 'd' derecha
int cantidadDecisiones = 0;
int proximaDecision = 0;
char ladoF1 = 0;  // dentro del cuadrado F1: el lado por donde salir

void empezarF2() {
  cantidadDecisiones = 0;
  proximaDecision = 0;
  Serial.println("Indicador F2: leo las decisiones.");
}

void anotarDecision(char lado) {
  if (cantidadDecisiones >= MAXIMO_DECISIONES) return;
  decisiones[cantidadDecisiones++] = lado;
  Serial.printf("F2: decisión %d, a la %s.\n", cantidadDecisiones, lado == 'i' ? "izquierda" : "derecha");
}

// La próxima decisión del F2, o 0 si no quedan.
char tomarDecision() {
  return proximaDecision < cantidadDecisiones ? decisiones[proximaDecision++] : 0;
}

// Sigue derecho sobre el F2 leyendo las barras que faltan; `habiaBarra`: si la última lectura veía una.
void leerRestoF2(bool habiaBarra) {
  motores(VELOCIDAD_CRUCE, VELOCIDAD_CRUCE);
  unsigned long inicio = millis();
  while (millis() - inicio < VENTANA_F2_MS) {
    leerLinea();
    bool izq = ve(0) || ve(1);
    bool der = ve(6) || ve(7);
    bool barra = izq != der;
    if (barra && !habiaBarra) anotarDecision(izq ? 'i' : 'd');
    habiaBarra = barra;
  }
  errorAnterior = 0;
  ultimaVezLinea = millis();
}

void entrarF1(char lado) {
  ladoF1 = lado;
  Serial.printf("Cuadrado F1: lo recorro por la %s.\n", lado == 'i' ? "izquierda" : "derecha");
}
