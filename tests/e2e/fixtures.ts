import { test as base } from '@playwright/test';

export * from '@playwright/test';

/** Las pruebas parten con el perfil de Marco elegido en la pestaña (perfiles.spec.ts prueba la elección). */
export const test = base.extend({
  context: async ({ context }, use) => {
    await context.addInitScript(() => {
      if (!sessionStorage.getItem('dynamis.perfil')) sessionStorage.setItem('dynamis.perfil', 'marco');
    });
    await use(context);
  },
});
