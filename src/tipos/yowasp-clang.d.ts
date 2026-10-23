// @yowasp/clang exporta runClang en tiempo de ejecución, pero su api.d.ts no lo declara.
import type { Command } from '@yowasp/clang';

declare module '@yowasp/clang' {
  export const runClang: Command;
}
