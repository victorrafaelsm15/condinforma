import { Helmet } from 'react-helmet-async';

// Domínio de produção — hoje é a URL padrão da Vercel; quando o usuário
// comprar um domínio próprio, troca só aqui (usado em todo canonical/OG/
// sitemap.xml/robots.txt/JSON-LD, então mantenha os 4 em sincronia).
export const SITE_URL = 'https://condinforma.vercel.app';
export const DEFAULT_OG_IMAGE = `${SITE_URL}/og-image.png`;

// O app roda com HashRouter (GitHub Pages não tem rewrite de SPA sem hash),
// então toda rota interna é fisicamente o mesmo documento em "/" — só o que
// vem depois do "#" muda no cliente. Isso limita o valor de SEO de páginas
// que não a raiz: o Google historicamente não trata "/#/termos" como uma
// URL indexável separada de "/", então canonical/og:url aqui servem para o
// link de compartilhamento abrir direto na página certa (isso funciona
// normalmente), não como garantia de indexação individual no Google.
export default function Seo({ title, description, path = '/', noindex = false, ogImage = DEFAULT_OG_IMAGE, jsonLd }) {
  const url = path === '/' ? `${SITE_URL}/` : `${SITE_URL}/#${path}`;

  return (
    <Helmet>
      <title>{title}</title>
      {description && <meta name="description" content={description} />}
      {noindex && <meta name="robots" content="noindex, nofollow" />}
      {!noindex && (
        <>
          <link rel="canonical" href={url} />
          <meta property="og:title" content={title} />
          {description && <meta property="og:description" content={description} />}
          <meta property="og:type" content="website" />
          <meta property="og:url" content={url} />
          <meta property="og:image" content={ogImage} />
          <meta property="og:site_name" content="Cond-Informa" />
          <meta property="og:locale" content="pt_BR" />
          <meta name="twitter:card" content="summary_large_image" />
          <meta name="twitter:title" content={title} />
          {description && <meta name="twitter:description" content={description} />}
          <meta name="twitter:image" content={ogImage} />
        </>
      )}
      {jsonLd && <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>}
    </Helmet>
  );
}
