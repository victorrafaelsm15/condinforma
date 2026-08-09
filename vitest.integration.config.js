import { defineConfig } from 'vitest/config';

// Testes de integração que batem no Supabase de produção de verdade (sem
// Docker/Supabase local disponível) — separados dos testes unitários pra
// não rodarem sem querer num "npm test" comum. Ver
// supabase/functions/_shared/planLimits.integration.test.ts.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['**/*.integration.test.ts'],
    exclude: ['node_modules/**'],
    testTimeout: 30000,
    hookTimeout: 30000,
  },
});
