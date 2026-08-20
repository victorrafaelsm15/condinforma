// Edge Function pública: recebe o histórico da conversa do chat de suporte
// (ConfiguracoesDrawer -> SupportChat.jsx) e repassa para a API da Anthropic
// (Claude Haiku), com um system prompt fixo que restringe o bot a dúvidas
// sobre o próprio Cond Informa. A chave da Anthropic fica só aqui (variável
// de ambiente ANTHROPIC_API_KEY), nunca no bundle do navegador.
//
// Exige login (Authorization: Bearer <access_token> do Supabase Auth) pra
// evitar que qualquer visitante anônimo da internet gaste a cota da API —
// mesmo padrão de validação manual usado em subscribe/index.ts.

import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders, jsonResponse } from '../_shared/cors.ts';

const ANTHROPIC_MODEL = 'claude-haiku-4-5-20251001';
const MAX_MESSAGES = 20;
const MAX_MESSAGE_LENGTH = 2000;

const SYSTEM_PROMPT = `Você é o assistente de suporte do Cond Informa, respondendo dentro do painel do próprio produto.

O QUE É O COND INFORMA:
Sistema de checklists digitais com QR Code para limpeza e zeladoria de condomínios. O colaborador escaneia o QR Code fixado no ambiente, executa o checklist daquele ambiente e registra fotos como evidência. O síndico, gestor ou administradora acompanha tudo em um painel: execuções concluídas, pendências, fotos, ocorrências e relatórios. O morador consulta o status da limpeza direto pelo QR Code do ambiente, sem precisar criar conta ou fazer login.

PLANOS E PREÇOS:
- Start: R$ 49/mês, 1 condomínio, 2 sub-usuários
- Pro: R$ 149/mês, até 5 condomínios, 10 sub-usuários
- Business: R$ 299/mês, até 10 condomínios, 30 sub-usuários
- Todos os planos incluem suporte 24 horas.
- Operações acima de 10 condomínios: plano Enterprise, sob consulta.

PRINCIPAIS FUNCIONALIDADES:
- Cadastro de condomínios e ambientes
- Checklists personalizados por ambiente
- QR Codes de execução (colaborador) e de status público (morador)
- Histórico de execuções com fotos
- Registro de ocorrências
- Geração de comunicados em PDF
- Sub-usuários: a conta principal pode criar logins adicionais e liberar acesso a condomínios específicos, dentro do limite de sub-usuários do plano
- Modo escuro no painel

REGRAS DE ESCOPO:
Responda SOMENTE perguntas relacionadas ao Cond Informa (como usar, funcionalidades, planos, dúvidas de conta/cobrança). Se perguntarem qualquer outro assunto, como outro produto, outro sistema (incluindo qualquer coisa chamada "SINDICONDOMINIOS-PI" ou similar), assuntos gerais ou código, recuse educadamente e explique que você só pode ajudar com dúvidas sobre o Cond Informa.

TOM: prestativo, direto, profissional mas amigável. Respostas curtas, pois isto é um chat de suporte, não um artigo. Não invente funcionalidades ou preços que não estão listados acima.`;

function isValidMessages(messages: unknown): messages is { role: string; content: string }[] {
  if (!Array.isArray(messages) || messages.length === 0 || messages.length > MAX_MESSAGES) return false;
  return messages.every((m) => {
    if (!m || typeof m !== 'object') return false;
    const { role, content } = m as Record<string, unknown>;
    if (role !== 'user' && role !== 'assistant') return false;
    if (typeof content !== 'string' || !content.trim() || content.length > MAX_MESSAGE_LENGTH) return false;
    return true;
  });
}

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

  const authHeader = req.headers.get('authorization') ?? '';
  const accessToken = authHeader.replace(/^Bearer\s+/i, '');
  if (!accessToken) {
    return jsonResponse({ error: 'Não autenticado.' }, 401);
  }
  const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(accessToken);
  if (userError || !userData.user) {
    return jsonResponse({ error: 'Sessão inválida ou expirada.' }, 401);
  }

  const { messages } = await req.json().catch(() => ({}));
  if (!isValidMessages(messages)) {
    return jsonResponse({ error: 'Histórico de mensagens inválido.' }, 400);
  }

  const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!apiKey) {
    console.error('ANTHROPIC_API_KEY não configurada.');
    return jsonResponse({ error: 'Suporte por chat indisponível no momento.' }, 500);
  }

  try {
    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: ANTHROPIC_MODEL,
        max_tokens: 500,
        system: SYSTEM_PROMPT,
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
      }),
    });

    if (!anthropicRes.ok) {
      const errText = await anthropicRes.text().catch(() => '');
      console.error('Erro da API da Anthropic:', anthropicRes.status, errText);
      return jsonResponse({ error: 'Não foi possível responder agora. Tente novamente em instantes.' }, 502);
    }

    const data = await anthropicRes.json();
    const reply = data?.content?.find((block: { type: string }) => block.type === 'text')?.text;
    if (!reply) {
      return jsonResponse({ error: 'Não foi possível responder agora. Tente novamente em instantes.' }, 502);
    }

    return jsonResponse({ reply });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('Erro ao chamar a Anthropic:', message);
    return jsonResponse({ error: 'Não foi possível responder agora. Tente novamente em instantes.' }, 502);
  }
});
