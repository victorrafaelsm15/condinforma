// Rate limit centralizado pras Edge Functions públicas mais expostas.
// Edge Functions são stateless — o contador em si mora no Postgres (função
// atômica check_rate_limit, ver rate_limit_migration.sql), chamado aqui só
// com o client admin (service role), nunca exposto ao chamador.

import { SupabaseClient } from 'npm:@supabase/supabase-js@2';
import { jsonResponse } from './cors.ts';

type RateLimitInput = {
  supabaseAdmin: SupabaseClient;
  // Já prefixado com o nome da rota pra não colidir entre funções
  // diferentes usando o mesmo IP/account_id, ex.: "subscribe:acc:<uuid>".
  key: string;
  max: number;
  windowSeconds: number;
};

// true = dentro do limite, pode seguir. Se a checagem em si falhar (tabela/
// função indisponível), deixa passar — um problema de infraestrutura nosso
// não pode derrubar a rota inteira pra todo mundo.
export async function checkRateLimit({ supabaseAdmin, key, max, windowSeconds }: RateLimitInput): Promise<boolean> {
  const { data, error } = await supabaseAdmin.rpc('check_rate_limit', {
    p_key: key,
    p_max: max,
    p_window_seconds: windowSeconds,
  });
  if (error) {
    console.error('Erro ao checar rate limit:', error.message);
    return true;
  }
  return data === true;
}

export function getClientIp(req: Request): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
}

export function rateLimitResponse() {
  return jsonResponse({ error: 'Muitas tentativas em pouco tempo. Aguarde alguns instantes e tente novamente.' }, 429);
}
