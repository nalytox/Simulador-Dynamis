import { it, expect } from 'vitest';
import { nombreArchivoPista } from '../../src/ui/archivo-pista';

it('el nombre del archivo de la pista no lleva tildes ni caracteres prohibidos', () => {
  expect(nombreArchivoPista('Práctica')).toBe('Practica.json');
  expect(nombreArchivoPista('Pista de Ñuñoa: v2/final')).toBe('Pista de Nunoa- v2-final.json');
  expect(nombreArchivoPista('  ')).toBe('pista.json');
});
