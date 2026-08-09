import { supabase } from './supabaseClient';
import { getSession } from './authService';
import { getSubUsuarioInfo } from './subUsuario';

// Registra uma ação administrativa (criação/edição/exclusão de
// condomínio, ambiente, checklist, sub-usuário etc.) pra dar rastro de
// "quem fez o quê e quando" — visível na aba Auditoria de Configurações.
//
// De propósito NUNCA lança exceção: auditoria é um efeito colateral
// secundário, e uma falha aqui (RLS, rede, o que for) não pode travar a
// ação principal que o usuário estava tentando fazer. Fire-and-forget
// (não precisa aguardar) — chame sem await no call site se preferir.
//
// accountId: normalmente resolvido automaticamente (conta principal de
// quem está logado, mesmo se for um sub-usuário agindo). Só passe
// explicitamente quando quem está gravando não pertence à própria conta
// alvo — ex.: o owner da plataforma editando o sub-usuário de OUTRA
// conta pela aba global de Usuários.
export async function logAudit({ action, entityType, entityId, details, accountId }) {
  try {
    const session = await getSession();
    if (!session) return;

    let resolvedAccountId = accountId;
    if (!resolvedAccountId) {
      const subInfo = await getSubUsuarioInfo(session.user.id);
      resolvedAccountId = subInfo ? subInfo.account_id : session.user.id;
    }

    await supabase.from('audit_log').insert({
      account_id: resolvedAccountId,
      auth_user_id: session.user.id,
      action,
      entity_type: entityType || null,
      entity_id: entityId != null ? String(entityId) : null,
      details: details || null,
    });
  } catch {
    // silencioso, de propósito — ver comentário acima
  }
}

export async function listAuditLog(accountId, { action } = {}) {
  let query = supabase.from('audit_log').select('*').eq('account_id', accountId).order('created_at', { ascending: false }).limit(200);
  if (action) query = query.eq('action', action);
  const { data, error } = await query;
  if (error) return [];
  return data || [];
}
