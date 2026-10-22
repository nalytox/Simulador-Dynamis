import { describe, it, expect } from 'vitest';
import { clasificarErrorEjecucion, ErrorSimulador } from '../../src/simulacion/errores';

describe('errores de ejecución', () => {
  it('un error del modelo del profe guarda su pila en el técnico', () => {
    const causa = new Error('falló');
    const e = clasificarErrorEjecucion(new ErrorSimulador('el modelo del QTR', causa));
    expect(e.tipo).toBe('simulador');
    expect(e.tecnico).toContain('Error en el modelo del QTR: falló');
    expect(e.tecnico).toContain(causa.stack!.split('\n')[1].trim());
  });
});
