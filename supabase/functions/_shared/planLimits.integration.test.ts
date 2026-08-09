// Testes de integração da lógica de limite de plano (condominio_limit e
// sub_usuario_limit) — bloqueio via trigger do Postgres (check_condominio_limit
// / check_subusuario_limit, SQLSTATE 'CI001') e isenção pra contas role='owner'.
//
// Isso roda contra o projeto Supabase de produção de verdade, com a
// service role key — não existe Docker/Supabase local disponível neste
// ambiente pra rodar um Postgres efêmero, e a regra que estamos testando
// vive inteiramente dentro de uma trigger do banco (não dá pra simular em
// JS puro). Por isso fica separado dos testes unitários rápidos, só roda
// via "npm run test:integration", e cria/apaga só contas e dados com
// prefixo "test-planlimit-", sempre limpos no final (afterAll).
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function loadEnv(): Record<string, string> {
  const env: Record<string, string> = {};
  const raw = readFileSync(resolve(__dirname, '../../../.env'), 'utf8');
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m) env[m[1]] = m[2];
  }
  return env;
}

const env = loadEnv();
const url = env.SUPABASE_URL;
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  throw new Error('SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY ausentes em .env — necessários pro teste de integração.');
}

const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

const runId = Date.now();
const createdUserIds: string[] = [];
const createdCondominioIds: string[] = [];

async function createTestUser(label: string) {
  const { data, error } = await admin.auth.admin.createUser({
    email: `test-planlimit-${label}-${runId}@example.com`,
    password: `Test${runId}!`,
    email_confirm: true,
  });
  if (error || !data.user) throw error || new Error('Falha ao criar usuário de teste.');
  createdUserIds.push(data.user.id);
  return data.user.id;
}

describe('limite de plano — condominios (condominio_limit)', () => {
  let accountId: string;

  beforeAll(async () => {
    accountId = await createTestUser('condo');
    // handle_new_user_account roda na mesma transação do createUser — a
    // linha em accounts já existe quando a chamada acima retorna. Simula
    // uma conta no plano Start (limite de 1 condomínio) ativa.
    const { error } = await admin.from('accounts').update({
      status: 'ativo', plan_name: 'start', condominio_limit: 1, role: 'customer',
    }).eq('id', accountId);
    if (error) throw error;
  }, 20000);

  afterAll(async () => {
    for (const id of createdCondominioIds) {
      await admin.from('condominios').delete().eq('id', id);
    }
    createdCondominioIds.length = 0;
    await admin.auth.admin.deleteUser(accountId);
  }, 20000);

  it('permite criar condomínio dentro do limite do plano', async () => {
    const id = `test-planlimit-condo-a-${runId}`;
    const { error } = await admin.from('condominios').insert({ id, name: 'Condo A', account_id: accountId });
    expect(error).toBeNull();
    createdCondominioIds.push(id);
  });

  it('bloqueia (CI001) ao tentar exceder o limite do plano', async () => {
    const id = `test-planlimit-condo-b-${runId}`;
    const { error } = await admin.from('condominios').insert({ id, name: 'Condo B', account_id: accountId });
    expect(error).not.toBeNull();
    expect(error?.code).toBe('CI001');
  });

  it('isenta contas role=owner do limite, mesmo com condominio_limit baixo', async () => {
    const { error: roleError } = await admin.from('accounts').update({ role: 'owner' }).eq('id', accountId);
    expect(roleError).toBeNull();

    const id = `test-planlimit-condo-owner-${runId}`;
    const { error } = await admin.from('condominios').insert({ id, name: 'Condo Owner Bypass', account_id: accountId });
    expect(error).toBeNull();
    createdCondominioIds.push(id);

    // limite continua em 1 — a única razão de ter passado foi role='owner'.
    const { data: acc } = await admin.from('accounts').select('condominio_limit').eq('id', accountId).maybeSingle();
    expect(acc?.condominio_limit).toBe(1);
  });
});

describe('limite de plano — sub-usuários (sub_usuario_limit)', () => {
  let accountId: string;
  let subUserAId: string;
  let subUserBId: string;
  const createdSubUsuarioIds: string[] = [];

  beforeAll(async () => {
    accountId = await createTestUser('subowner');
    subUserAId = await createTestUser('suba');
    subUserBId = await createTestUser('subb');
    const { error } = await admin.from('accounts').update({
      status: 'ativo', plan_name: 'start', sub_usuario_limit: 1, role: 'customer',
    }).eq('id', accountId);
    if (error) throw error;
  }, 20000);

  afterAll(async () => {
    for (const id of createdSubUsuarioIds) {
      await admin.from('sub_usuarios').delete().eq('id', id);
    }
    await admin.auth.admin.deleteUser(accountId);
    await admin.auth.admin.deleteUser(subUserAId);
    await admin.auth.admin.deleteUser(subUserBId);
  }, 20000);

  it('permite criar sub-usuário dentro do limite do plano', async () => {
    const { data, error } = await admin.from('sub_usuarios')
      .insert({ account_id: accountId, auth_user_id: subUserAId, nome: 'Sub A', email: `suba-${runId}@example.com` })
      .select()
      .single();
    expect(error).toBeNull();
    if (data) createdSubUsuarioIds.push(data.id);
  });

  it('bloqueia (CI001) ao tentar exceder o limite de sub-usuários do plano', async () => {
    const { error } = await admin.from('sub_usuarios')
      .insert({ account_id: accountId, auth_user_id: subUserBId, nome: 'Sub B', email: `subb-${runId}@example.com` });
    expect(error).not.toBeNull();
    expect(error?.code).toBe('CI001');
  });

  it('isenta contas role=owner do limite de sub-usuários', async () => {
    const { error: roleError } = await admin.from('accounts').update({ role: 'owner' }).eq('id', accountId);
    expect(roleError).toBeNull();

    const { data, error } = await admin.from('sub_usuarios')
      .insert({ account_id: accountId, auth_user_id: subUserBId, nome: 'Sub B', email: `subb-${runId}@example.com` })
      .select()
      .single();
    expect(error).toBeNull();
    if (data) createdSubUsuarioIds.push(data.id);
  });
});
