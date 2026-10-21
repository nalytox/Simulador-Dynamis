// Puntos de entrada que llama el simulador: dyn_setup() y dyn_loop().
#include "Arduino.h"

void setup();
void loop();

extern "C" __attribute__((export_name("dyn_setup"))) void dyn_setup() { setup(); }
extern "C" __attribute__((export_name("dyn_loop"))) void dyn_loop() { loop(); }
