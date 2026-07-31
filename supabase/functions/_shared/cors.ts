// Cabeçalhos CORS compartilhados: o site (GitHub Pages, outra origem) chama
// estas Edge Functions diretamente do navegador, então toda resposta —
// inclusive o preflight OPTIONS — precisa liberar a origem.
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, asaas-access-token',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

export function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
