// Edge Function pública: chamada logo depois que uma ocorrência é gravada
// (pelo colaborador ou morador, tanto no envio direto quanto depois de
// sincronizar a fila offline — ver src/lib/offlineQueue.js), pra disparar
// uma notificação push pro dono do condomínio e os sub-usuários com acesso
// a ele. Recebe só o id da ocorrência já gravada — o resto (descrição,
// ambiente, quem deve ser notificado) é sempre lido do banco aqui, nunca
// confiado no que o cliente mandar, pra não permitir spoofar o texto da
// notificação.
//
// verify_jwt = false (ver config.toml) — quem chama aqui pode ser um
// colaborador ou morador anônimo, igual ao insert da própria ocorrência
// (ocorrencias_public_insert em schema.sql).

import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders, jsonResponse } from '../_shared/cors.ts';
import { sendPushToAccounts } from '../_shared/pushNotify.ts';
import { checkRateLimit, rateLimitResponse, getClientIp } from '../_shared/rateLimit.ts';

const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
);

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Método não permitido.' }, 405);
  }

  // Rota anônima (colaborador/morador sem login): limite por IP. 20 a cada
  // 10 minutos cobre um prédio inteiro registrando ocorrências em sequência
  // sem abrir brecha pra um script martelar o envio de push.
  const allowed = await checkRateLimit({
    supabaseAdmin, key: `notify-ocorrencia:ip:${getClientIp(req)}`, max: 20, windowSeconds: 600,
  });
  if (!allowed) return rateLimitResponse();

  const { ocorrenciaId } = await req.json().catch(() => ({}));
  if (!ocorrenciaId) {
    return jsonResponse({ error: 'ocorrenciaId é obrigatório.' }, 400);
  }

  try {
    const { data: ocorrencia } = await supabaseAdmin
      .from('ocorrencias')
      .select('id, ambiente_id, account_id, description')
      .eq('id', ocorrenciaId)
      .maybeSingle();
    if (!ocorrencia) return jsonResponse({ received: true });

    const { data: ambiente } = await supabaseAdmin
      .from('ambientes')
      .select('name, condominio_id')
      .eq('id', ocorrencia.ambiente_id)
      .maybeSingle();

    // Sub-usuários com acesso ao condomínio dessa ocorrência também são
    // notificados — cada um se inscreveu com o próprio auth.uid() (ver
    // push_subscriptions_migration.sql), então precisa resolver o
    // auth_user_id de cada um separadamente do account_id da conta dona.
    let subUserIds: string[] = [];
    if (ambiente?.condominio_id) {
      const { data: subLinks } = await supabaseAdmin
        .from('sub_usuario_condominios')
        .select('sub_usuario_id')
        .eq('condominio_id', ambiente.condominio_id);
      if (subLinks?.length) {
        const { data: subs } = await supabaseAdmin
          .from('sub_usuarios')
          .select('auth_user_id')
          .in('id', subLinks.map((l: { sub_usuario_id: string }) => l.sub_usuario_id));
        subUserIds = (subs || []).map((s: { auth_user_id: string }) => s.auth_user_id);
      }
    }

    await sendPushToAccounts(supabaseAdmin, [ocorrencia.account_id, ...subUserIds], {
      title: 'Nova ocorrência registrada',
      body: `${ambiente?.name ? `${ambiente.name}: ` : ''}${ocorrencia.description}`.slice(0, 140),
      url: '/admin/ocorrencias',
    });

    return jsonResponse({ received: true });
  } catch (err) {
    console.error('Erro ao processar notify-ocorrencia:', err instanceof Error ? err.message : err);
    return jsonResponse({ received: true });
  }
});
