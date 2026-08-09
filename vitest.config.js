import { defineConfig } from 'vitest/config';

// Testes unitários (rápidos, sem rede) — cupom, cálculo de valor, webhook,
// idempotência, validação do checkout. Os testes de limite de plano usam o
// Supabase de produção de verdade (não há Docker/Supabase local neste
// ambiente) e ficam num arquivo *.integration.test.ts separado, rodado só
// via "npm run test:integration" (ver vitest.integration.config.js).
export default defineConfig({
  test: {
    environment: 'node',
    include: ['supabase/functions/**/*.test.ts'],
    exclude: ['**/*.integration.test.ts', 'node_modules/**'],
  },
});
