// Edge Function chamada 1x por dia via pg_cron (ver
// supabase/retention_migration.sql) — varre contas com status 'inativo'
// há muito tempo e:
//   - aos 15 dias restantes (75 dias inativa) registra um aviso no
//     audit_log da conta;
//   - aos 3 dias restantes (87 dias inativa) registra outro aviso;
//   - aos 90 dias inativa, exclui em cascata todos os dados da conta
//     (auth.users cascade-remove accounts/condominios/ambientes/
//     checklist_items/execucoes/ocorrencias/sub_usuarios — mesmo mecanismo
//     já usado pela função delete-account).
//
// Sem infraestrutura de e-mail no projeto — os avisos ficam registrados no
// audit_log (visível na aba Auditoria do painel), como o pedido previu
// como alternativa quando não há e-mail disponível.

import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders, jsonResponse } from '../_shared/cors.ts';
import { requireCronSecret, errorMessage } from '../_shared/cronAuth.ts';

const DELETION_DAYS = 90;
const WARNING_15D_AT = DELETION_DAYS - 15; // 75 dias inativa
const WARNING_3D_AT = DELETION_DAYS - 3; // 87 dias inativa
const MS_PER_DAY = 24 * 60 * 60 * 1000;

const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
);

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  if (!requireCronSecret(req)) {
    return jsonResponse({ error: 'Não autorizado.' }, 401);
  }

  const result = { warned15d: [] as string[], warned3d: [] as string[], deleted: [] as string[], errors: [] as string[] };

  try {
    // role='customer' de propósito — owner nunca acumula "inativo" (não
    // depende de assinatura), e mesmo que acumulasse, jamais deveria ser
    // varrido por essa rotina.
    const { data: accounts, error } = await supabaseAdmin
      .from('accounts')
      .select('id, email, status, role, inactive_since, deletion_warning_15d_sent_at, deletion_warning_3d_sent_at')
      .eq('status', 'inativo')
      .eq('role', 'customer')
      .not('inactive_since', 'is', null);
    if (error) throw error;

    for (const acc of accounts || []) {
      try {
        const inactiveSince = new Date(acc.inactive_since as string).getTime();
        const daysInactive = (Date.now() - inactiveSince) / MS_PER_DAY;

        if (daysInactive >= DELETION_DAYS) {
          // Registra ANTES de excluir, numa tabela sem FK em cascata pra
          // account_id — se logasse no audit_log normal, o próprio
          // registro seria apagado junto pelo cascade da exclusão.
          await supabaseAdmin.from('account_deletions').insert({
            account_id: acc.id,
            email: acc.email,
            reason: 'inadimplencia_90_dias',
            inactive_since: acc.inactive_since,
          });
          const { error: delError } = await supabaseAdmin.auth.admin.deleteUser(acc.id as string);
          if (delError) throw delError;
          result.deleted.push(acc.id as string);
          continue;
        }

        if (daysInactive >= WARNING_3D_AT && !acc.deletion_warning_3d_sent_at) {
          await supabaseAdmin.from('audit_log').insert({
            account_id: acc.id,
            auth_user_id: null,
            action: 'conta.aviso_exclusao_3dias',
            entity_type: 'account',
            entity_id: acc.id,
            details: { dias_inativa: Math.floor(daysInactive), dias_restantes: Math.max(0, Math.ceil(DELETION_DAYS - daysInactive)) },
          });
          await supabaseAdmin.from('accounts').update({ deletion_warning_3d_sent_at: new Date().toISOString() }).eq('id', acc.id);
          result.warned3d.push(acc.id as string);
        } else if (daysInactive >= WARNING_15D_AT && !acc.deletion_warning_15d_sent_at) {
          await supabaseAdmin.from('audit_log').insert({
            account_id: acc.id,
            auth_user_id: null,
            action: 'conta.aviso_exclusao_15dias',
            entity_type: 'account',
            entity_id: acc.id,
            details: { dias_inativa: Math.floor(daysInactive), dias_restantes: Math.max(0, Math.ceil(DELETION_DAYS - daysInactive)) },
          });
          await supabaseAdmin.from('accounts').update({ deletion_warning_15d_sent_at: new Date().toISOString() }).eq('id', acc.id);
          result.warned15d.push(acc.id as string);
        }
      } catch (accErr) {
        const message = errorMessage(accErr);
        console.error(`Erro processando conta ${acc.id}:`, message);
        result.errors.push(`${acc.id}: ${message}`);
      }
    }

    return jsonResponse({ ok: true, ...result });
  } catch (err) {
    const message = errorMessage(err);
    console.error('Erro na varredura de retenção:', message);
    return jsonResponse({ ok: false, error: message }, 500);
  }
});
