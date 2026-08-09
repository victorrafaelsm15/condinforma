// Autenticação das Edge Functions chamadas só pelo pg_cron (backup diário,
// varredura de retenção/exclusão) — nunca pelo navegador. verify_jwt=false
// no config.toml (como as outras funções públicas), mas aqui a "chamada
// pública" só faz sentido vindo do próprio Postgres do projeto via
// net.http_post, autenticado por um header com um segredo compartilhado
// (CRON_SECRET) — não a service role key (blast radius menor: se esse
// secret vazar, o pior caso é alguém disparar a rotina de backup/varredura
// fora de hora, não ganhar acesso total ao banco).
export function requireCronSecret(req: Request): boolean {
  const provided = req.headers.get('x-cron-secret');
  const expected = Deno.env.get('CRON_SECRET');
  return Boolean(expected) && provided === expected;
}

// Erros do PostgREST/Supabase (ex.: coluna inexistente, RLS) chegam como
// objeto plano, não instância de Error — String(err) nesses casos vira só
// "[object Object]" e esconde a mensagem real dos logs.
export function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (err && typeof err === 'object' && 'message' in err) return String((err as { message: unknown }).message);
  return String(err);
}
