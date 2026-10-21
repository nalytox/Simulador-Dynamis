import { it, expect, vi } from 'vitest';

const { runLLVM } = vi.hoisted(() => ({ runLLVM: vi.fn() }));
vi.mock('@yowasp/clang', () => ({ runLLVM, runClang: vi.fn(), Exit: class Exit extends Error {} }));

import { prepararCompilador } from '../../src/compilador/compilar';

it('si la descarga del compilador falla, se puede reintentar', async () => {
  runLLVM.mockRejectedValueOnce(new Error('sin red')).mockResolvedValueOnce({});
  await expect(prepararCompilador()).rejects.toThrow('sin red');
  await expect(prepararCompilador()).resolves.toBeDefined();
  expect(runLLVM).toHaveBeenCalledTimes(2);
});
