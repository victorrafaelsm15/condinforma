// Edge Function chamada 1x por dia via pg_cron (ver
// supabase/retention_migration.sql) — exporta os dados críticos da
// plataforma inteira (todas as contas) pra um JSON salvo no bucket
// privado "data-backups" do Supabase Storage, como camada extra de
// segurança independente do backup nativo do Supabase (que no plano Free
// não existe — ver supabase/BACKUP_POLICY.md).

import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders, jsonResponse } from '../_shared/cors.ts';
import { requireCronSecret, errorMessage } from '../_shared/cronAuth.ts';

const BUCKET = 'data-backups';
const RETENTION_DAYS = 180;
const TABLES = ['condominios', 'ambientes', 'checklist_items', 'execucoes', 'ocorrencias', 'sub_usuarios'] as const;

const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
);

async function exportTable(table: string) {
  const { data, error } = await supabaseAdmin.from(table).select('*');
  if (error) throw new Error(`Erro ao exportar ${table}: ${error.message}`);
  return data ?? [];
}

async function pruneOldBackups() {
  const { data: files, error } = await supabaseAdmin.storage.from(BUCKET).list('', { limit: 1000 });
  if (error || !files) return;
  const cutoff = Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000;
  const toRemove = files
    .filter((f) => f.name.startsWith('backup-') && f.created_at && new Date(f.created_at).getTime() < cutoff)
    .map((f) => f.name);
  if (toRemove.length) {
    await supabaseAdmin.storage.from(BUCKET).remove(toRemove);
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  if (!requireCronSecret(req)) {
    return jsonResponse({ error: 'Não autorizado.' }, 401);
  }

  try {
    const exportedAt = new Date().toISOString();
    const payload: Record<string, unknown> = { exported_at: exportedAt };
    for (const table of TABLES) {
      payload[table] = await exportTable(table);
    }

    const fileName = `backup-${exportedAt.slice(0, 10)}.json`;
    const { error: uploadError } = await supabaseAdmin.storage
      .from(BUCKET)
      .upload(fileName, new Blob([JSON.stringify(payload)], { type: 'application/json' }), {
        upsert: true,
        contentType: 'application/json',
      });
    if (uploadError) throw new Error(`Erro ao salvar backup no Storage: ${uploadError.message}`);

    await pruneOldBackups();

    return jsonResponse({
      ok: true,
      file: fileName,
      rows: Object.fromEntries(TABLES.map((t) => [t, (payload[t] as unknown[]).length])),
    });
  } catch (err) {
    const message = errorMessage(err);
    console.error('Erro no backup diário:', message);
    return jsonResponse({ ok: false, error: message }, 500);
  }
});
