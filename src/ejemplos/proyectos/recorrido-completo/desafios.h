// Desafíos de Maipú: el indicador F2 y el cuadrado F1.
//
// F2: una barra atravesada (L1) y, después, barras cortas a un lado de la línea. Cada barra corta es
// una decisión, en orden: hacia ese lado en el próximo cruce sin marcas, en el siguiente, y en el
// cuadrado F1. En el F1 el robot entra girando hacia el lado de su decisión, da la vuelta por ese lado
// y sale girando hacia el mismo lado.
#pragma once

const int MAXIMO_DECISIONES = 3;
// Las barras del F2 están a 6, 12 y 18 cm de L1: el robot las busca durante este tiempo después de L1.
const unsigned long VENTANA_F2_MS = 950;

char decisiones[MAXIMO_DECISIONES];  // 'i' izquierda, 'd' derecha
int cantidadDecisiones = 0;
int proximaDecision = 0;
char ladoF1 = 0;                     // dentro del cuadrado F1: el lado por donde salir
unsigned long finBarraCompleta = 0;  // la última vez que una barra cubrió todo el sensor (0: ninguna)
bool vacioDespuesDeL1 = false;       // después de esa barra hubo un momento sin nada en los bordes
char ladoPendiente = 0;              // una barra de un solo lado que todavía está bajo el sensor
bool leyendoF2 = false;

void anotarDecision(char lado) {
  if (cantidadDecisiones >= MAXIMO_DECISIONES) return;
  decisiones[cantidadDecisiones++] = lado;
  Serial.printf("F2: decisión %d, a la %s.\n", cantidadDecisiones, lado == 'i' ? "izquierda" : "derecha");
}

// La próxima decisión del F2, o 0 si no quedan.
char tomarDecision() {
  return proximaDecision < cantidadDecisiones ? decisiones[proximaDecision++] : 0;
}

bool despuesDeL1() {
  return finBarraCompleta != 0 && millis() - finBarraCompleta < VENTANA_F2_MS;
}

// Mira cada lectura del sensor de línea: una barra de un solo lado poco después de una barra completa
// (L1) es una decisión del F2. Para no confundirse con los bordes chuecos de una barra completa (un
// lado entra o sale un poco antes que el otro), la barra cuenta si hay espacio vacío antes y después.
void observarBarras() {
  bool izq = bloqueIzquierdo();
  bool der = bloqueDerecho();
  if (izq && der) {
    finBarraCompleta = millis();
    vacioDespuesDeL1 = false;
    ladoPendiente = 0;
  } else if (!izq && !der) {
    if (ladoPendiente != 0 && despuesDeL1()) {
      if (!leyendoF2) {
        leyendoF2 = true;
        cantidadDecisiones = 0;
        proximaDecision = 0;
        Serial.println("Indicador F2: leo las decisiones.");
      }
      anotarDecision(ladoPendiente);
    }
    ladoPendiente = 0;
    if (finBarraCompleta != 0) vacioDespuesDeL1 = true;
  } else if (vacioDespuesDeL1 && despuesDeL1() && ladoPendiente == 0) {
    ladoPendiente = izq ? 'i' : 'd';
  }
  if (leyendoF2 && !despuesDeL1()) leyendoF2 = false;
}

// Sobre el F2 (leyendo sus barras, o con una barra bajo el sensor después de L1): no es un cruce.
bool sobreF2() {
  return leyendoF2 || (ladoPendiente != 0 && despuesDeL1());
}

// Después de girar, la última barra completa ya no cuenta (las esquinas del F1 no son un F2).
void olvidarBarras() {
  finBarraCompleta = 0;
  vacioDespuesDeL1 = false;
  ladoPendiente = 0;
  leyendoF2 = false;
}

void entrarF1(char lado) {
  ladoF1 = lado;
  Serial.printf("Cuadrado F1: lo recorro por la %s.\n", lado == 'i' ? "izquierda" : "derecha");
}
