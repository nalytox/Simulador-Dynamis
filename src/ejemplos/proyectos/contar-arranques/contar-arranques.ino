// Contar arranques: la memoria del robot (Preferences) guarda datos que no se borran al apagarlo.
// Cada vez que pruebas el robot, cuenta una vez más. Mira la tarjeta «Memoria del robot»: ahí
// aparecen el espacio "arranques" y lo que guarda. Para partir de cero, aprieta «Borrar la memoria».
#include <Preferences.h>
#include "pines.h"

Preferences memoria;

void setup() {
  Serial.begin(115200);
  memoria.begin("arranques");  // abre (o crea) el espacio de nombres "arranques"

  // getUInt devuelve el 0 si la clave todavía no existe: la primera vez.
  unsigned int veces = memoria.getUInt("veces", 0) + 1;
  memoria.putUInt("veces", veces);  // un número entero sin signo
  Serial.printf("Es la vez número %u que parto.\n", veces);

  // Otros tipos, para verlos en la tarjeta: un texto y un decimal.
  memoria.putString("nombre", "Dynamis V2");
  memoria.putFloat("voltaje", 7.4);
  Serial.printf("Me llamo %s y mi batería es de %.1f V.\n", memoria.getString("nombre").c_str(), memoria.getFloat("voltaje"));

  Serial.printf("Quedan %u entradas libres en la memoria.\n", (unsigned)memoria.freeEntries());
  memoria.end();  // cierra el espacio: lo guardado ya quedó en la flash
}

void loop() {
  // Nada más: el robot se queda quieto. Vuelve a apretar «Probar mi robot» y mira cómo sube la cuenta.
}
