// Faz scroll suave até uma seção da própria página sem mudar o hash da URL —
// necessário porque o app usa HashRouter (exigido pelo GitHub Pages), então um
// simples href="#planos" seria interpretado como uma rota e não como âncora.
export function scrollToSection(id) {
  return (e) => {
    e.preventDefault();
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };
}
