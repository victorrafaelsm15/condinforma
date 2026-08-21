// Edge Function chamada 1x por dia via pg_cron (ver
// supabase/pix_automatico_migration.sql) — cria a cobrança de Pix
// Automático do mês seguinte pra cada assinante ativo, já que a
// autorização foi criada com paymentCreationMode: 'MANUAL' (a Asaas NÃO
// gera as cobranças recorrentes sozinha nesse modo, ver
// createPixAutomaticAuthorization em _shared/asaas.ts).
//
// A Asaas só aceita criar a cobrança entre 2 e 10 dias úteis antes do
// vencimento. Rodando 1x por dia, usamos uma janela de dias corridos
// (3 a 9) como aproximação seguramente dentro dos 2-10 dias úteis mesmo
// atravessando fins de semana — a própria Asaas ainda valida o limite
// exato do lado dela como rede de segurança.
//
// LIMITAÇÃO CONHECIDA: se o processo cair depois de criar a cobrança na
// Asaas mas antes de avançar next_pix_charge_due_date aqui no banco, a
// próxima execução tentaria criar a cobrança de novo (duplicata). Dado o
// prazo pra implementar isso, não há trava de idempotência adicional além
// de avançar a data logo após o sucesso — se isso virar problema real,
// checar cobranças existentes na Asaas pra due date antes de criar é o
// próximo passo.

import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders, jsonResponse } from '../_shared/cors.ts';
import { requireCronSecret, errorMessage } from '../_shared/cronAuth.ts';
import { createPixAutomaticCharge } from '../_shared/asaas.ts';
import { PLAN_PRICES } from '../_shared/plans.ts';

const MIN_DAYS_AHEAD = 3;
const MAX_DAYS_AHEAD = 9;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
);

function addOneMonth(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + 1);
  return d.toISOString().slice(0, 10);
}

function daysFromToday(dateStr: string): number {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const target = new Date(`${dateStr}T00:00:00Z`);
  return Math.round((target.getTime() - today.getTime()) / MS_PER_DAY);
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  if (!requireCronSecret(req)) {
    return jsonResponse({ error: 'Não autorizado.' }, 401);
  }

  const result = { created: [] as string[], errors: [] as string[] };

  try {
    const { data: assinantes, error } = await supabaseAdmin
      .from('assinantes')
      .select('asaas_subscription_id, asaas_customer_id, account_id, plan_name, pix_automatic_authorization_id, pix_automatic_status, next_pix_charge_due_date')
      .eq('pix_automatic_status', 'ACTIVE')
      .not('pix_automatic_authorization_id', 'is', null)
      .not('next_pix_charge_due_date', 'is', null);
    if (error) throw error;

    for (const a of assinantes || []) {
      const dueDate = a.next_pix_charge_due_date as string;
      const daysAhead = daysFromToday(dueDate);
      if (daysAhead < MIN_DAYS_AHEAD || daysAhead > MAX_DAYS_AHEAD) continue;

      try {
        // Preço vem do plano atual da conta, não de um valor fixo salvo há
        // meses — se os planos forem reajustados, a próxima cobrança já
        // reflete o valor certo. plans.ts é a mesma fonte usada no checkout.
        const value = PLAN_PRICES[a.plan_name as string];
        if (!value) {
          result.errors.push(`${a.asaas_subscription_id}: plano "${a.plan_name}" sem preço configurado, pulei.`);
          continue;
        }

        await createPixAutomaticCharge({
          customerId: a.asaas_customer_id as string,
          value,
          description: `Cond Informa — Plano ${a.plan_name}`,
          dueDate,
          pixAutomaticAuthorizationId: a.pix_automatic_authorization_id as string,
          externalReference: `${a.account_id}:${a.plan_name}`,
        });

        const { error: updError } = await supabaseAdmin
          .from('assinantes')
          .update({ next_pix_charge_due_date: addOneMonth(dueDate), updated_at: new Date().toISOString() })
          .eq('asaas_subscription_id', a.asaas_subscription_id);
        if (updError) throw updError;

        result.created.push(a.asaas_subscription_id as string);
      } catch (rowErr) {
        const message = errorMessage(rowErr);
        console.error(`Erro ao criar cobrança Pix Automático pra ${a.asaas_subscription_id}:`, message);
        result.errors.push(`${a.asaas_subscription_id}: ${message}`);
      }
    }

    return jsonResponse({ ok: true, ...result });
  } catch (err) {
    const message = errorMessage(err);
    console.error('Erro na rotina de cobrança de Pix Automático:', message);
    return jsonResponse({ ok: false, error: message }, 500);
  }
});
