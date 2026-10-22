import { describe, it, expect } from 'vitest';
import { colorMuestra } from '../../src/ui/lecturas';

describe('lecturas para las tarjetas', () => {
  it('colorMuestra escala el canal más alto a 255 y da negro con poca luz', () => {
    expect(colorMuestra({ r: 960, g: 960, b: 960, c: 2880 })).toBe('#ffffff');
    expect(colorMuestra({ r: 0, g: 0, b: 0, c: 0 })).toBe('#000000');
    expect(colorMuestra({ r: 0, g: 625, b: 305, c: 930 })).toBe('#00ff7c');
    expect(colorMuestra({ r: 50, g: 50, b: 50, c: 150 })).toBe('#000000');
  });
});
