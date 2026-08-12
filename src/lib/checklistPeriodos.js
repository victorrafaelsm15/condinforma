import { checklistPeriodosStore, checklistItemsStore } from './stores';

// Sempre existe exatamente UM período ativo por ambiente. Se ainda não
// existir nenhum (ambiente novo, ou nunca teve checklist criado), a
// primeira vez que alguém abre a aba Checklist cria "Período 1"
// automaticamente — evita precisar de um trigger de banco pra manter
// esse invariante.
export async function getOrCreateActivePeriodo(ambienteId, accountId) {
  const periodos = await checklistPeriodosStore.list({ ambiente_id: ambienteId, status: 'ativo' });
  if (periodos[0]) return periodos[0];
  return checklistPeriodosStore.create({
    ambiente_id: ambienteId,
    account_id: accountId,
    nome: 'Período 1',
    status: 'ativo',
    started_at: new Date().toISOString(),
  });
}

// Fecha o período ativo — vira histórico read-only, preservando o status
// exato de cada item no momento do fechamento — e cria um novo período
// ativo, copiando os itens atuais como pendentes. Nenhuma tarefa se perde
// ao virar a página.
export async function closePeriodoAndStartNew({ ambienteId, periodoAtivo, items, accountId }) {
  await checklistPeriodosStore.update(periodoAtivo.id, { status: 'fechado', closed_at: new Date().toISOString() });

  const existentes = await checklistPeriodosStore.list({ ambiente_id: ambienteId });
  const novoPeriodo = await checklistPeriodosStore.create({
    ambiente_id: ambienteId,
    account_id: accountId,
    nome: `Período ${existentes.length + 1}`,
    status: 'ativo',
    started_at: new Date().toISOString(),
  });

  await Promise.all(items.map((item, i) => checklistItemsStore.create({
    ambiente_id: ambienteId,
    checklist_periodo_id: novoPeriodo.id,
    account_id: accountId,
    task: item.task,
    descricao: item.descricao || null,
    order_index: i,
    status: 'pendente',
    criado_por: item.criado_por || null,
  })));

  return novoPeriodo;
}
