# Backup e recuperação de dados — Cond-Informa

## Situação atual (confirmada com você em 2026-08-10): plano **Free** do Supabase

O plano Free do Supabase **não inclui nenhum backup automático nativo**:

- Sem backups diários gerenciados.
- Sem PITR (Point-in-Time Recovery) — nem como add-on pago, esse recurso simplesmente
  não existe fora dos planos Pro/Team/Enterprise.
- O projeto também pausa automaticamente após ~1 semana sem uso (risco operacional
  relacionado, embora não seja estritamente "backup").

Ou seja: hoje, se a base de dados sofrer qualquer perda catastrófica — erro humano
(`DELETE`/`DROP` sem `WHERE`), bug num script administrativo, incidente na própria
Supabase — **não existe nenhum caminho de recuperação nativo**. Para um produto cujo
valor central é justamente o histórico (execuções, fotos, ocorrências) como prova
para síndicos/administradoras, esse é um risco real e não uma formalidade.

## Comparação de planos (referência, dados públicos da Supabase)

| Plano | Backup automático | PITR |
|---|---|---|
| **Free** (atual) | Nenhum | Não disponível |
| **Pro** | Diário, retenção de 7 dias | Disponível como add-on pago |
| **Team** | Diário, retenção de 14 dias | Disponível, janela maior |
| **Enterprise** | Configurável | Configurável |

Mesmo o Pro (7 dias corridos) não cobre sozinho o caso de uso descrito — "histórico
de meses de execuções" — porque backup nativo é para recuperar de um incidente
*recente*, não para reter anos de dados. Isso é coberto pela exportação
complementar abaixo, que já está implementada independente do plano.

## Recomendação

1. **Upgrade para o plano Pro é recomendado antes de crescer a base de clientes
   pagantes** — é uma decisão financeira sua, não tomei essa ação automaticamente.
   Ele cobre o cenário mais comum (erro operacional recente, "preciso desfazer o que
   aconteceu ontem"), que a exportação abaixo cobre mal (ela roda 1x por dia, então
   na pior das hipóteses você perde até ~24h de dados recentes se descobrir o
   problema tarde).
2. **A exportação periódica abaixo já está implementada e ativa independente do
   plano** — funciona como uma camada extra própria, útil tanto no Free quanto
   depois de um eventual upgrade (redundância nunca é demais para dados que servem
   como prova/histórico).

## Camada extra implementada: exportação diária para o Storage

- Edge Function `data-backup-export` (`supabase/functions/data-backup-export/`),
  agendada via `pg_cron` + `pg_net` para rodar **1x por dia**.
- Exporta as tabelas `condominios`, `ambientes`, `checklist_items`, `execucoes`,
  `ocorrencias` e `sub_usuarios` (todas as contas — é um dump da plataforma inteira,
  não por cliente) num único arquivo JSON.
- Fotos (`execucoes.photo`/`ocorrencias.photo`) já são salvas como base64 direto na
  coluna, então o dump JSON já inclui as fotos automaticamente, sem passo extra.
- Salvo no bucket privado `data-backups` do Supabase Storage (mesmo projeto — não é
  um backup fora do "raio" de um incidente que derrube o projeto inteiro, mas já
  cobre erro humano/de aplicação, que é o caso mais comum).
- Retenção própria de 180 dias: exports mais antigos que isso são apagados
  automaticamente pela própria função, pra não crescer sem limite.
- Só a service role consegue ler o bucket (RLS do Storage) — não é exposto no app.

## O que ainda falta pra uma cobertura completa (fora do escopo desta tarefa)

- Um backup *fora* do projeto Supabase (outro provedor/região) — a exportação atual
  ainda mora dentro do mesmo projeto Supabase, então um incidente que apague o
  projeto inteiro (não só as tabelas) levaria o backup junto. Mitigar isso exigiria
  configurar destino externo (ex.: S3), o que não fizemos aqui por simplicidade,
  dado que o pedido era "camada extra simples dentro da infra atual".
- Teste de restauração — ter o export não garante que restaurar funciona bem;
  vale simular isso pelo menos uma vez.
