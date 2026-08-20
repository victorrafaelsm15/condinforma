// Tela mostrada quando VITE_SUPABASE_URL e/ou VITE_SUPABASE_ANON_KEY não
// foram definidas no build. Desde a migração pra multi-tenant com Supabase
// Auth real, o Supabase deixou de ser opcional (não existe mais fallback
// pra localStorage funcional) — sem essas variáveis o app não tem como
// funcionar, então é melhor parar aqui com uma mensagem clara do que
// deixar tudo tentar continuar e falhar silenciosamente mais na frente
// (tela branca sem nenhuma pista). Não depende do Mantine nem de mais
// nada do app, de propósito — roda antes de qualquer outro provider.
export default function MissingEnvScreen({ missingVars }) {
  return (
    <div style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', textAlign: 'center', padding: 24,
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', background: '#f5f6fc', color: '#10142c',
    }}>
      <h1 style={{ fontSize: 22, fontWeight: 800, margin: '0 0 10px' }}>
        Configuração ausente
      </h1>
      <p style={{ fontSize: 15, color: '#5b6178', maxWidth: 460, margin: '0 0 6px' }}>
        {missingVars.length === 1
          ? `A variável de ambiente ${missingVars[0]} não foi definida ou está com um valor inválido.`
          : `As variáveis de ambiente ${missingVars.join(' e ')} não foram definidas ou estão com valores inválidos.`}
      </p>
      <p style={{ fontSize: 13, color: '#8890a6', maxWidth: 460 }}>
        O Cond Informa precisa dessa configuração pra funcionar. Defina no arquivo <code>.env</code> (local)
        ou nas variáveis de ambiente do provedor de deploy — confira se VITE_SUPABASE_URL está completa,
        com "https://" no início e sem espaços — e publique novamente.
      </p>
    </div>
  );
}
