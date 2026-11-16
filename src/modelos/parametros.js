// Constantes físicas que usan los modelos y que no son parte de "Mi robot" (las del robot —masa,
// centro de masa, torque, velocidad máxima— están en su configuración y se editan en «Mi robot»).

/**
 * El piso de la pista: melamina blanca en baldosas de 30 × 30 cm, con cinta negra.
 * TODO(profe): reemplazar los valores estimados por los medidos en la pista real.
 */
export const PISO = {
  /** Roce entre la goma de las ruedas motrices y la melamina: lo más que puede empujar cada rueda es mu · su carga. */
  mu: 0.8, // estimado, medir
  /** Resistencia a la rodadura (fuerza / carga) de las ruedas motrices y de las ruedas locas. */
  rodadura: 0.015, // estimado, medir
  rodaduraLocas: 0.03, // estimado, medir
  /** Cuánto cambia la rodadura de una baldosa a otra (polvo, cinta, desgaste): ± esta fracción. */
  variacionRodadura: 0.2, // estimado
  /** Desnivel entre baldosas vecinas: cada baldosa queda hasta ± esto (mm) más alta o más baja. */
  desnivelMm: 0.3, // estimado, medir
  /** Agarre irregular de cada rueda (piso, goma, polvo): variación (fracción) y cuánto dura (s). */
  ruidoAgarre: 0.02, // estimado
  ruidoAgarreS: 0.3, // estimado
  /** Roce de un apoyo que se arrastra (el chasis sin ruedas locas). */
  muArrastre: 0.3, // estimado
};
